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
    const email = user?.email || null;
    
    if (!email) {
      functions.logger.warn(`⚠️ User ${userId} has no email configured. User data:`, JSON.stringify(user));
    } else {
      functions.logger.log(`📧 Found email for user ${userId}: ${email}`);
    }
    
    return email;
  } catch (err) {
    functions.logger.error('Error fetching user email:', err);
    return null;
  }
}

function getEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        .email-wrapper {
          background-color: #f8fafc;
          padding: 24px;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .email-header {
          background: #ffffff;
          padding: 32px 24px;
          text-align: center;
          border-bottom: 3px solid #F2B05F;
        }
        
        .logo-container {
          margin-bottom: 20px;
        }
        
        .logo-img {
          display: block;
          margin: 0 auto;
          max-width: 200px;
          height: auto;
        }
        
        .email-title {
          color: #273c2a;
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          line-height: 1.2;
        }
        
        .email-subtitle {
          color: #64748b;
          font-size: 14px;
          margin: 8px 0 0 0;
        }
        
        .email-body {
          padding: 32px 24px;
          color: #213547;
        }
        
        .info-card {
          background-color: #f8fafc;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          border-left: 4px solid #F2B05F;
        }
        
        .info-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin: 0 0 4px 0;
          font-weight: 600;
        }
        
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #213547;
          margin: 0;
        }
        
        .badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          margin-right: 8px;
          margin-bottom: 8px;
        }
        
        .footer-text {
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
          margin: 24px 0 0 0;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #F2B05F 0%, #FDCF85 100%);
          color: #273c2a;
          padding: 14px 28px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          margin-top: 24px;
          transition: transform 0.2s;
        }
        
        .email-footer {
          background-color: #f8fafc;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
        }
        
        @media only screen and (max-width: 600px) {
          .email-wrapper {
            padding: 16px !important;
          }
          
          .email-header {
            padding: 24px 16px !important;
          }
          
          .email-body {
            padding: 24px 16px !important;
          }
          
          .email-title {
            font-size: 20px !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          ${content}
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildProjectCreatedEmail(project: any, ownerName: string): string {
  const projectName = escapeHtml(project?.name || 'Nuevo Proyecto');
  const description = escapeHtml(project?.description || 'Sin descripción');
  const startDate = formatDate(project?.startDate);
  const endDate = formatDate(project?.endDate);

  const content = `
    <div class="email-header">
      <div class="logo-container">
        <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
      </div>
      <h1 class="email-title">🎉 Nuevo Proyecto Creado</h1>
      <p class="email-subtitle">Se ha creado un nuevo proyecto en la plataforma</p>
    </div>
    
    <div class="email-body">
      <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: inherit;">${projectName}</h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #64748b;">${description}</p>
      
      <div class="info-card">
        <p class="info-label">👤 Propietario</p>
        <p class="info-value">${escapeHtml(ownerName)}</p>
      </div>
      
      <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
        <div class="info-card" style="flex: 1; min-width: 200px;">
          <p class="info-label">📅 Fecha de Inicio</p>
          <p class="info-value" style="font-size: 14px;">${startDate}</p>
        </div>
        <div class="info-card" style="flex: 1; min-width: 200px;">
          <p class="info-label">🏁 Fecha de Fin</p>
          <p class="info-value" style="font-size: 14px;">${endDate}</p>
        </div>
      </div>
      
      <p class="footer-text">
        Accede a la plataforma para ver todos los detalles, gestionar tareas y colaborar con tu equipo.
      </p>
    </div>
    
    <div class="email-footer">
      <p style="margin: 0;">© ${new Date().getFullYear()} Sistema de Gestión de Proyectos</p>
      <p style="margin: 8px 0 0 0;">Este es un mensaje automático, por favor no responder.</p>
    </div>
  `;

  return getEmailTemplate(content);
}

function buildTaskUpdateEmail(task: any, project: any, ownerName: string, assignedUserName?: string): string {
  const taskTitle = escapeHtml(task?.title || 'Tarea sin título');
  const taskDesc = escapeHtml(task?.description || 'Sin descripción');
  const projectName = escapeHtml(project?.name || 'Proyecto sin nombre');
  const priority = escapeHtml(task?.priority || 'medium');
  const status = escapeHtml(task?.status || 'todo');
  const startDate = formatDate(task?.startDate);
  const dueDate = formatDate(task?.dueDate);

  const priorityConfig: Record<string, { color: string; label: string; emoji: string }> = {
    low: { color: '#10b981', label: 'Baja', emoji: '🟢' },
    medium: { color: '#f59e0b', label: 'Media', emoji: '🟡' },
    high: { color: '#ef4444', label: 'Alta', emoji: '🔴' },
    urgent: { color: '#dc2626', label: 'Urgente', emoji: '🚨' }
  };
  const priorityInfo = priorityConfig[task?.priority] || priorityConfig.medium;

  const statusConfig: Record<string, { color: string; label: string; emoji: string }> = {
    todo: { color: '#64748b', label: 'Por Hacer', emoji: '📋' },
    'in-progress': { color: '#3b82f6', label: 'En Progreso', emoji: '⚙️' },
    completed: { color: '#10b981', label: 'Completada', emoji: '✅' },
    blocked: { color: '#ef4444', label: 'Bloqueada', emoji: '🚫' }
  };
  const statusInfo = statusConfig[task?.status] || statusConfig.todo;

  const content = `
    <div class="email-header">
      <div class="logo-container">
        <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
      </div>
      <h1 class="email-title">Actualización de Tarea</h1>
      <p class="email-subtitle">${projectName}</p>
    </div>
    
    <div class="email-body">
      <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: inherit;">${taskTitle}</h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #64748b;">${taskDesc}</p>
      
      <div style="margin-bottom: 24px;">
        <span class="badge" style="background-color: ${priorityInfo.color}; color: #ffffff;">
          Prioridad: ${priorityInfo.label}
        </span>
        <span class="badge" style="background-color: ${statusInfo.color}; color: #ffffff;">
          Estado: ${statusInfo.label}
        </span>
      </div>
      
      <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
        <div class="info-card" style="flex: 1; min-width: 200px;">
          <p class="info-label">📅 Fecha de Inicio</p>
          <p class="info-value" style="font-size: 14px;">${startDate}</p>
        </div>
        <div class="info-card" style="flex: 1; min-width: 200px;">
          <p class="info-label">⏰ Fecha de Vencimiento</p>
          <p class="info-value" style="font-size: 14px;">${dueDate}</p>
        </div>
      </div>
      
      <div class="info-card">
        <p class="info-label">👤 Propietario del Proyecto</p>
        <p class="info-value">${escapeHtml(ownerName)}</p>
      </div>
      
      ${assignedUserName ? `
      <div class="info-card" style="background: linear-gradient(135deg, rgba(242, 176, 95, 0.15) 0%, rgba(253, 207, 133, 0.15) 100%); border-left-color: #F2B05F;">
        <p class="info-label">👨‍💼 Asignado a</p>
        <p class="info-value" style="color: #273c2a;">${escapeHtml(assignedUserName)}</p>
      </div>
      ` : ''}
      
      <p class="footer-text">
        Accede a la plataforma para ver el estado completo de la tarea, agregar comentarios o actualizar su progreso.
      </p>
    </div>
    
    <div class="email-footer">
      <p style="margin: 0;">© ${new Date().getFullYear()} Sistema de Gestión de Proyectos</p>
      <p style="margin: 8px 0 0 0;">Este es un mensaje automático, por favor no responder.</p>
    </div>
  `;

  return getEmailTemplate(content);
}

function buildCommentNotificationEmail(comment: any, task: any, project: any, commenterName: string): string {
  const taskTitle = escapeHtml(task?.title || 'Tarea sin título');
  const projectName = escapeHtml(project?.name || 'Proyecto sin nombre');
  const commentText = escapeHtml(comment?.content || comment?.text || 'Sin texto');
  const commentDate = formatDate(comment?.createdAt);

  const content = `
    <div class="email-header">
      <div class="logo-container">
        <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
      </div>
      <h1 class="email-title">Nuevo Comentario en Tarea</h1>
      <p class="email-subtitle">${projectName}</p>
    </div>
    
    <div class="email-body">
      <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: inherit;">${taskTitle}</h2>
      
      <div class="info-card" style="background: linear-gradient(135deg, rgba(242, 176, 95, 0.15) 0%, rgba(253, 207, 133, 0.15) 100%); border-left-color: #F2B05F; margin-bottom: 24px;">
        <p class="info-label">💬 Comentario de ${escapeHtml(commenterName)}</p>
        <p style="margin: 8px 0 0 0; font-size: 15px; line-height: 1.6; color: #213547;">${commentText}</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">${commentDate}</p>
      </div>
      
      <p class="footer-text">
        Accede a la plataforma para ver la tarea completa y responder al comentario.
      </p>
    </div>
    
    <div class="email-footer">
      <p style="margin: 0;">© ${new Date().getFullYear()} Sistema de Gestión de Proyectos</p>
      <p style="margin: 8px 0 0 0;">Este es un mensaje automático, por favor no responder.</p>
    </div>
  `;

  return getEmailTemplate(content);
}

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
    const isNewTask = !before;

    functions.logger.log(`📝 Task ${isNewTask ? 'created' : 'updated'}:`, taskId);

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
      const action = isNewTask ? 'creada' : 'actualizada';
      const subject = `Tarea ${action}: ${after.title || 'Sin título'} - ${project.name}`;
      const body = buildTaskUpdateEmail(after, project, ownerName, assignedUserName);
      
      functions.logger.log(`📧 Sending email to ${recipients.length} recipient(s):`, recipients.join(', '));
      
      await sendEmail(accessToken, recipients, subject, body);
      
      functions.logger.log(`✅ Task ${action} email sent successfully to:`, recipients.join(', '));
    } catch (err) {
      functions.logger.error('❌ Failed to send task email:', err);
    }

    return null;
  });

