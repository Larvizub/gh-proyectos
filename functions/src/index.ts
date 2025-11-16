import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { ConfidentialClientApplication } from '@azure/msal-node';

admin.initializeApp();

// Read configuration from env vars (set via Firebase functions:config:set or process.env)
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || functions.config().azure?.client_id;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || functions.config().azure?.tenant_id;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || functions.config().azure?.client_secret;
const GRAPH_SENDER_USER = process.env.GRAPH_SENDER_USER || functions.config().graph?.sender;
const GRAPH_BASE_URL = process.env.GRAPH_BASE_URL || 'https://graph.microsoft.com/v1.0';

if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID || !AZURE_CLIENT_SECRET) {
  functions.logger.warn('Azure AD client credentials not configured. Set AZURE_CLIENT_ID, AZURE_TENANT_ID and AZURE_CLIENT_SECRET.');
}

const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID || 'common'}`,
    clientSecret: AZURE_CLIENT_SECRET || '',
  },
};

const cca = new ConfidentialClientApplication(msalConfig as any);

async function getAppAccessToken(): Promise<string> {
  if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID || !AZURE_CLIENT_SECRET) throw new Error('Azure credentials missing');
  const tokenResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
  if (!tokenResponse || !tokenResponse.accessToken) throw new Error('Failed to acquire access token');
  return tokenResponse.accessToken;
}

// Safe accessor that returns null when token can't be acquired (used in background triggers)
async function getAppAccessTokenSafe(): Promise<string | null> {
  try {
    return await getAppAccessToken();
  } catch (err) {
    functions.logger.warn('getAppAccessTokenSafe: could not obtain token, skipping Graph operations', { reason: String((err as any)?.message || err) });
    return null;
  }
}

function maskEmails(list: string[] | undefined) {
  if (!Array.isArray(list) || list.length === 0) return '[]';
  const preview = list.slice(0, 3).map((e) => {
    const parts = e.split('@');
    if (parts.length !== 2) return '***';
    const local = parts[0];
    const domain = parts[1];
    return `${local.slice(0, Math.min(3, local.length))}***@${domain}`;
  });
  return `${preview.join(', ')}${list.length > 3 ? ` (+${list.length - 3} más)` : ''}`;
}

async function sendMailViaGraph(accessToken: string, subject: string, bodyHtml: string, toRecipients: string[], ccRecipients: string[] = []) {
  const msg = {
    message: {
      subject,
      body: { contentType: 'HTML', content: bodyHtml },
      toRecipients: toRecipients.map((email) => ({ emailAddress: { address: email } })),
      ccRecipients: ccRecipients
        .filter((email) => !!email)
        .map((email) => ({ emailAddress: { address: email } })),
    },
  };

  // If a specific sender user is provided, send on behalf of that user
  const sendUrl = GRAPH_SENDER_USER ? `${GRAPH_BASE_URL}/users/${encodeURIComponent(GRAPH_SENDER_USER)}/sendMail` : `${GRAPH_BASE_URL}/me/sendMail`;

  await axios.post(sendUrl, msg, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function createCalendarEventViaGraph(accessToken: string, userEmail: string, event: any) {
  const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(userEmail)}/events`;
  const res = await axios.post(url, event, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

// NOTE: multi-DB admin helper removed — this project now performs writes from clients to the
// selected site's Realtime Database. The previous server-side multiWrite/replication helpers
// were deleted as part of the 'multiWrite' decommission.

// Helper to extract participant emails from a project/task structure
function extractEmails(list: any[]): string[] {
  if (!Array.isArray(list)) return [];
  const set = new Set<string>();
  list.forEach((p) => {
    if (typeof p === 'string' && p.includes('@')) set.add(p);
    if (p && p.email) set.add(p.email);
  });
  return Array.from(set);
}

function escapeHtml(value: any) {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(timestamp?: number) {
  if (!timestamp) return 'Sin fecha definida';
  try {
    return new Intl.DateTimeFormat('es-CR', { dateStyle: 'long', timeStyle: 'short' }).format(timestamp);
  } catch (err) {
    return new Date(timestamp).toLocaleString('es-CR');
  }
}

async function resolveUsersByIds(ids: string[], db: admin.database.Database) {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
  if (!uniqueIds.length) return [];
  const results = await Promise.all(uniqueIds.map(async (id) => {
    const snap = await db.ref(`/users/${id}`).once('value');
    return snap.exists() ? snap.val() : null;
  }));
  return results.filter(Boolean) as Array<{ id: string; email?: string; displayName?: string }>;
}

function buildTaskAssignmentEmail(params: {
  task: any;
  project?: any;
  assigneeNames: string[];
  ownerLabel?: string;
  accentColor?: string;
}) {
  const { task, project, assigneeNames, ownerLabel, accentColor } = params;
  const accent = accentColor || '#2563eb';
  const projectName = escapeHtml(project?.name || task?.projectName || 'Proyecto sin nombre');
  const ownerText = ownerLabel ? escapeHtml(ownerLabel) : 'Propietario del proyecto';
  const assigneeList = assigneeNames.length
    ? `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px;">${assigneeNames
        .map((name) => `<li style="font-size:13px;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#0f172a;">${escapeHtml(name)}</li>`)
        .join('')}</ul>`
    : '<p style="margin:0;font-size:13px;color:#475467;">Sin asignados definidos</p>';

  return `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:'Inter',system-ui,-apple-system,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <div style="padding:18px 24px;background:linear-gradient(135deg, ${accent} 0%, #0f172a 100%);color:#fff;">
          <p style="margin:0;font-size:16px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Notificación de tarea</p>
          <p style="margin:6px 0 0;font-size:20px;font-weight:700;">${projectName}</p>
        </div>
        <div style="padding:24px;">
          <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">${escapeHtml(task?.title || 'Título sin nombre')}</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475467;">${escapeHtml(task?.description || 'No se proporcionó descripción.')}</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
            <span style="font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid rgba(15,23,42,0.2);background:#eef2ff;color:#312e81;">Prioridad: ${escapeHtml(task?.priority || 'medium')}</span>
            <span style="font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid rgba(15,23,42,0.2);background:#fef9c3;color:#92400e;">Estado: ${escapeHtml(task?.status || 'todo')}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
            <div>
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Fecha inicio</p>
              <p style="margin:4px 0 0;font-size:14px;font-weight:600;">${formatDate(task?.startDate)}</p>
            </div>
            <div>
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Fecha vencimiento</p>
              <p style="margin:4px 0 0;font-size:14px;font-weight:600;">${formatDate(task?.dueDate)}</p>
            </div>
            <div>
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Dueño del proyecto</p>
              <p style="margin:4px 0 0;font-size:14px;font-weight:600;">${ownerText}</p>
            </div>
          </div>
          <div style="padding:16px;border-radius:12px;background:#f1f5f9;border:1px solid #e2e8f0;margin-bottom:20px;">
            <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;">Asignados</p>
            ${assigneeList}
          </div>
          <div style="margin-bottom:12px;">
            <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Descripción del proyecto</p>
            <p style="margin:4px 0 0;font-size:14px;color:#475467;">${escapeHtml(project?.description || 'Sin descripción para el proyecto.')}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#0f172a;">
            Accede a la plataforma para ver el estado completo de la tarea y continuar con la colaboración.
          </p>
        </div>
      </div>
    </div>`;
}

// Trigger: on project created -> send email to participants
export const onProjectCreated = functions.database.ref('/projects/{projectId}').onCreate(async (snapshot, context) => {
  const project = snapshot.val();
  functions.logger.log('Project created', context.params.projectId);
  const accessToken = await getAppAccessTokenSafe();

  const subject = `Nuevo proyecto creado: ${project?.name || 'Sin título'}`;
  const participants = extractEmails(project?.participants || project?.members || []);
  if (participants.length === 0) return null;

  const body = `<p>Se ha creado un nuevo proyecto: <strong>${project?.name}</strong></p>
    <p>Descripción: ${project?.description || '-'}</p>
    <p>Vea el proyecto en la plataforma.</p>`;

  // If no token (credentials not configured), skip email sending quietly
  if (!accessToken) {
    functions.logger.warn('Skipping project creation emails: Azure token unavailable', { projectId: context.params.projectId, participants: maskEmails(participants) });
    return null;
  }

  try {
    await sendMailViaGraph(accessToken, subject, body, participants);
    functions.logger.log('Project creation emails sent', { projectId: context.params.projectId, recipientsCount: participants.length });
  } catch (err) {
    functions.logger.error('Error sending project creation emails', { err: String((err as any)?.message || err), recipients: maskEmails(participants) });
  }

  return null;
});

// Callable: upsertUser -> create or update a user record in the target Realtime Database
export const upsertUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const site: string | undefined = data?.site;
  const dbUrl: string | undefined = data?.dbUrl; // optional: client may provide target DB url
  const user = data?.user;

  if (!site || !user || !user.id) {
    throw new functions.https.HttpsError('invalid-argument', 'site and user.id are required');
  }

  // Ensure the caller is the authenticated user or an admin (simple check)
  if (context.auth.uid !== user.id) {
    // Allow privileged server-to-server use in the future, but for now require uid match
    throw new functions.https.HttpsError('permission-denied', 'Caller UID does not match user id');
  }

  // Helper: initialize or reuse a secondary admin app for a given databaseURL
  const appsByDb = (global as any).__appsByDb || ((global as any).__appsByDb = {});
  let adminApp: admin.app.App = admin.app();
  if (dbUrl) {
    if (!appsByDb[dbUrl]) {
      // create a named secondary app
      try {
        appsByDb[dbUrl] = admin.initializeApp({ databaseURL: dbUrl } as any, `db-${Object.keys(appsByDb).length + 1}`);
      } catch (e) {
        // If create fails because an app with same name exists, fallback to admin.app()
        functions.logger.warn('upsertUser: error creating secondary app', e);
        appsByDb[dbUrl] = admin.app();
      }
    }
    adminApp = appsByDb[dbUrl];
  }

  try {
    const db = adminApp.database();
    const usersRef = db.ref(`/users/${user.id}`);

    // Sanitize user object: remove undefined fields (Realtime DB does not accept undefined)
    const sanitized: any = {};
    const allowed = ['id', 'email', 'displayName', 'photoURL', 'role', 'createdAt', 'updatedAt'];
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(user, k)) {
        const v = (user as any)[k];
        // set null for undefined-like values
        if (v === undefined) sanitized[k] = null;
        else sanitized[k] = v;
      }
    }

    const snap = await usersRef.once('value');
    if (!snap.exists()) {
      // ensure timestamps
      if (!sanitized.createdAt) sanitized.createdAt = Date.now();
      sanitized.updatedAt = Date.now();
      await usersRef.set(sanitized);
      return { success: true, created: true };
    } else {
      sanitized.updatedAt = Date.now();
      // prevent overwriting role if not provided
      if (sanitized.role === undefined || sanitized.role === null) delete sanitized.role;
      await usersRef.update(sanitized);
      return { success: true, created: false };
    }
  } catch (err: any) {
    functions.logger.error('upsertUser error', err?.message || err);
    throw new functions.https.HttpsError('internal', 'Failed to upsert user');
  }
});

