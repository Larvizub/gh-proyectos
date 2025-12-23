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

function buildTaskUpdateEmail(task: any, project: any, ownerName: string, assignedUserName?: string, changes: string[] = []): string {
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

  let changesHtml = '';
  if (changes && changes.length > 0) {
    changesHtml = `
      <div class="info-card" style="background-color: #fff7ed; border-left-color: #f97316;">
        <p class="info-label" style="color: #c2410c;">Cambios Recientes</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #431407;">
          ${changes.map(change => `<li>${change}</li>`).join('')}
        </ul>
      </div>
    `;
  }

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
      
      ${changesHtml}

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

function buildProjectOwnerAssignmentEmail(projectName: string, inviterName: string): string {
  return getEmailTemplate(`
    <div class="email-header">
      <div class="logo-container">
        <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
      </div>
      <h1 class="email-title">👑 Nuevo Proyecto Asignado</h1>
      <p class="email-subtitle">Has sido asignado como dueño de un proyecto</p>
    </div>
    
    <div class="email-body">
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
        Hola,
      </p>
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
        <strong>${escapeHtml(inviterName)}</strong> te ha asignado como dueño del proyecto:
      </p>
      
      <div class="info-card">
        <div class="info-label">Proyecto</div>
        <div class="info-value">${escapeHtml(projectName)}</div>
      </div>
      
      <p style="margin: 24px 0 0 0; font-size: 15px; line-height: 1.6; color: #64748b;">
        Como dueño, tienes acceso total para gestionar tareas, miembros y configuraciones del proyecto.
      </p>
      
      <div style="text-align: center;">
        <a href="https://gh-proyectos.web.app/projects" class="cta-button">Ver Proyecto</a>
      </div>
    </div>
    
    <div class="email-footer">
      <p style="margin: 0;">Este es un mensaje automático de la plataforma de Gestión de Proyectos de Grupo Heroica.</p>
    </div>
  `);
}

function buildCharterEmail(charter: any, project: any, isNew: boolean, modifierName: string): string {
  const projectName = escapeHtml(project?.name || charter?.projectName || 'Sin nombre');
  const action = isNew ? 'creada' : 'actualizada';
  const emoji = isNew ? '📄' : '✏️';

  const sections = [
    { label: 'Descripción', value: charter?.projectDescription },
    { label: 'Caso de Negocio', value: charter?.businessCase },
    { label: 'Objetivos', value: charter?.objectives },
    { label: 'Criterios de Éxito', value: charter?.successCriteria },
    { label: 'Gerente del Proyecto', value: charter?.projectManager },
    { label: 'Patrocinador', value: charter?.projectSponsor },
  ].filter(s => s.value);

  const sectionsHtml = sections.map(s => `
    <div style="margin-bottom: 12px;">
      <div class="info-label">${s.label}</div>
      <div style="font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(s.value).substring(0, 200)}${s.value.length > 200 ? '...' : ''}</div>
    </div>
  `).join('');

  return getEmailTemplate(`
    <div class="email-header">
      <div class="logo-container">
        <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
      </div>
      <h1 class="email-title">${emoji} Acta de Constitución ${action}</h1>
      <p class="email-subtitle">Sistema de Gestión de Proyectos</p>
    </div>
    
    <div class="email-body">
      <div class="info-card" style="border-left-color: #3b82f6; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.1) 100%);">
        <div class="info-label" style="color: #1d4ed8;">Proyecto</div>
        <div class="info-value" style="color: #1e40af;">${projectName}</div>
      </div>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin-top: 16px;">
        ${sectionsHtml || '<p style="color: #64748b;">Sin detalles adicionales</p>'}
      </div>

      <div class="info-card" style="margin-top: 16px;">
        <div class="info-label">👤 ${isNew ? 'Creado' : 'Modificado'} por</div>
        <div class="info-value">${escapeHtml(modifierName)}</div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://gh-proyectos.web.app/projects/${charter?.projectId}" class="cta-button">Ver Proyecto</a>
      </div>
    </div>
    
    <div class="email-footer">
      <p style="margin: 0;">Este es un mensaje automático de la plataforma de Gestión de Proyectos de Grupo Heroica.</p>
    </div>
  `);
}

function getRiskScoreLabelEmail(score: number): { label: string; color: string; bgColor: string } {
  if (score <= 4) return { label: 'Bajo', color: '#065f46', bgColor: '#d1fae5' };
  if (score <= 9) return { label: 'Moderado', color: '#92400e', bgColor: '#fef3c7' };
  if (score <= 15) return { label: 'Alto', color: '#c2410c', bgColor: '#ffedd5' };
  return { label: 'Crítico', color: '#991b1b', bgColor: '#fee2e2' };
}

const PROBABILITY_LABELS_EMAIL: Record<string, string> = {
  'very-low': 'Muy Baja', 'low': 'Baja', 'medium': 'Media', 'high': 'Alta', 'very-high': 'Muy Alta',
};

const IMPACT_LABELS_EMAIL: Record<string, string> = {
  'very-low': 'Muy Bajo', 'low': 'Bajo', 'medium': 'Medio', 'high': 'Alto', 'very-high': 'Muy Alto',
};

const CATEGORY_LABELS_EMAIL: Record<string, string> = {
  'technical': 'Técnico', 'external': 'Externo', 'organizational': 'Organizacional', 'project-management': 'Gestión de Proyecto',
};

const RESPONSE_LABELS_EMAIL: Record<string, string> = {
  'avoid': 'Evitar', 'transfer': 'Transferir', 'mitigate': 'Mitigar', 'accept': 'Aceptar',
  'exploit': 'Explotar', 'share': 'Compartir', 'enhance': 'Mejorar',
};

function buildRiskEmail(risk: any, project: any, isNew: boolean, modifierName: string): string {
  const projectName = escapeHtml(project?.name || 'Sin nombre');
  const riskTitle = escapeHtml(risk?.title || 'Sin título');
  const action = isNew ? 'identificado' : 'actualizado';
  const emoji = isNew ? '⚠️' : '🔄';
  
  const scoreInfo = getRiskScoreLabelEmail(risk?.riskScore || 0);
  const probability = PROBABILITY_LABELS_EMAIL[risk?.probability] || risk?.probability || '-';
  const impact = IMPACT_LABELS_EMAIL[risk?.impact] || risk?.impact || '-';
  const category = CATEGORY_LABELS_EMAIL[risk?.category] || risk?.category || '-';
  const response = RESPONSE_LABELS_EMAIL[risk?.responseStrategy] || risk?.responseStrategy || '-';

  return getEmailTemplate(`
    <div class="email-header">
      <div class="logo-container">
        <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
      </div>
      <h1 class="email-title">${emoji} Riesgo ${action}</h1>
      <p class="email-subtitle">${projectName}</p>
    </div>
    
    <div class="email-body">
      <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #1f2937;">${riskTitle}</h2>
      ${risk?.description ? `<p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #6b7280;">${escapeHtml(risk.description).substring(0, 300)}${risk.description.length > 300 ? '...' : ''}</p>` : ''}
      
      <div style="display: flex; justify-content: center; margin-bottom: 20px;">
        <div style="text-align: center; padding: 16px 32px; background-color: ${scoreInfo.bgColor}; border-radius: 12px;">
          <div style="font-size: 32px; font-weight: 700; color: ${scoreInfo.color};">${risk?.riskScore || 0}</div>
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: ${scoreInfo.color}; font-weight: 600;">${scoreInfo.label}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
        <div class="info-card" style="margin-bottom: 0;">
          <div class="info-label">📊 Probabilidad</div>
          <div class="info-value" style="font-size: 14px;">${probability}</div>
        </div>
        <div class="info-card" style="margin-bottom: 0;">
          <div class="info-label">💥 Impacto</div>
          <div class="info-value" style="font-size: 14px;">${impact}</div>
        </div>
        <div class="info-card" style="margin-bottom: 0;">
          <div class="info-label">🏷️ Categoría</div>
          <div class="info-value" style="font-size: 14px;">${category}</div>
        </div>
        <div class="info-card" style="margin-bottom: 0;">
          <div class="info-label">🛡️ Estrategia</div>
          <div class="info-value" style="font-size: 14px;">${response}</div>
        </div>
      </div>

      ${risk?.responsePlan ? `
      <div class="info-card" style="border-left-color: #10b981; background-color: #f0fdf4;">
        <div class="info-label" style="color: #166534;">Plan de Respuesta</div>
        <div style="font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(risk.responsePlan).substring(0, 200)}${risk.responsePlan.length > 200 ? '...' : ''}</div>
      </div>
      ` : ''}

      <div class="info-card">
        <div class="info-label">👤 ${isNew ? 'Identificado' : 'Modificado'} por</div>
        <div class="info-value">${escapeHtml(modifierName)}</div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://gh-proyectos.web.app/risks/${risk?.projectId}" class="cta-button">Ver Matriz de Riesgos</a>
      </div>
    </div>
    
    <div class="email-footer">
      <p style="margin: 0;">Este es un mensaje automático de la plataforma de Gestión de Proyectos de Grupo Heroica.</p>
    </div>
  `);
}

function buildProjectTagsUpdateEmail(projectName: string, modifierName: string, addedTags: string[], removedTags: string[]): string {
  let changesHtml = '';
  
  if (addedTags.length > 0) {
    changesHtml += `
      <div style="margin-bottom: 16px;">
        <div class="info-label" style="color: #10b981;">Tags Agregados</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${addedTags.map(tag => `<span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    `;
  }
  
  if (removedTags.length > 0) {
    changesHtml += `
      <div style="margin-bottom: 16px;">
        <div class="info-label" style="color: #ef4444;">Tags Eliminados</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${removedTags.map(tag => `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-decoration: line-through;">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  return getEmailTemplate(`
    <div class="email-header">
      <div class="logo-container">
        <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
      </div>
      <h1 class="email-title">🏷️ Actualización de Tags</h1>
      <p class="email-subtitle">Se han modificado los tags del proyecto</p>
    </div>
    
    <div class="email-body">
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
        Hola,
      </p>
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
        <strong>${escapeHtml(modifierName)}</strong> ha actualizado los tags del proyecto:
      </p>
      
      <div class="info-card">
        <div class="info-label">Proyecto</div>
        <div class="info-value">${escapeHtml(projectName)}</div>
      </div>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
        ${changesHtml}
      </div>
      
      <div style="text-align: center;">
        <a href="https://gh-proyectos.web.app/projects" class="cta-button">Ver Proyecto</a>
      </div>
    </div>
    
    <div class="email-footer">
      <p style="margin: 0;">Este es un mensaje automático de la plataforma de Gestión de Proyectos de Grupo Heroica.</p>
    </div>
  `);
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

// Helper para detectar cambios en tareas
function getTaskChanges(before: any, after: any): string[] {
  const changes: string[] = [];
  if (!before) return ['Tarea creada'];

  if (before.title !== after.title) changes.push(`Título cambiado: "${before.title}" ➡️ "${after.title}"`);
  if (before.description !== after.description) changes.push('Descripción actualizada');
  
  const statusMap: Record<string, string> = { 'todo': 'Por Hacer', 'in-progress': 'En Progreso', 'completed': 'Completada', 'blocked': 'Bloqueada' };
  if (before.status !== after.status) changes.push(`Estado cambiado: "${statusMap[before.status] || before.status}" ➡️ "${statusMap[after.status] || after.status}"`);
  
  const priorityMap: Record<string, string> = { 'low': 'Baja', 'medium': 'Media', 'high': 'Alta', 'urgent': 'Urgente' };
  if (before.priority !== after.priority) changes.push(`Prioridad cambiada: "${priorityMap[before.priority] || before.priority}" ➡️ "${priorityMap[after.priority] || after.priority}"`);
  
  if (before.dueDate !== after.dueDate) changes.push(`Fecha de vencimiento cambiada: "${formatDate(before.dueDate)}" ➡️ "${formatDate(after.dueDate)}"`);
  
  // Comparar asignados
  const getAssigneeStr = (t: any) => {
    if (Array.isArray(t.assigneeIds)) return t.assigneeIds.sort().join(',');
    if (typeof t.assignedTo === 'string') return t.assignedTo;
    if (t.assignedTo?.userId) return t.assignedTo.userId;
    return '';
  };
  if (getAssigneeStr(before) !== getAssigneeStr(after)) changes.push('Asignación de usuarios actualizada');

  return changes;
}

// Lógica centralizada para notificaciones de tareas
async function handleTaskWrite(change: functions.Change<functions.database.DataSnapshot>, context: functions.EventContext, db: admin.database.Database) {
  const taskId = context.params.taskId;
  const before = change.before.exists() ? change.before.val() : null;
  const after = change.after.exists() ? change.after.val() : null;

  const accessToken = await getAccessToken();
  if (!accessToken) {
    functions.logger.warn('⚠️ No access token available, skipping email');
    return null;
  }

  // --- MANEJO DE ELIMINACIÓN ---
  if (!after) {
    functions.logger.log('🗑️ Task deleted:', taskId);
    if (!before || !before.projectId) return null;

    const projectSnap = await db.ref(`/projects/${before.projectId}`).once('value');
    const project = projectSnap.val();
    if (!project) return null;

    // Recopilar destinatarios (Owner + Asignados)
    const recipients = new Set<string>();
    
    // Owner
    if (project.ownerId) {
      const email = await getUserEmail(project.ownerId, db);
      if (email) recipients.add(email);
    }

    // Asignados (del estado anterior)
    if (before.assigneeIds && Array.isArray(before.assigneeIds)) {
      for (const uid of before.assigneeIds) {
        const email = await getUserEmail(uid, db);
        if (email) recipients.add(email);
      }
    } else if (before.assignedTo) {
       // Legacy support
       const uid = typeof before.assignedTo === 'string' ? before.assignedTo : before.assignedTo.userId;
       if (uid) {
         const email = await getUserEmail(uid, db);
         if (email) recipients.add(email);
       }
    }

    if (recipients.size === 0) return null;

    const subject = `Tarea Eliminada: ${before.title} - ${project.name}`;
    const htmlContent = getEmailTemplate(`
      <div class="email-header">
        <div class="logo-container">
          <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
        </div>
        <h1 class="email-title">Tarea Eliminada</h1>
        <p class="email-subtitle">Sistema de Gestión de Proyectos</p>
      </div>
      
      <div class="email-body">
        <div class="info-card" style="border-left-color: #ef4444; background-color: #fef2f2;">
          <div class="info-label" style="color: #b91c1c;">Tarea Eliminada</div>
          <div class="info-value">La tarea "<strong>${before.title}</strong>" ha sido eliminada del proyecto "${project.name}".</div>
        </div>
      </div>

      <div class="email-footer">
        <p>Este es un mensaje automático, por favor no responder.</p>
        <p>&copy; ${new Date().getFullYear()} Grupo Heroica. Todos los derechos reservados.</p>
      </div>
    `);

    await sendEmail(accessToken, Array.from(recipients), subject, htmlContent);
    return null;
  }

  // --- MANEJO DE CREACIÓN / ACTUALIZACIÓN ---
  const isNewTask = !before;
  const changes = getTaskChanges(before, after);

  // Si es actualización y no hay cambios visibles, ignorar
  if (!isNewTask && changes.length === 0) return null;

  functions.logger.log(`📝 Task ${isNewTask ? 'created' : 'updated'}:`, taskId);

  if (!after.projectId) return null;

  const projectSnap = await db.ref(`/projects/${after.projectId}`).once('value');
  const project = projectSnap.val();
  if (!project) return null;

  // Obtener nombre del owner
  let ownerName = 'Propietario';
  if (project.ownerId) {
    const ownerSnap = await db.ref(`/users/${project.ownerId}`).once('value');
    const ownerData = ownerSnap.val();
    const ownerEmail = await getUserEmail(project.ownerId, db);
    ownerName = ownerData?.displayName || ownerData?.name || ownerEmail || 'Propietario';
  }

  // Recopilar destinatarios
  const recipients = new Set<string>();
  
  // Owner
  if (project.ownerId) {
    const email = await getUserEmail(project.ownerId, db);
    if (email) recipients.add(email);
  }

  // Asignados
  let assignedUserName: string | undefined;
  if (after.assigneeIds && Array.isArray(after.assigneeIds)) {
    for (const uid of after.assigneeIds) {
      const email = await getUserEmail(uid, db);
      if (email) recipients.add(email);
      // Solo tomamos el nombre del primero para el template
      if (!assignedUserName) {
         const uSnap = await db.ref(`/users/${uid}`).once('value');
         assignedUserName = uSnap.val()?.displayName || uSnap.val()?.name || email;
      }
    }
  } else if (after.assignedTo) {
     // Legacy
     const uid = typeof after.assignedTo === 'string' ? after.assignedTo : after.assignedTo.userId;
     if (uid) {
       const email = await getUserEmail(uid, db);
       if (email) recipients.add(email);
       const uSnap = await db.ref(`/users/${uid}`).once('value');
       assignedUserName = uSnap.val()?.displayName || uSnap.val()?.name || email;
     }
  }

  if (recipients.size === 0) return null;

  try {
    const action = isNewTask ? 'creada' : 'actualizada';
    const subject = `Tarea ${action}: ${after.title || 'Sin título'} - ${project.name}`;
    const body = buildTaskUpdateEmail(after, project, ownerName, assignedUserName, changes);
    
    await sendEmail(accessToken, Array.from(recipients), subject, body);
    functions.logger.log(`✅ Task ${action} email sent to:`, Array.from(recipients).join(', '));
  } catch (err) {
    functions.logger.error('❌ Failed to send task email:', err);
  }

  return null;
}

// Lógica centralizada para eliminación de proyectos
async function handleProjectDelete(snap: functions.database.DataSnapshot, context: functions.EventContext, db: admin.database.Database) {
  const project = snap.val();
  if (!project) return null;

  functions.logger.log('🗑️ Project deleted:', project.name);

  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const recipients = new Set<string>();
  
  // Notificar al owner
  if (project.ownerId) {
    const email = await getUserEmail(project.ownerId, db);
    if (email) recipients.add(email);
  }

  // Notificar a miembros (si existen en el modelo de datos)
  if (project.members && Array.isArray(project.members)) {
    for (const uid of project.members) {
      const email = await getUserEmail(uid, db);
      if (email) recipients.add(email);
    }
  }

  if (recipients.size === 0) return null;

  const subject = `Proyecto Eliminado: ${project.name}`;
  const htmlContent = getEmailTemplate(`
    <div class="email-header">
      <div class="logo-container">
        <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
      </div>
      <h1 class="email-title">Proyecto Eliminado</h1>
      <p class="email-subtitle">Sistema de Gestión de Proyectos</p>
    </div>
    
    <div class="email-body">
      <div class="info-card" style="border-left-color: #ef4444; background-color: #fef2f2;">
        <div class="info-label" style="color: #b91c1c;">Proyecto Eliminado</div>
        <div class="info-value">El proyecto "<strong>${project.name}</strong>" ha sido eliminado permanentemente.</div>
      </div>
    </div>

    <div class="email-footer">
      <p>Este es un mensaje automático, por favor no responder.</p>
      <p>&copy; ${new Date().getFullYear()} Grupo Heroica. Todos los derechos reservados.</p>
    </div>
  `);

  await sendEmail(accessToken, Array.from(recipients), subject, htmlContent);
  return null;
}

// --- EXPORTED FUNCTIONS ---

// Default Site
export const onTaskUpdated = functions.database.ref('/tasks/{taskId}').onWrite((c, ctx) => handleTaskWrite(c, ctx, admin.database()));
export const onProjectDeleted = functions.database.ref('/projects/{projectId}').onDelete((s, ctx) => handleProjectDelete(s, ctx, admin.database()));

// CCCR
export const onTaskUpdated_CCCR = functions.database.instance('gh-proyectos-cccr').ref('/tasks/{taskId}').onWrite((c, ctx) => handleTaskWrite(c, ctx, admin.app().database('https://gh-proyectos-cccr.firebaseio.com')));
export const onProjectDeleted_CCCR = functions.database.instance('gh-proyectos-cccr').ref('/projects/{projectId}').onDelete((s, ctx) => handleProjectDelete(s, ctx, admin.app().database('https://gh-proyectos-cccr.firebaseio.com')));

// CCCI
export const onTaskUpdated_CCCI = functions.database.instance('gh-proyectos-ccci').ref('/tasks/{taskId}').onWrite((c, ctx) => handleTaskWrite(c, ctx, admin.app().database('https://gh-proyectos-ccci.firebaseio.com')));
export const onProjectDeleted_CCCI = functions.database.instance('gh-proyectos-ccci').ref('/projects/{projectId}').onDelete((s, ctx) => handleProjectDelete(s, ctx, admin.app().database('https://gh-proyectos-ccci.firebaseio.com')));

// CEVP
export const onTaskUpdated_CEVP = functions.database.instance('gh-proyectos-cevp').ref('/tasks/{taskId}').onWrite((c, ctx) => handleTaskWrite(c, ctx, admin.app().database('https://gh-proyectos-cevp.firebaseio.com')));
export const onProjectDeleted_CEVP = functions.database.instance('gh-proyectos-cevp').ref('/projects/{projectId}').onDelete((s, ctx) => handleProjectDelete(s, ctx, admin.app().database('https://gh-proyectos-cevp.firebaseio.com')));

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

// =============================================
// TRIGGERS PARA ACTA DE CONSTITUCIÓN (CHARTER)
// =============================================

/**
 * Lógica centralizada para notificaciones de Charter
 */
async function handleCharterWrite(change: functions.Change<functions.database.DataSnapshot>, context: functions.EventContext, db: admin.database.Database) {
  const charterId = context.params.charterId;
  const before = change.before.exists() ? change.before.val() : null;
  const after = change.after.exists() ? change.after.val() : null;

  // Si se eliminó, ignorar (no enviamos correo por eliminación de charter)
  if (!after) return null;

  const isNew = !before;
  
  functions.logger.log(`📄 Charter ${isNew ? 'created' : 'updated'}:`, charterId);

  const accessToken = await getAccessToken();
  if (!accessToken) {
    functions.logger.warn('⚠️ No access token available, skipping email');
    return null;
  }

  if (!after.projectId) {
    functions.logger.warn('⚠️ Charter has no projectId, skipping');
    return null;
  }

  // Obtener información del proyecto
  const projectSnap = await db.ref(`/projects/${after.projectId}`).once('value');
  const project = projectSnap.val();
  if (!project) {
    functions.logger.warn('⚠️ Project not found for charter');
    return null;
  }

  // Obtener nombre del modificador
  const modifierId = after.updatedBy || after.createdBy;
  let modifierName = 'Usuario';
  if (modifierId) {
    const modifierSnap = await db.ref(`/users/${modifierId}`).once('value');
    const modifierData = modifierSnap.val();
    modifierName = modifierData?.displayName || modifierData?.name || await getUserEmail(modifierId, db) || 'Usuario';
  }

  // Recopilar destinatarios (owner + owners compartidos + miembros)
  const recipients = new Set<string>();
  
  if (project.ownerId) {
    const email = await getUserEmail(project.ownerId, db);
    if (email) recipients.add(email);
  }

  if (project.owners && Array.isArray(project.owners)) {
    for (const oid of project.owners) {
      const email = await getUserEmail(oid, db);
      if (email) recipients.add(email);
    }
  }

  if (project.memberIds && Array.isArray(project.memberIds)) {
    for (const mid of project.memberIds) {
      const email = await getUserEmail(mid, db);
      if (email) recipients.add(email);
    }
  }

  if (recipients.size === 0) {
    functions.logger.warn('⚠️ No recipients for charter notification');
    return null;
  }

  try {
    const action = isNew ? 'creada' : 'actualizada';
    const subject = `📄 Acta de Constitución ${action}: ${project.name}`;
    const body = buildCharterEmail(after, project, isNew, modifierName);
    
    await sendEmail(accessToken, Array.from(recipients), subject, body);
    functions.logger.log(`✅ Charter ${action} email sent to:`, Array.from(recipients).join(', '));
  } catch (err) {
    functions.logger.error('❌ Failed to send charter email:', err);
  }

  return null;
}

// Default DB
export const onCharterWrite = functions.database.ref('/charters/{charterId}').onWrite((c, ctx) => handleCharterWrite(c, ctx, admin.database()));

// CCCR
export const onCharterWrite_CCCR = functions.database.instance('gh-proyectos-cccr').ref('/charters/{charterId}').onWrite((c, ctx) => handleCharterWrite(c, ctx, admin.app().database('https://gh-proyectos-cccr.firebaseio.com')));

// CCCI
export const onCharterWrite_CCCI = functions.database.instance('gh-proyectos-ccci').ref('/charters/{charterId}').onWrite((c, ctx) => handleCharterWrite(c, ctx, admin.app().database('https://gh-proyectos-ccci.firebaseio.com')));

// CEVP
export const onCharterWrite_CEVP = functions.database.instance('gh-proyectos-cevp').ref('/charters/{charterId}').onWrite((c, ctx) => handleCharterWrite(c, ctx, admin.app().database('https://gh-proyectos-cevp.firebaseio.com')));

// =============================================
// TRIGGERS PARA RIESGOS
// =============================================

/**
 * Lógica centralizada para notificaciones de Riesgos
 */
async function handleRiskWrite(change: functions.Change<functions.database.DataSnapshot>, context: functions.EventContext, db: admin.database.Database) {
  const riskId = context.params.riskId;
  const before = change.before.exists() ? change.before.val() : null;
  const after = change.after.exists() ? change.after.val() : null;

  // Si se eliminó, ignorar (no enviamos correo por eliminación de riesgo)
  if (!after) return null;

  const isNew = !before;
  
  functions.logger.log(`⚠️ Risk ${isNew ? 'created' : 'updated'}:`, riskId);

  const accessToken = await getAccessToken();
  if (!accessToken) {
    functions.logger.warn('⚠️ No access token available, skipping email');
    return null;
  }

  if (!after.projectId) {
    functions.logger.warn('⚠️ Risk has no projectId, skipping');
    return null;
  }

  // Obtener información del proyecto
  const projectSnap = await db.ref(`/projects/${after.projectId}`).once('value');
  const project = projectSnap.val();
  if (!project) {
    functions.logger.warn('⚠️ Project not found for risk');
    return null;
  }

  // Obtener nombre del modificador
  const modifierId = after.updatedBy || after.createdBy;
  let modifierName = 'Usuario';
  if (modifierId) {
    const modifierSnap = await db.ref(`/users/${modifierId}`).once('value');
    const modifierData = modifierSnap.val();
    modifierName = modifierData?.displayName || modifierData?.name || await getUserEmail(modifierId, db) || 'Usuario';
  }

  // Recopilar destinatarios (owner + owners compartidos + responsable del riesgo)
  const recipients = new Set<string>();
  
  if (project.ownerId) {
    const email = await getUserEmail(project.ownerId, db);
    if (email) recipients.add(email);
  }

  if (project.owners && Array.isArray(project.owners)) {
    for (const oid of project.owners) {
      const email = await getUserEmail(oid, db);
      if (email) recipients.add(email);
    }
  }

  // Notificar también al responsable del riesgo si existe
  if (after.ownerId) {
    const riskOwnerEmail = await getUserEmail(after.ownerId, db);
    if (riskOwnerEmail) recipients.add(riskOwnerEmail);
  }

  if (recipients.size === 0) {
    functions.logger.warn('⚠️ No recipients for risk notification');
    return null;
  }

  try {
    const action = isNew ? 'identificado' : 'actualizado';
    const scoreInfo = getRiskScoreLabelEmail(after.riskScore || 0);
    const subject = `⚠️ Riesgo ${action} (${scoreInfo.label}): ${after.title} - ${project.name}`;
    const body = buildRiskEmail(after, project, isNew, modifierName);
    
    await sendEmail(accessToken, Array.from(recipients), subject, body);
    functions.logger.log(`✅ Risk ${action} email sent to:`, Array.from(recipients).join(', '));
  } catch (err) {
    functions.logger.error('❌ Failed to send risk email:', err);
  }

  return null;
}

// Default DB
export const onRiskWrite = functions.database.ref('/risks/{riskId}').onWrite((c, ctx) => handleRiskWrite(c, ctx, admin.database()));

// CCCR
export const onRiskWrite_CCCR = functions.database.instance('gh-proyectos-cccr').ref('/risks/{riskId}').onWrite((c, ctx) => handleRiskWrite(c, ctx, admin.app().database('https://gh-proyectos-cccr.firebaseio.com')));

// CCCI
export const onRiskWrite_CCCI = functions.database.instance('gh-proyectos-ccci').ref('/risks/{riskId}').onWrite((c, ctx) => handleRiskWrite(c, ctx, admin.app().database('https://gh-proyectos-ccci.firebaseio.com')));

// CEVP
export const onRiskWrite_CEVP = functions.database.instance('gh-proyectos-cevp').ref('/risks/{riskId}').onWrite((c, ctx) => handleRiskWrite(c, ctx, admin.app().database('https://gh-proyectos-cevp.firebaseio.com')));

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
 * Data: { 
 *   dbUrl?: string, 
 *   ownerIds?: string[], 
 *   inviteEmails?: string[], 
 *   projectId?: string, 
 *   projectName?: string, 
 *   inviterId?: string,
 *   notificationType?: 'owner-assignment' | 'tags-update',
 *   changes?: { addedTags?: string[], removedTags?: string[] }
 * }
 */
export const inviteOrNotifyOwners = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { 
    dbUrl, 
    ownerIds = [], 
    inviteEmails = [], 
    projectId, 
    projectName, 
    inviterId,
    notificationType = 'owner-assignment',
    changes = {}
  } = data || {};

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
    // Intentar obtener el nombre del invitador/modificador si existe
    let inviterName = 'Un administrador';
    if (inviterId) {
      try {
        const inviterSnap = await db.ref(`users/${inviterId}`).once('value');
        const inviterData = inviterSnap.val();
        if (inviterData?.displayName) inviterName = inviterData.displayName;
        else if (inviterData?.email) inviterName = inviterData.email;
      } catch (e) {
        // ignore error resolving inviter name
      }
    }

    let subject = '';
    let body = '';

    if (notificationType === 'tags-update') {
      subject = `Actualización de tags en proyecto: ${projectName || 'Sin título'}`;
      body = buildProjectTagsUpdateEmail(projectName || 'Sin título', inviterName, changes.addedTags || [], changes.removedTags || []);
    } else {
      // Default: owner-assignment
      subject = projectName ? `Has sido asignado como propietario: ${projectName}` : `Has sido asignado como propietario de un proyecto`;
      body = buildProjectOwnerAssignmentEmail(projectName || 'Sin título', inviterName);
    }

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

// Nueva función programada para verificar tareas vencidas o próximas a vencer
export const checkTaskDueDates = functions.pubsub.schedule('every day 08:00').timeZone('America/Costa_Rica').onRun(async (context) => {
  functions.logger.log('⏰ Iniciando verificación diaria de tareas...');

  const sites = [
    { name: 'CORPORATIVO', url: undefined }, // Default DB
    { name: 'CCCR', url: 'https://gh-proyectos-cccr.firebaseio.com' },
    { name: 'CCCI', url: 'https://gh-proyectos-ccci.firebaseio.com' },
    { name: 'CEVP', url: 'https://gh-proyectos-cevp.firebaseio.com' }
  ];

  const accessToken = await getAccessToken();
  if (!accessToken) {
    functions.logger.error('❌ No se pudo obtener token de acceso para enviar correos.');
    return;
  }

  const now = new Date();
  // Normalizar a inicio del día actual (00:00:00)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Inicio de mañana
  const tomorrowStart = todayStart + 86400000;
  // Fin de mañana (inicio de pasado mañana)
  const tomorrowEnd = tomorrowStart + 86400000;

  for (const site of sites) {
    try {
      functions.logger.log(`🔍 Verificando sitio: ${site.name}`);
      // Si url es undefined, usa la base de datos por defecto
      const db = site.url ? admin.app().database(site.url) : admin.database();
      
      const [tasksSnap, projectsSnap] = await Promise.all([
        db.ref('tasks').once('value'),
        db.ref('projects').once('value')
      ]);

      const tasks = tasksSnap.val();
      const projects = projectsSnap.val() || {};

      if (!tasks) continue;

      for (const [taskId, task] of Object.entries(tasks)) {
        const t = task as any;
        // Ignorar tareas sin fecha o completadas
        if (!t.dueDate || t.status === 'completed') continue;

        const dueDate = t.dueDate;
        let shouldNotify = false;
        let emailSubject = '';
        let emailBodyTitle = '';
        let emailMessage = '';

        // Condición 1: Ya venció (es menor al inicio de hoy)
        if (dueDate < todayStart) {
          shouldNotify = true;
          emailSubject = `⚠️ Alerta: Tarea vencida - ${t.title}`;
          emailBodyTitle = 'Tarea Vencida';
          emailMessage = `La tarea "<strong>${t.title}</strong>" está vencida desde el ${formatDate(dueDate)}.`;
        }
        // Condición 2: Vence hoy (está en el rango de hoy)
        else if (dueDate >= todayStart && dueDate < tomorrowStart) {
          shouldNotify = true;
          emailSubject = `🔔 Recordatorio: Tarea vence HOY - ${t.title}`;
          emailBodyTitle = 'Tarea vence hoy';
          emailMessage = `La tarea "<strong>${t.title}</strong>" vence hoy.`;
        }
        // Condición 3: Vence mañana (está en el rango de mañana)
        else if (dueDate >= tomorrowStart && dueDate < tomorrowEnd) {
          shouldNotify = true;
          emailSubject = `🔔 Recordatorio: Tarea próxima a vencer - ${t.title}`;
          emailBodyTitle = 'Tarea próxima a vencer';
          emailMessage = `La tarea "<strong>${t.title}</strong>" vence mañana.`;
        }

        if (shouldNotify && t.assigneeIds && Array.isArray(t.assigneeIds)) {
          const assigneeEmails: string[] = [];
          for (const userId of t.assigneeIds) {
            // Reutilizamos getUserEmail que ya existe en el archivo
            const email = await getUserEmail(userId, db);
            if (email) assigneeEmails.push(email);
          }

          if (assigneeEmails.length > 0) {
            const project = projects[t.projectId];
            const projectName = project ? project.name : 'Sin proyecto';

            const content = `
              <div class="email-header">
                <div class="logo-container">
                  <img src="https://costaricacc.com/cccr/Logoheroica.png" alt="Logo Heroica" class="logo-img" />
                </div>
                <h1 class="email-title">${emailBodyTitle}</h1>
                <p class="email-subtitle">Sistema de Gestión de Proyectos</p>
              </div>
              
              <div class="email-body">
                <div class="info-card">
                  <div class="info-value" style="font-weight: normal;">${emailMessage}</div>
                </div>

                <div style="margin-top: 24px; padding: 0 8px;">
                  <div style="margin-bottom: 16px;">
                    <div class="info-label">Proyecto</div>
                    <div class="info-value">${projectName}</div>
                  </div>
                  
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                      <div class="info-label">Estado</div>
                      <div class="badge" style="background-color: #e2e8f0; color: #475569; margin: 0;">${t.status}</div>
                    </div>
                    <div>
                      <div class="info-label">Prioridad</div>
                      <div class="badge" style="background-color: #fee2e2; color: #991b1b; margin: 0;">${t.priority}</div>
                    </div>
                  </div>
                </div>

                <div style="text-align: center;">
                  <a href="https://gh-proyectos.web.app/" class="cta-button" style="display: inline-block; background-color: #F2B05F; color: #273c2a; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Ver Tarea</a>
                </div>
              </div>
              
              <div class="email-footer">
                <p>Este es un mensaje automático, por favor no responder.</p>
                <p>&copy; ${new Date().getFullYear()} Grupo Heroica. Todos los derechos reservados.</p>
              </div>
            `;

            const htmlContent = getEmailTemplate(content);

            await sendEmail(accessToken, assigneeEmails, emailSubject, htmlContent);
            functions.logger.log(`📧 Notificación enviada para tarea ${taskId} a ${assigneeEmails.join(', ')}`);
          }
        }
      }
    } catch (err) {
      functions.logger.error(`❌ Error procesando sitio ${site.name}:`, err);
    }
  }
  
  functions.logger.log('✅ Verificación diaria completada.');
});
	