/**
 * Helper function para procesar notificaciones de comentarios
 */
async function processCommentNotification(comment: any, db: admin.database.Database) {
  functions.logger.log('💬 Processing comment notification:', comment.id);
  functions.logger.log('📋 Comment data:', { 
    taskId: comment.taskId, 
    userId: comment.userId,
    content: comment.content?.substring(0, 50)
  });

  if (!comment?.taskId) {
    functions.logger.warn('⚠️ Comment has no taskId, skipping notification');
    return;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    functions.logger.warn('⚠️ No access token available, skipping email');
    return;
  }

  // Obtener información de la tarea
  const taskSnap = await db.ref(`/tasks/${comment.taskId}`).once('value');
  const task = taskSnap.val();

  if (!task) {
    functions.logger.warn('⚠️ Task not found for comment, skipping email');
    return;
  }

  functions.logger.log('📝 Task found:', { 
    id: task.id, 
    title: task.title,
    projectId: task.projectId,
    assigneeIds: task.assigneeIds
  });

  // Obtener información del proyecto
  const projectSnap = await db.ref(`/projects/${task.projectId}`).once('value');
  const project = projectSnap.val();

  if (!project) {
    functions.logger.warn('⚠️ Project not found for task, skipping email');
    return;
  }

  functions.logger.log('📁 Project found:', { 
    id: project.id, 
    name: project.name,
    ownerId: project.ownerId
  });

  // Obtener información del comentarista
  const commenterSnap = await db.ref(`/users/${comment.userId}`).once('value');
  const commenterData = commenterSnap.val();
  const commenterName = commenterData?.displayName || commenterData?.name || comment.userDisplayName || 'Usuario';

  // Recolectar destinatarios: owner del proyecto y usuarios asignados
  // Se notifica a TODOS los involucrados (incluyendo al autor del comentario)
  const recipients: string[] = [];

  // Email del owner del proyecto
  if (project.ownerId) {
    const ownerEmail = await getUserEmail(project.ownerId, db);
    if (ownerEmail) {
      recipients.push(ownerEmail);
      functions.logger.log('👤 Added project owner to recipients:', ownerEmail);
    }
  }

  // Emails de los usuarios asignados
  // Soporte para assigneeIds (array) y assignedTo (legacy)
  const assigneeIds: string[] = [];
  
  if (Array.isArray(task.assigneeIds)) {
    assigneeIds.push(...task.assigneeIds);
  } else if (task.assignedTo) {
    // Legacy support
    if (typeof task.assignedTo === 'string') {
      assigneeIds.push(task.assignedTo);
    } else if (task.assignedTo.userId) {
      assigneeIds.push(task.assignedTo.userId);
    }
  }

  functions.logger.log('👥 Processing assignees:', assigneeIds);

  for (const assigneeId of assigneeIds) {
    if (assigneeId) {
      const assignedEmail = await getUserEmail(assigneeId, db);
      if (assignedEmail && !recipients.includes(assignedEmail)) {
        recipients.push(assignedEmail);
        functions.logger.log('👤 Added assignee to recipients:', assignedEmail);
      }
    }
  }

  if (recipients.length === 0) {
    functions.logger.warn('⚠️ No valid recipients found for comment notification');
    functions.logger.log('Debug info:', {
      projectOwnerId: project.ownerId,
      commentUserId: comment.userId,
      assigneeIds: assigneeIds,
      taskAssigneeIds: task.assigneeIds
    });
    return;
  }

  // Enviar correo
  try {
    const subject = `Nuevo comentario en: ${task.title || 'Tarea'} - ${project.name}`;
    const body = buildCommentNotificationEmail(comment, task, project, commenterName);
    
    functions.logger.log(`📧 Sending comment notification to ${recipients.length} recipient(s):`, recipients.join(', '));
    
    await sendEmail(accessToken, recipients, subject, body);
    
    functions.logger.log('✅ Comment notification email sent successfully');
  } catch (err) {
    functions.logger.error('❌ Failed to send comment notification email:', err);
  }
}

