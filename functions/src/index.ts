import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { ConfidentialClientApplication } from '@azure/msal-node';

admin.initializeApp();

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || functions.config().azure?.client_id;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || functions.config().azure?.tenant_id;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || functions.config().azure?.client_secret;
const GRAPH_SENDER_USER = process.env.GRAPH_SENDER_USER || functions.config().graph?.sender;
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID || !AZURE_CLIENT_SECRET) {
  functions.logger.warn('⚠️ Azure AD credentials not configured. Email notifications will be skipped.');
}

// Cliente MSAL para autenticación con Microsoft Graph
const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID || 'common'}`,
    clientSecret: AZURE_CLIENT_SECRET || '',
  },
};

let cca: ConfidentialClientApplication | null = null;
try {
  if (AZURE_CLIENT_ID && AZURE_TENANT_ID && AZURE_CLIENT_SECRET) {
    cca = new ConfidentialClientApplication(msalConfig as any);
  }
} catch (err) {
  functions.logger.warn('MSAL initialization failed:', err);
}

// ============================================================================
// HELPERS
// ============================================================================

async function getAccessToken(): Promise<string | null> {
  if (!cca) {
    functions.logger.warn('Cannot get access token: MSAL not initialized');
    return null;
  }
  try {
    const tokenResponse = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    } as any);
    return tokenResponse?.accessToken || null;
  } catch (err) {
    functions.logger.error('Failed to acquire access token:', err);
    return null;
  }
}

async function sendEmail(accessToken: string, to: string[], subject: string, bodyHtml: string) {
  const sendUrl = GRAPH_SENDER_USER
    ? `${GRAPH_BASE_URL}/users/${encodeURIComponent(GRAPH_SENDER_USER)}/sendMail`
    : `${GRAPH_BASE_URL}/me/sendMail`;

  const message = {
    message: {
      subject,
      body: { contentType: 'HTML', content: bodyHtml },
      toRecipients: to.map(email => ({ emailAddress: { address: email } })),
    },
  };

  try {
    await axios.post(sendUrl, message, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 20000,
    });
    functions.logger.log('✅ Email sent successfully to:', to.join(', '));
  } catch (err: any) {
    functions.logger.error('❌ Failed to send email:', {
      error: err?.message,
      status: err?.response?.status,
      data: err?.response?.data
    });
    throw err;
  }
}

function escapeHtml(value: any): string {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return 'Sin fecha definida';
  try {
    return new Intl.DateTimeFormat('es-CR', {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(timestamp);
  } catch (err) {
    return new Date(timestamp).toLocaleString('es-CR');
  }
}

async function getUserEmail(userId: string, db: admin.database.Database): Promise<string | null> {
  try {
    const userSnap = await db.ref(`/users/${userId}`).once('value');
    const user = userSnap.val();
    return user?.email || null;
  } catch (err) {
    functions.logger.error('Error fetching user email:', err);
    return null;
  }
}

// ============================================================================
// PLANTILLAS DE CORREO
// ============================================================================

function buildProjectCreatedEmail(project: any, ownerName: string): string {
  const projectName = escapeHtml(project?.name || 'Nuevo Proyecto');
  const description = escapeHtml(project?.description || 'Sin descripción');
  const startDate = formatDate(project?.startDate);
  const endDate = formatDate(project?.endDate);

  return `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:'Inter',system-ui,-apple-system,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="padding:24px;background:linear-gradient(135deg, #2563eb 0%, #1e40af 100%);color:#fff;">
          <h1 style="margin:0;font-size:24px;font-weight:700;">🎉 Nuevo Proyecto Creado</h1>
        </div>
        <div style="padding:32px 24px;">
          <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">${projectName}</h2>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">${description}</p>
          
          <div style="display:grid;gap:16px;margin-bottom:24px;">
            <div style="padding:16px;background:#f1f5f9;border-radius:12px;">
              <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Propietario</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(ownerName)}</p>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div style="padding:16px;background:#f1f5f9;border-radius:12px;">
                <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Fecha Inicio</p>
                <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${startDate}</p>
              </div>
              <div style="padding:16px;background:#f1f5f9;border-radius:12px;">
                <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Fecha Fin</p>
                <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${endDate}</p>
              </div>
            </div>
          </div>
          
          <p style="margin:0;font-size:14px;color:#64748b;">
            Accede a la plataforma para ver todos los detalles y comenzar a colaborar.
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildTaskUpdateEmail(task: any, project: any, ownerName: string, assignedUserName?: string): string {
  const taskTitle = escapeHtml(task?.title || 'Tarea sin título');
  const taskDesc = escapeHtml(task?.description || 'Sin descripción');
  const projectName = escapeHtml(project?.name || 'Proyecto sin nombre');
  const priority = escapeHtml(task?.priority || 'medium');
  const status = escapeHtml(task?.status || 'todo');
  const startDate = formatDate(task?.startDate);
  const dueDate = formatDate(task?.dueDate);

  const priorityColors: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    urgent: '#dc2626'
  };
  const priorityColor = priorityColors[task?.priority] || '#f59e0b';

  const statusColors: Record<string, string> = {
    todo: '#64748b',
    'in-progress': '#3b82f6',
    completed: '#10b981',
    blocked: '#ef4444'
  };
  const statusColor = statusColors[task?.status] || '#64748b';

  return `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:'Inter',system-ui,-apple-system,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="padding:24px;background:linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);color:#fff;">
          <p style="margin:0 0 4px;font-size:14px;opacity:0.9;">Actualización de Tarea</p>
          <h1 style="margin:0;font-size:20px;font-weight:700;">${projectName}</h1>
        </div>
        
        <div style="padding:32px 24px;">
          <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">${taskTitle}</h2>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">${taskDesc}</p>
          
          <div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap;">
            <span style="padding:6px 12px;background:${priorityColor};color:#fff;border-radius:6px;font-size:12px;font-weight:600;">
              Prioridad: ${priority}
            </span>
            <span style="padding:6px 12px;background:${statusColor};color:#fff;border-radius:6px;font-size:12px;font-weight:600;">
              Estado: ${status}
            </span>
          </div>
          
          <div style="display:grid;gap:16px;margin-bottom:24px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div style="padding:16px;background:#f1f5f9;border-radius:12px;">
                <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Fecha Inicio</p>
                <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${startDate}</p>
              </div>
              <div style="padding:16px;background:#f1f5f9;border-radius:12px;">
                <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Fecha Vencimiento</p>
                <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${dueDate}</p>
              </div>
            </div>
            
            <div style="padding:16px;background:#f1f5f9;border-radius:12px;">
              <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Propietario del Proyecto</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(ownerName)}</p>
            </div>
            
            ${assignedUserName ? `
            <div style="padding:16px;background:#ede9fe;border-radius:12px;border:2px solid #8b5cf6;">
              <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#6d28d9;">Asignado a</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#5b21b6;">${escapeHtml(assignedUserName)}</p>
            </div>
            ` : ''}
          </div>
          
          <p style="margin:0;font-size:14px;color:#64748b;">
            Accede a la plataforma para ver el estado completo y continuar con la colaboración.
          </p>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// CLOUD FUNCTIONS
// ============================================================================

/**
 * Trigger: Se ejecuta cuando se crea un nuevo proyecto
 * Notifica al propietario del proyecto por correo electrónico
 */
export const onProjectCreated = functions.database
  .ref('/projects/{projectId}')
  .onCreate(async (snapshot, context) => {
    const projectId = context.params.projectId;
    const project = snapshot.val();

    functions.logger.log('📦 New project created:', projectId);

    // Verificar que exista un owner
    if (!project?.ownerId) {
      functions.logger.warn('⚠️ Project has no ownerId, skipping email');
      return null;
    }

    // Obtener token de acceso
    const accessToken = await getAccessToken();
    if (!accessToken) {
      functions.logger.warn('⚠️ No access token available, skipping email');
      return null;
    }

    // Obtener email del owner
    const ownerEmail = await getUserEmail(project.ownerId, admin.database());
    if (!ownerEmail) {
      functions.logger.warn('⚠️ Owner has no email, skipping notification');
      return null;
    }

    // Obtener nombre del owner
    const ownerSnap = await admin.database().ref(`/users/${project.ownerId}`).once('value');
    const ownerData = ownerSnap.val();
    const ownerName = ownerData?.displayName || ownerData?.name || ownerEmail;

    // Enviar correo
    try {
      const subject = `Nuevo proyecto creado: ${project.name || 'Sin título'}`;
      const body = buildProjectCreatedEmail(project, ownerName);
      
      await sendEmail(accessToken, [ownerEmail], subject, body);
      
      functions.logger.log('✅ Project creation email sent to:', ownerEmail);
    } catch (err) {
      functions.logger.error('❌ Failed to send project creation email:', err);
    }

    return null;
  });

/**
 * Trigger: Se ejecuta cuando se escribe (crea o actualiza) una tarea
 * Notifica al propietario del proyecto y al usuario asignado
 */
export const onTaskUpdated = functions.database
  .ref('/tasks/{taskId}')
  .onWrite(async (change, context) => {
    const taskId = context.params.taskId;
    
    // Si la tarea fue eliminada, no hacer nada
    if (!change.after.exists()) {
      functions.logger.log('📝 Task deleted, skipping notification:', taskId);
      return null;
    }

    const before = change.before.exists() ? change.before.val() : null;
    const after = change.after.val();

    // Si es una creación nueva, no notificar (solo notificar en actualizaciones)
    if (!before) {
      functions.logger.log('📝 Task created, skipping notification:', taskId);
      return null;
    }

    functions.logger.log('📝 Task updated:', taskId);

    // Verificar que la tarea tenga un proyecto asociado
    if (!after?.projectId) {
      functions.logger.warn('⚠️ Task has no projectId, skipping email');
      return null;
    }

    // Obtener token de acceso
    const accessToken = await getAccessToken();
    if (!accessToken) {
      functions.logger.warn('⚠️ No access token available, skipping email');
      return null;
    }

    // Obtener información del proyecto
    const projectSnap = await admin.database().ref(`/projects/${after.projectId}`).once('value');
    const project = projectSnap.val();

    if (!project) {
      functions.logger.warn('⚠️ Project not found, skipping email');
      return null;
    }

    // Obtener email del owner del proyecto
    const ownerEmail = project.ownerId ? await getUserEmail(project.ownerId, admin.database()) : null;
    
    // Obtener información del owner
    let ownerName = 'Propietario';
    if (project.ownerId) {
      const ownerSnap = await admin.database().ref(`/users/${project.ownerId}`).once('value');
      const ownerData = ownerSnap.val();
      ownerName = ownerData?.displayName || ownerData?.name || ownerEmail || 'Propietario';
    }

    // Recopilar emails de destinatarios
    const recipients: string[] = [];
    
    if (ownerEmail) {
      recipients.push(ownerEmail);
    }

    // Obtener email del usuario asignado (si existe)
    let assignedUserName: string | undefined;
    let assignedUserEmail: string | null = null;
    
    if (after.assignedTo) {
      // Si assignedTo es un string (userId)
      if (typeof after.assignedTo === 'string') {
        assignedUserEmail = await getUserEmail(after.assignedTo, admin.database());
        if (assignedUserEmail) {
          const assignedSnap = await admin.database().ref(`/users/${after.assignedTo}`).once('value');
          const assignedData = assignedSnap.val();
          assignedUserName = assignedData?.displayName || assignedData?.name || assignedUserEmail;
        }
      } 
      // Si assignedTo es un objeto con userId
      else if (after.assignedTo.userId) {
        assignedUserEmail = await getUserEmail(after.assignedTo.userId, admin.database());
        if (assignedUserEmail) {
          const assignedSnap = await admin.database().ref(`/users/${after.assignedTo.userId}`).once('value');
          const assignedData = assignedSnap.val();
          assignedUserName = assignedData?.displayName || assignedData?.name || assignedUserEmail;
        }
      }
      
      if (assignedUserEmail && !recipients.includes(assignedUserEmail)) {
        recipients.push(assignedUserEmail);
      }
    }

    // Verificar si hay destinatarios
    if (recipients.length === 0) {
      functions.logger.warn('⚠️ No valid recipients found, skipping email');
      return null;
    }

    // Enviar correo
    try {
      const subject = `Tarea actualizada: ${after.title || 'Sin título'} - ${project.name}`;
      const body = buildTaskUpdateEmail(after, project, ownerName, assignedUserName);
      
      await sendEmail(accessToken, recipients, subject, body);
      
      functions.logger.log('✅ Task update email sent to:', recipients.join(', '));
    } catch (err) {
      functions.logger.error('❌ Failed to send task update email:', err);
    }

    return null;
  });

/**
 * Función HTTP para probar el envío de correos
 * Ejemplo de uso: POST con { "to": "email@example.com", "subject": "Test", "body": "Test body" }
 */
export const sendTestEmail = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { to, subject, body } = data;

  if (!to || !subject || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: to, subject, body');
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new functions.https.HttpsError('unavailable', 'Email service not configured');
  }

  try {
    await sendEmail(accessToken, [to], subject, `<p>${escapeHtml(body)}</p>`);
    return { success: true, message: 'Test email sent successfully' };
  } catch (err: any) {
    throw new functions.https.HttpsError('internal', `Failed to send email: ${err.message}`);
  }
});

// ============================================================================
// FUNCIONES DE AUTENTICACIÓN Y VALIDACIÓN
// ============================================================================

/**
 * Valida que el usuario tenga acceso al sitio seleccionado basado en su dominio de email
 */
export const validateSiteAccess = functions.https.onCall(async (data, context) => {
  const { site, loginEmail } = data;

  functions.logger.log('validateSiteAccess called:', { site, loginEmail, auth: !!context.auth });

  // Mapeo de sitios a dominios permitidos
  const allowedDomains: Record<string, string> = {
    CORPORATIVO: 'grupoheroica.com',
    CCCR: 'costaricacc.com',
    CCCI: 'cccartagena.com',
    CEVP: 'valledelpacifico.co',
  };

  const expectedDomain = allowedDomains[site];
  
  if (!expectedDomain) {
    functions.logger.error('❌ Unknown site:', site);
    throw new functions.https.HttpsError('invalid-argument', 'Sitio desconocido');
  }

  if (!loginEmail) {
    functions.logger.error('❌ No email provided');
    throw new functions.https.HttpsError('invalid-argument', 'Email no proporcionado');
  }

  const emailDomain = loginEmail.split('@')[1]?.toLowerCase();
  
  if (emailDomain !== expectedDomain.toLowerCase()) {
    functions.logger.warn('⚠️ Domain mismatch:', { emailDomain, expectedDomain });
    throw new functions.https.HttpsError(
      'permission-denied',
      `El dominio ${emailDomain} no está autorizado para el sitio ${site}. Se requiere ${expectedDomain}`
    );
  }

  functions.logger.log('✅ Site access validated for:', loginEmail);
  return { success: true };
});

/**
 * Crea o actualiza un usuario en la base de datos del sitio especificado
 */
export const upsertUser = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { site, dbUrl, user } = data;

  if (!user || !user.id) {
    throw new functions.https.HttpsError('invalid-argument', 'User data with id is required');
  }

  functions.logger.log('upsertUser called:', { site, userId: user.id });

  try {
    // Determinar qué base de datos usar
    let db: admin.database.Database;
    
    if (dbUrl) {
      db = admin.app().database(dbUrl);
    } else {
      // Usar la base de datos por defecto
      db = admin.database();
    }

    const userRef = db.ref(`users/${user.id}`);
    const snap = await userRef.once('value');

    if (snap.exists()) {
      // Usuario existe, actualizar solo campos permitidos
      const updates: any = {
        displayName: user.displayName,
        email: user.email,
        updatedAt: Date.now(),
      };

      // Solo actualizar photoURL si se proporciona
      if (user.photoURL !== undefined) {
        updates.photoURL = user.photoURL;
      }

      await userRef.update(updates);
      functions.logger.log('✅ User updated:', user.id);
    } else {
      // Usuario nuevo, crear con rol por defecto
      const newUser: any = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: 'user', // Rol por defecto
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (user.photoURL !== undefined) {
        newUser.photoURL = user.photoURL;
      }

      await userRef.set(newUser);
      functions.logger.log('✅ User created:', user.id);
    }

    return { success: true };
  } catch (err: any) {
    functions.logger.error('❌ upsertUser error:', err);
    throw new functions.https.HttpsError('internal', `Failed to upsert user: ${err.message}`);
  }
});

// ============================================================================
// FUNCIONES ADICIONALES PARA OTRAS INSTANCIAS DE BASE DE DATOS
// ============================================================================

/**
 * Helper: Procesa la actualización de una tarea y envía notificaciones
 */
async function processTaskUpdate(
  db: admin.database.Database,
  change: functions.Change<functions.database.DataSnapshot>,
  taskId: string
) {
  // Si la tarea fue eliminada, no hacer nada
  if (!change.after.exists()) {
    functions.logger.log('📝 Task deleted, skipping notification:', taskId);
    return null;
  }

  const before = change.before.exists() ? change.before.val() : null;
  const after = change.after.val();

  // Si es una creación nueva, no notificar (solo notificar en actualizaciones)
  if (!before) {
    functions.logger.log('📝 Task created, skipping notification:', taskId);
    return null;
  }

  functions.logger.log('📝 Task updated:', taskId);

  // Verificar que la tarea tenga un proyecto asociado
  if (!after?.projectId) {
    functions.logger.warn('⚠️ Task has no projectId, skipping email');
    return null;
  }

  // Obtener token de acceso
  const accessToken = await getAccessToken();
  if (!accessToken) {
    functions.logger.warn('⚠️ No access token available, skipping email');
    return null;
  }

  // Obtener información del proyecto
  const projectSnap = await db.ref(`/projects/${after.projectId}`).once('value');
  const project = projectSnap.val();

  if (!project) {
    functions.logger.warn('⚠️ Project not found, skipping email');
    return null;
  }

  // Obtener email del owner del proyecto
  const ownerEmail = project.ownerId ? await getUserEmail(project.ownerId, db) : null;
  
  // Obtener información del owner
  let ownerName = 'Propietario';
  if (project.ownerId) {
    const ownerSnap = await db.ref(`/users/${project.ownerId}`).once('value');
    const ownerData = ownerSnap.val();
    ownerName = ownerData?.displayName || ownerData?.name || ownerEmail || 'Propietario';
  }

  // Recopilar emails de destinatarios
  const recipients: string[] = [];
  
  if (ownerEmail) {
    recipients.push(ownerEmail);
  }

  // Obtener email del usuario asignado (si existe)
  let assignedUserName: string | undefined;
  let assignedUserEmail: string | null = null;
  
  if (after.assignedTo) {
    // Si assignedTo es un string (userId)
    if (typeof after.assignedTo === 'string') {
      assignedUserEmail = await getUserEmail(after.assignedTo, db);
      if (assignedUserEmail) {
        const assignedSnap = await db.ref(`/users/${after.assignedTo}`).once('value');
        const assignedData = assignedSnap.val();
        assignedUserName = assignedData?.displayName || assignedData?.name || assignedUserEmail;
      }
    } 
    // Si assignedTo es un objeto con userId
    else if (after.assignedTo.userId) {
      assignedUserEmail = await getUserEmail(after.assignedTo.userId, db);
      if (assignedUserEmail) {
        const assignedSnap = await db.ref(`/users/${after.assignedTo.userId}`).once('value');
        const assignedData = assignedSnap.val();
        assignedUserName = assignedData?.displayName || assignedData?.name || assignedUserEmail;
      }
    }
    
    if (assignedUserEmail && !recipients.includes(assignedUserEmail)) {
      recipients.push(assignedUserEmail);
    }
  }

  // Verificar si hay destinatarios
  if (recipients.length === 0) {
    functions.logger.warn('⚠️ No valid recipients found, skipping email');
    return null;
  }

  // Enviar correo
  try {
    const subject = `Tarea actualizada: ${after.title || 'Sin título'} - ${project.name}`;
    const body = buildTaskUpdateEmail(after, project, ownerName, assignedUserName);
    
    await sendEmail(accessToken, recipients, subject, body);
    
    functions.logger.log('✅ Task update email sent to:', recipients.join(', '));
  } catch (err) {
    functions.logger.error('❌ Failed to send task update email:', err);
  }

  return null;
}

/**
 * Triggers para instancias adicionales de base de datos
 */
export const onTaskUpdated_CCCR = functions.database
  .instance('gh-proyectos-cccr')
  .ref('/tasks/{taskId}')
  .onWrite(async (change, context) => {
    try {
      const db = admin.app().database('https://gh-proyectos-cccr.firebaseio.com');
      return await processTaskUpdate(db, change, context.params.taskId);
    } catch (err) {
      functions.logger.error('onTaskUpdated_CCCR error:', err);
      return null;
    }
  });

export const onTaskUpdated_CCCI = functions.database
  .instance('gh-proyectos-ccci')
  .ref('/tasks/{taskId}')
  .onWrite(async (change, context) => {
    try {
      const db = admin.app().database('https://gh-proyectos-ccci.firebaseio.com');
      return await processTaskUpdate(db, change, context.params.taskId);
    } catch (err) {
      functions.logger.error('onTaskUpdated_CCCI error:', err);
      return null;
    }
  });

export const onTaskUpdated_CEVP = functions.database
  .instance('gh-proyectos-cevp')
  .ref('/tasks/{taskId}')
  .onWrite(async (change, context) => {
    try {
      const db = admin.app().database('https://gh-proyectos-cevp.firebaseio.com');
      return await processTaskUpdate(db, change, context.params.taskId);
    } catch (err) {
      functions.logger.error('onTaskUpdated_CEVP error:', err);
      return null;
    }
  });