// Helper to manage secondary admin apps cache across callables
const __appsByDb: Record<string, admin.app.App> = (global as any).__appsByDb || ((global as any).__appsByDb = {});

async function ensureAdminAppForDb(dbUrl?: string) {
  let adminApp: admin.app.App = admin.app();
  if (dbUrl) {
    if (!__appsByDb[dbUrl]) {
      try {
        __appsByDb[dbUrl] = admin.initializeApp({ databaseURL: dbUrl } as any, `db-${Object.keys(__appsByDb).length + 1}`);
      } catch (e) {
        functions.logger.warn('ensureAdminAppForDb: error creating secondary app', e);
        __appsByDb[dbUrl] = admin.app();
      }
    }
    adminApp = __appsByDb[dbUrl];
  }
  return adminApp;
}

// Callable: createRole -> create a role record in the target Realtime Database (admin write)
export const createRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const role = data?.role;
  const dbUrl = data?.dbUrl;
  if (!role || !role.name) throw new functions.https.HttpsError('invalid-argument', 'role.name is required');

  try {
    const adminApp = await ensureAdminAppForDb(dbUrl);
    // Basic server-side RBAC: require caller to already have role 'admin' in that DB
    try {
      const callerRef = adminApp.database().ref(`/users/${context.auth.uid}`);
      const callerSnap = await callerRef.once('value');
      const caller = callerSnap.exists() ? callerSnap.val() : null;
      if (!caller || caller.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Caller is not an admin for the target site');
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      functions.logger.warn('createRole: failed to verify caller admin status', err);
      throw new functions.https.HttpsError('internal', 'Failed to verify caller admin status');
    }

    const rolesRef = adminApp.database().ref('/roles');
    const newRef = rolesRef.push();
    const payload = { id: newRef.key, name: role.name, modules: role.modules || {}, createdAt: Date.now(), updatedAt: Date.now() };
    await newRef.set(payload);
    return { success: true, role: payload };
  } catch (err: any) {
    functions.logger.error('createRole error', err?.message || err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', 'Failed to create role');
  }
});