/**
 * Trigger: Se ejecuta cuando se crea un nuevo comentario (base de datos por defecto)
 */
export const onCommentCreated = functions.database
  .ref('/comments/{commentId}')
  .onCreate(async (snapshot, context) => {
    const comment = snapshot.val();
    await processCommentNotification(comment, admin.database());
    return null;
  });

/**
 * Trigger: Se ejecuta cuando se crea un nuevo comentario en CCCR
 */
export const onCommentCreated_CCCR = functions.database
  .instance('gh-proyectos-cccr')
  .ref('/comments/{commentId}')
  .onCreate(async (snapshot, context) => {
    const comment = snapshot.val();
    const dbUrl = 'https://gh-proyectos-cccr.firebaseio.com';
    await processCommentNotification(comment, admin.app().database(dbUrl));
    return null;
  });

/**
 * Trigger: Se ejecuta cuando se crea un nuevo comentario en CCCI
 */
export const onCommentCreated_CCCI = functions.database
  .instance('gh-proyectos-ccci')
  .ref('/comments/{commentId}')
  .onCreate(async (snapshot, context) => {
    const comment = snapshot.val();
    const dbUrl = 'https://gh-proyectos-ccci.firebaseio.com';
    await processCommentNotification(comment, admin.app().database(dbUrl));
    return null;
  });

