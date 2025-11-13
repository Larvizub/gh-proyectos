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

async function sendMailViaGraph(accessToken: string, subject: string, bodyHtml: string, toRecipients: string[]) {
  const msg = {
    message: {
      subject,
      body: { contentType: 'HTML', content: bodyHtml },
      toRecipients: toRecipients.map((email) => ({ emailAddress: { address: email } })),
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

// Trigger: on task created or updated -> notify assignee or on status change
export const onTaskWritten = functions.database.ref('/tasks/{taskId}').onWrite(async (change, context) => {
  const before = change.before.exists() ? change.before.val() : null;
  const after = change.after.exists() ? change.after.val() : null;
  functions.logger.log('Task written', context.params.taskId);

  const accessToken = await getAppAccessTokenSafe();

  // New task
  if (!before && after) {
    const assignees = extractEmails(after.assignees || after.assignedTo ? [after.assignedTo] : []);
    const subject = `Nueva tarea asignada: ${after?.title || 'Sin título'}`;
    const body = `<p>Se ha creado y asignado una tarea: <strong>${after?.title}</strong></p>
      <p>Descripción: ${after?.description || '-'}</p>
      <p>Proyecto: ${after?.projectName || '-'}</p>`;
    if (assignees.length) {
      if (!accessToken) {
        functions.logger.warn('Skipping task assignment emails: Azure token unavailable', { taskId: context.params.taskId, assignees: maskEmails(assignees) });
      } else {
        try {
          await sendMailViaGraph(accessToken, subject, body, assignees);
          functions.logger.log('Task assignment emails sent', { taskId: context.params.taskId, recipientsCount: assignees.length });
        } catch (err) {
          functions.logger.error('Error sending task assignment emails', { err: String((err as any)?.message || err), recipients: maskEmails(assignees) });
        }
      }
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