// Callable: updateRole -> update a role record in the target Realtime Database (admin write)
export const updateRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const roleId = data?.roleId;
  const updates = data?.updates;
  const dbUrl = data?.dbUrl;
  if (!roleId || !updates) throw new functions.https.HttpsError('invalid-argument', 'roleId and updates are required');

  try {
    const adminApp = await ensureAdminAppForDb(dbUrl);
    // verify caller is admin
    try {
      const callerRef = adminApp.database().ref(`/users/${context.auth.uid}`);
      const callerSnap = await callerRef.once('value');
      const caller = callerSnap.exists() ? callerSnap.val() : null;
      if (!caller || caller.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Caller is not an admin for the target site');
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      functions.logger.warn('updateRole: failed to verify caller admin status', err);
      throw new functions.https.HttpsError('internal', 'Failed to verify caller admin status');
    }

    const roleRef = adminApp.database().ref(`/roles/${roleId}`);
    const snap = await roleRef.once('value');
    if (!snap.exists()) throw new functions.https.HttpsError('not-found', 'Role not found');

    const sanitized: any = { ...updates };
    if (sanitized.updatedAt === undefined) sanitized.updatedAt = Date.now();
    await roleRef.update(sanitized);
    const updatedSnap = await roleRef.once('value');
    return { success: true, role: updatedSnap.val() };
  } catch (err: any) {
    functions.logger.error('updateRole error', err?.message || err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', 'Failed to update role');
  }
});