/**
 * Trigger: Se ejecuta cuando se crea un nuevo comentario en CEVP
 */
export const onCommentCreated_CEVP = functions.database
  .instance('gh-proyectos-cevp')
  .ref('/comments/{commentId}')
  .onCreate(async (snapshot, context) => {
    const comment = snapshot.val();
    const dbUrl = 'https://gh-proyectos-cevp.firebaseio.com';
    await processCommentNotification(comment, admin.app().database(dbUrl));
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

/**
 * Callable: Invita por email a direcciones no registradas y/o notifica por correo a ownerIds
 * Data: { dbUrl?: string, ownerIds?: string[], inviteEmails?: string[], projectId?: string, projectName?: string, inviterId?: string }
 */
export const inviteOrNotifyOwners = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { dbUrl, ownerIds = [], inviteEmails = [], projectId, projectName, inviterId } = data || {};

  const db = dbUrl ? admin.app().database(dbUrl) : admin.database();

  // Create invitation records for inviteEmails
  const createdInvites: any[] = [];
  try {
    for (const emailRaw of inviteEmails || []) {
      const email = String(emailRaw || '').toLowerCase().trim();
      if (!email) continue;
      const newRef = db.ref('admin/invitations').push();
      const payload = { id: newRef.key, email, projectId: projectId || null, invitedBy: inviterId || (context.auth.uid || null), createdAt: Date.now(), status: 'pending' };
      await newRef.set(payload);
      createdInvites.push(payload);
    }
  } catch (err) {
    functions.logger.error('Error creating invitations', err);
    // don't fail hard; continue to attempt emails
  }

  // Resolve owner emails from ownerIds
  const recipientEmails: string[] = [];
  try {
    for (const oid of ownerIds || []) {
      try {
        const e = await getUserEmail(oid, db);
        if (e && !recipientEmails.includes(e)) recipientEmails.push(e);
      } catch (err) {
        functions.logger.warn('Failed to resolve email for ownerId', oid, err);
      }
    }
  } catch (err) {
    functions.logger.error('Error resolving owner emails', err);
  }

  // Include explicit inviteEmails as recipients so invites also receive email if desired
  for (const ie of inviteEmails || []) {
    const em = String(ie || '').toLowerCase().trim();
    if (em && !recipientEmails.includes(em)) recipientEmails.push(em);
  }

  // Send email via Graph if possible
  const accessToken = await getAccessToken();
  if (!accessToken) {
    functions.logger.warn('No access token available; skipping email send');
    return { success: true, invites: createdInvites, recipients: recipientEmails, emailed: false };
  }

  if (recipientEmails.length === 0) {
    functions.logger.log('No recipient emails to send');
    return { success: true, invites: createdInvites, recipients: [], emailed: false };
  }

  try {
    const subject = projectName ? `Has sido asignado como propietario: ${projectName}` : `Has sido asignado como propietario de un proyecto`;
    const body = `<p>Hola,</p><p>Has sido agregado como propietario del proyecto <strong>${escapeHtml(projectName || 'Sin título')}</strong>.</p><p>Ingresa a la plataforma para ver los detalles.</p>`;
    await sendEmail(accessToken, recipientEmails, subject, body);
    functions.logger.log('inviteOrNotifyOwners: email sent to', recipientEmails.join(', '));
    return { success: true, invites: createdInvites, recipients: recipientEmails, emailed: true };
  } catch (err: any) {
    functions.logger.error('inviteOrNotifyOwners: failed to send email', err);
    return { success: false, invites: createdInvites, recipients: recipientEmails, emailed: false, error: err?.message || String(err) };
  }
});

/**
 * Normaliza un email extrayendo el dominio real de formatos UPN de Azure AD guest users
 * Ejemplo: luis.arvizu_costaricacc.com#ext#@cevp.onmicrosoft.com → costaricacc.com
 */
function extractRealDomain(email: string): string | null {
  if (!email) return null;

  const emailLower = email.toLowerCase();
  
  // Si no contiene #ext#, es un email normal
  if (!emailLower.includes('#ext#')) {
    return emailLower.split('@')[1] || null;
  }

  // Es un guest UPN: local_domain#ext#@tenant.onmicrosoft.com
  // Extraer la parte antes de #ext#
  const marker = '#ext#';
  const prefix = emailLower.split(marker)[0];

  // Buscar el último _ para separar local_domain
  const lastUnderscore = prefix.lastIndexOf('_');
  if (lastUnderscore > 0) {
    const domain = prefix.slice(lastUnderscore + 1);
    // Validar que sea un dominio válido (contiene punto)
    if (domain.includes('.')) {
      return domain;
    }
  }

  // Fallback: intentar extraer del formato estándar
  return emailLower.split('@')[1] || null;
}

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

  // Extraer el dominio real (manejando UPNs de guest users)
  const emailDomain = extractRealDomain(loginEmail);
  
  functions.logger.log('🔍 Extracted domain:', { loginEmail, emailDomain, expectedDomain });
  // Antes de rechazar por dominio, verificar si el email está en la lista de "Externos" del sitio
  // Determinar la base de datos correspondiente al sitio (declarada fuera de try para reuso)
  let db: admin.database.Database;
  switch ((site || '').toUpperCase()) {
      case 'CCCR':
        db = admin.app().database('https://gh-proyectos-cccr.firebaseio.com');
        break;
      case 'CCCI':
        db = admin.app().database('https://gh-proyectos-ccci.firebaseio.com');
        break;
      case 'CEVP':
        db = admin.app().database('https://gh-proyectos-cevp.firebaseio.com');
        break;
      default:
        db = admin.database();
    }
  try {
    const loginLower = String(loginEmail).toLowerCase();

    // Helper: intentar reconstruir el email original si viene en formato guest UPN
    function reconstructFromGuest(upn: string): string | null {
      if (!upn || !upn.includes('#ext#')) return null;
      const prefix = upn.split('#ext#')[0];
      const lastUnderscore = prefix.lastIndexOf('_');
      if (lastUnderscore > 0) {
        return `${prefix.slice(0, lastUnderscore)}@${prefix.slice(lastUnderscore + 1)}`.toLowerCase();
      }
      return null;
    }

    const reconstructed = reconstructFromGuest(loginLower);

    // Intentar buscar coincidencias directas en admin/externos
    const externalsSnap = await db.ref('/admin/externos').once('value');
    const externals = externalsSnap.exists() ? externalsSnap.val() : null;
    let isExternalAllowed = false;

    if (externals) {
      // externals es un objeto con ids como keys
      Object.keys(externals).forEach((k) => {
        try {
          const e = externals[k];
          const eEmail = String(e?.email || '').toLowerCase();
          if (!eEmail) return;
          if (eEmail === loginLower) {
            isExternalAllowed = true;
            return;
          }
          if (reconstructed && eEmail === reconstructed) {
            isExternalAllowed = true;
            return;
          }
        } catch (err) {
          // ignore malformed entries
        }
      });
    }

    if (isExternalAllowed) {
      functions.logger.log('✅ External email allowed via admin/externos:', { loginEmail });
      return { success: true, source: 'externos' };
    }
  } catch (err) {
    functions.logger.error('Error checking admin/externos for external access:', err);
    // No abortar aquí: si la comprobación falla, seguiremos con la validación por dominio
  }

  // Antes de rechazar por dominio, comprobar si el email o el usuario asociado tiene tareas/proyectos
  try {
    const loginLower = String(loginEmail).toLowerCase();
    const reconstructed = loginLower.includes('#ext#') ? (function (upn: string) {
      const prefix = upn.split('#ext#')[0];
      const lastUnderscore = prefix.lastIndexOf('_');
      if (lastUnderscore > 0) return `${prefix.slice(0, lastUnderscore)}@${prefix.slice(lastUnderscore + 1)}`.toLowerCase();
      return null;
    })(loginLower) : null;

    // Buscar usuarios con ese email en /users
    const foundUserIds: string[] = [];
    try {
      const usersByEmail = await db.ref('/users').orderByChild('email').equalTo(loginLower).once('value');
      if (usersByEmail.exists()) {
        usersByEmail.forEach((child) => {
          foundUserIds.push(child.key as string);
        });
      }
      if (reconstructed) {
        const usersByRecon = await db.ref('/users').orderByChild('email').equalTo(reconstructed).once('value');
        if (usersByRecon.exists()) {
          usersByRecon.forEach((child) => {
            if (!foundUserIds.includes(child.key as string)) foundUserIds.push(child.key as string);
          });
        }
      }
    } catch (err) {
      functions.logger.warn('Error querying users by email during access check:', err);
    }

    // Escanear tareas para ver si existe alguna asignada al email o a alguno de los userIds encontrados
    try {
      const tasksSnap = await db.ref('/tasks').once('value');
      if (tasksSnap.exists()) {
        let allowedByAssignment = false;
        tasksSnap.forEach((child) => {
          if (allowedByAssignment) return; // early exit
          const t = child.val();

          // Comprobaciones comunes: assignedTo puede ser string (userId) o objeto { userId, ... } o email
          const assigned = t?.assignedTo;
          if (assigned) {
            if (typeof assigned === 'string') {
              // if it's a userId
              if (foundUserIds.includes(assigned)) { allowedByAssignment = true; return; }
              // or stored as email
              if (String(assigned).toLowerCase() === loginLower) { allowedByAssignment = true; return; }
              if (reconstructed && String(assigned).toLowerCase() === reconstructed) { allowedByAssignment = true; return; }
            } else if (typeof assigned === 'object') {
              const aEmail = String(assigned.email || '').toLowerCase();
              const aUserId = String(assigned.userId || '').toLowerCase();
              if (aEmail && (aEmail === loginLower || (reconstructed && aEmail === reconstructed))) { allowedByAssignment = true; return; }
              if (aUserId && foundUserIds.includes(aUserId)) { allowedByAssignment = true; return; }
            }
          }

          // Some tasks use an array of assigneeIds
          const assigneeIds = t?.assigneeIds || t?.assignedUserIds || null;
          if (Array.isArray(assigneeIds)) {
            for (const aid of assigneeIds) {
              if (foundUserIds.includes(aid)) { allowedByAssignment = true; return; }
            }
          }

          // Owner/creator of project reference
          if (t?.projectId) {
            // fetch project and check owner
            try {
              const projSnap = db.ref(`/projects/${t.projectId}`).once('value');
              // Note: not awaiting here to keep flow simple; we'll do synchronous check via value
            } catch (e) {
              // ignore
            }
          }
        });

        if (allowedByAssignment) {
          functions.logger.log('✅ Access allowed because user is assigned to a task in site:', { site, loginEmail });
          return { success: true, source: 'assigned-task' };
        }
      }
    } catch (err) {
      functions.logger.warn('Error scanning tasks for assignment during access check:', err);
    }
    // Si no se permitió por tareas, buscar en proyectos (owner o miembros)
    try {
      const projectsSnap = await db.ref('/projects').once('value');
      if (projectsSnap.exists()) {
        let allowedByProject = false;
        projectsSnap.forEach((child) => {
          if (allowedByProject) return;
          const p = child.val();
          if (!p) return;
          // ownerId
          if (p.ownerId && foundUserIds.includes(p.ownerId)) { allowedByProject = true; return; }
          // members array or collaborators
          const members = p.members || p.collaborators || p.allowedUsers || null;
          if (Array.isArray(members)) {
            for (const m of members) {
              if (foundUserIds.includes(m)) { allowedByProject = true; return; }
            }
          }
        });

        if (allowedByProject) {
          functions.logger.log('✅ Access allowed because user is owner/member of a project in site:', { site, loginEmail });
          return { success: true, source: 'project-membership' };
        }
      }
    } catch (err) {
      functions.logger.warn('Error scanning projects for membership during access check:', err);
    }
  } catch (err) {
    functions.logger.error('Unexpected error during assignment/project check:', err);
  }

  if (!emailDomain || emailDomain !== expectedDomain.toLowerCase()) {
    functions.logger.warn('⚠️ Domain mismatch:', { emailDomain, expectedDomain });
    throw new functions.https.HttpsError(
      'permission-denied',
      `El dominio ${emailDomain || 'desconocido'} no está autorizado para el sitio ${site}. Se requiere ${expectedDomain}`
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
  const isNewTask = !before;

  functions.logger.log(`📝 Task ${isNewTask ? 'created' : 'updated'}:`, taskId);

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
    const action = isNewTask ? 'creada' : 'actualizada';
    const subject = `Tarea ${action}: ${after.title || 'Sin título'} - ${project.name}`;
    const body = buildTaskUpdateEmail(after, project, ownerName, assignedUserName);
    
    functions.logger.log(`📧 Sending email to ${recipients.length} recipient(s):`, recipients.join(', '));
    
    await sendEmail(accessToken, recipients, subject, body);
    
    functions.logger.log(`✅ Task ${action} email sent successfully to:`, recipients.join(', '));
  } catch (err) {
    functions.logger.error('❌ Failed to send task email:', err);
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