// Callable: deleteRole -> admin delete
export const deleteRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const roleId = data?.roleId;
  const dbUrl = data?.dbUrl;
  if (!roleId) throw new functions.https.HttpsError('invalid-argument', 'roleId is required');

  try {
    const adminApp = await ensureAdminAppForDb(dbUrl);
    // verify admin
    try {
      const callerRef = adminApp.database().ref(`/users/${context.auth.uid}`);
      const callerSnap = await callerRef.once('value');
      const caller = callerSnap.exists() ? callerSnap.val() : null;
      if (!caller || caller.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Caller is not an admin for the target site');
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      functions.logger.warn('deleteRole: failed to verify caller admin status', err);
      throw new functions.https.HttpsError('internal', 'Failed to verify caller admin status');
    }

    const roleRef = adminApp.database().ref(`/roles/${roleId}`);
    await roleRef.remove();
    return { success: true };
  } catch (err: any) {
    functions.logger.error('deleteRole error', err?.message || err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', 'Failed to delete role');
  }
});

// Trigger: on task created or updated -> notify assignee or on status change
export const onTaskWritten = functions.database.ref('/tasks/{taskId}').onWrite(async (change, context) => {
  const before = change.before.exists() ? change.before.val() : null;
  const after = change.after.exists() ? change.after.val() : null;
  functions.logger.log('Task written', context.params.taskId);

  const accessToken = await getAppAccessTokenSafe();

  // New task
  if (!before && after) {
    const db = admin.database();
    const assigneeIds: string[] = [];
    if (Array.isArray(after.assigneeIds)) assigneeIds.push(...after.assigneeIds.filter(Boolean));
    if (Array.isArray(after.assignees)) {
      assigneeIds.push(...after.assignees.map((a: any) => (typeof a === 'string' ? a : a?.id)).filter(Boolean));
    }

    const assigneeProfiles = await resolveUsersByIds(assigneeIds, db);
    const legacyAssignments: any[] = [];
    if (after.assignedTo) legacyAssignments.push(after.assignedTo);
    if (Array.isArray(after.assignees)) legacyAssignments.push(...after.assignees);
    const assigneeEmailsFromLegacy = extractEmails(legacyAssignments);
    const assigneeEmailSet = new Set<string>([
      ...assigneeEmailsFromLegacy,
      ...assigneeProfiles.map((user) => user?.email).filter(Boolean),
    ]);
    const assigneeEmails = Array.from(assigneeEmailSet);
    if (!assigneeEmails.length) return null;

    const projectSnap = after.projectId ? await db.ref(`/projects/${after.projectId}`).once('value') : null;
    const project = projectSnap && projectSnap.exists() ? projectSnap.val() : null;
    const ownerProfiles = project?.ownerId ? await resolveUsersByIds([project.ownerId], db) : [];
    const ownerProfile = ownerProfiles[0] || null;
    const ownerEmail = ownerProfile?.email;
    const ownerLabel = ownerProfile?.displayName || ownerProfile?.email;
    const ccRecipients = ownerEmail && !assigneeEmails.includes(ownerEmail) ? [ownerEmail] : [];

    const assigneeNames = Array.from(
      new Set([
        ...assigneeProfiles.map((user) => user?.displayName || user?.email).filter(Boolean),
        ...(Array.isArray(after.assignees)
          ? after.assignees.map((a: any) => (typeof a === 'string' ? a : a?.displayName || a?.email)).filter(Boolean)
          : []),
      ]),
    );

    const subject = `Nueva tarea asignada: ${after?.title || 'Sin título'}`;
    const body = buildTaskAssignmentEmail({
      task: after,
      project,
      assigneeNames,
      ownerLabel,
      accentColor: project?.color,
    });

    if (!accessToken) {
      functions.logger.warn('Skipping task assignment emails: Azure token unavailable', { taskId: context.params.taskId, assignees: maskEmails(assigneeEmails) });
      return null;
    }

    try {
      await sendMailViaGraph(accessToken, subject, body, assigneeEmails, ccRecipients);
      functions.logger.log('Task assignment emails sent', { taskId: context.params.taskId, recipientsCount: assigneeEmails.length, ccCount: ccRecipients.length });
    } catch (err) {
      functions.logger.error('Error sending task assignment emails', { err: String((err as any)?.message || err), recipients: maskEmails(assigneeEmails), cc: maskEmails(ccRecipients) });
    }

    return null;
  }

  // Updated task: detect status change
  if (before && after) {
    const beforeStatus = before.status;
    const afterStatus = after.status;
    if (beforeStatus !== afterStatus) {
      const participants = extractEmails(after.assignees || after.assignedTo ? [after.assignedTo] : []);
      const subject = `Cambio de estado en tarea: ${after?.title || ''}`;
      const body = `<p>La tarea <strong>${after?.title}</strong> cambió de estado de <em>${beforeStatus}</em> a <em>${afterStatus}</em></p>`;
      if (participants.length) {
        if (!accessToken) {
          functions.logger.warn('Skipping task status emails: Azure token unavailable', { taskId: context.params.taskId, participants: maskEmails(participants) });
        } else {
          try {
            await sendMailViaGraph(accessToken, subject, body, participants);
            functions.logger.log('Task status change emails sent', { taskId: context.params.taskId, recipientsCount: participants.length });
          } catch (err) {
            functions.logger.error('Error sending task status emails', { err: String((err as any)?.message || err), recipients: maskEmails(participants) });
          }
        }
      }
    }
  }

  return null;
});

// Callable function: create calendar event for a user (receives {userEmail, event})
export const createCalendarEvent = functions.https.onCall(async (data, context) => {
  const { userEmail, event } = data;
  if (!userEmail || !event) {
    throw new functions.https.HttpsError('invalid-argument', 'userEmail and event are required');
  }
  try {
    const accessToken = await getAppAccessToken();
    if (!accessToken) throw new Error('Azure token not available');
    const created = await createCalendarEventViaGraph(accessToken, userEmail, event);
    return { success: true, event: created };
  } catch (err: any) {
    functions.logger.error('createCalendarEvent error', { err: String(err?.message || err) });
    throw new functions.https.HttpsError('internal', 'Failed to create calendar event');
  }
});

// Callable function: send notification email (general)
export const sendNotificationEmail = functions.https.onCall(async (data, context) => {
  const { to, subject, html } = data;
  if (!to || !subject || !html) {
    throw new functions.https.HttpsError('invalid-argument', 'to, subject and html are required');
  }
  try {
    const accessToken = await getAppAccessToken();
    if (!accessToken) throw new Error('Azure token not available');
    await sendMailViaGraph(accessToken, subject, html, Array.isArray(to) ? to : [to]);
    return { success: true };
  } catch (err) {
    functions.logger.error('sendNotificationEmail error', { err: String((err as any)?.message || err) });
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});

// Callable: validateSiteAccess -> server-side domain validation for the authenticated user
// Payload: { site: 'CORPORATIVO'|'CCCR'|'CCCI'|'CEVP' }
export const validateSiteAccess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const site: string | undefined = data?.site;
  // Optional: the email the client used to sign in (e.g. result.user.email after signInWithPopup)
  const loginEmailRaw: string | undefined = data?.loginEmail;
  const loginEmail = loginEmailRaw ? String(loginEmailRaw).toLowerCase() : undefined;
  // Log presence of loginEmail (mask actual value in logs for privacy)
  try {
    functions.logger.log('validateSiteAccess: loginEmail present?', { hasLoginEmail: !!loginEmail });
  } catch (err) {
    // ignore logging failures
  }
  if (!site) {
    throw new functions.https.HttpsError('invalid-argument', 'site is required');
  }

  const allowedDomains: Record<string, string> = {
    CORPORATIVO: 'grupoheroica.com',
    CCCR: 'costaricacc.com',
    CCCI: 'cccartagena.com',
    CEVP: 'valledelpacifico.co',
  };

  const expectedDomain = allowedDomains[site];
  if (!expectedDomain) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown site: ${site}`);
  }

  const emails = new Set<string>();
  // primary email from token
  try {
    if (context.auth.token && context.auth.token.email) emails.add(String(context.auth.token.email).toLowerCase());
  } catch (err) {
    // ignore
  }

  // fetch user record to get providerData emails when available
  try {
    const userRecord = await admin.auth().getUser(context.auth.uid);
    if (userRecord.email) emails.add(String(userRecord.email).toLowerCase());
    if (Array.isArray(userRecord.providerData)) {
      for (const pd of userRecord.providerData) {
        if ((pd as any).email) emails.add(String((pd as any).email).toLowerCase());
      }
    }
  } catch (err) {
    functions.logger.warn('validateSiteAccess: failed to fetch userRecord', err);
  }

  const expectedLower = expectedDomain.toLowerCase();

  // Helper to check domain match for an email
  const emailMatchesDomain = (e?: string) => {
    if (!e) return false;
    const parts = e.split('@');
    if (parts.length < 2) return false;
    const d = parts[1];
    return d === expectedLower || d.endsWith(`.${expectedLower}`);
  };

  // First, check if any of the canonical emails gathered from token/userRecord/providerData match the expected domain
  const matched = Array.from(emails).some((e) => emailMatchesDomain(e));

  // If not matched, but the client supplied the email that they used to sign in, allow validation based on that
  // This addresses cases where the tenant maps the user's email into an alias (e.g. guest/converted UPN). We still log a warning
  // when the loginEmail is not present in the server-side userRecord/providerData.
  if (!matched && loginEmail) {
    if (emailMatchesDomain(loginEmail)) {
      // Strict mode (option A): require that the provided loginEmail is associated with this authenticated user.
      // Attempt to resolve the user by that email and ensure the uid matches the caller's uid.
      try {
        const found = await admin.auth().getUserByEmail(loginEmail).catch(() => null);
        if (!found) {
          functions.logger.warn('validateSiteAccess: loginEmail not found in Auth', { site, expectedDomain, loginEmail, returnedEmails: Array.from(emails) });
          throw new functions.https.HttpsError('permission-denied', `El correo usado para iniciar sesión (${loginEmail}) no está asociado a la cuenta autenticada.`);
        }
        if (found.uid !== context.auth.uid) {
          functions.logger.warn('validateSiteAccess: loginEmail found but uid mismatch', { site, expectedDomain, loginEmail, foundUid: found.uid, authUid: context.auth.uid });
          throw new functions.https.HttpsError('permission-denied', `El correo usado para iniciar sesión (${loginEmail}) no corresponde al usuario autenticado.`);
        }

        // Associated and matches uid -> accept
        return { success: true, uid: context.auth.uid, emails: Array.from(emails), loginEmail };
      } catch (err: any) {
        // Re-throw HttpsError or wrap others
        if (err instanceof functions.https.HttpsError) throw err;
        functions.logger.warn('validateSiteAccess: error verifying loginEmail association', { err: err?.message || err, site, loginEmail });
        throw new functions.https.HttpsError('internal', 'Error verificando asociación del correo de inicio de sesión');
      }
    }
  }

  if (!matched) {
    // Heuristic: accept aliases where the local-part encodes the original domain (e.g. 'user_costaricacc.com#ext#@other.onmicrosoft.com')
    try {
      const aliasMatch = Array.from(emails).some((e) => {
        const parts = e.split('@');
        if (parts.length < 2) return false;
        const local = parts[0] || '';
        const expectedNoDot = expectedLower.replace(/\./g, '');
        return local.includes(expectedLower) || local.includes(expectedNoDot);
      });
      if (aliasMatch) {
        functions.logger.warn('validateSiteAccess: alias local-part matches expected domain, allowing login with note', { site, expectedDomain, returnedEmails: Array.from(emails) });
        return { success: true, uid: context.auth.uid, emails: Array.from(emails), note: 'validated_via_alias_localpart' };
      }
    } catch (err) {
      // ignore heuristic errors
    }

    functions.logger.warn('validateSiteAccess: domain mismatch', { site, expectedDomain, returnedEmails: Array.from(emails), loginEmail });
    throw new functions.https.HttpsError('permission-denied', `Dominio no autorizado para ${site}. Correos devueltos: ${Array.from(emails).join(', ')}. Debes usar una cuenta de ${expectedDomain}.`, { returnedEmails: Array.from(emails) });
  }

  return { success: true, uid: context.auth.uid, emails: Array.from(emails) };
});

// multiWrite and its replication processor were removed as part of the decommission.
// Clients now write directly to their selected site's Realtime Database. If you need
// server-side replication or atomic multi-db writes in the future, reintroduce a
// focused replication function or use a queue/worker approach.
