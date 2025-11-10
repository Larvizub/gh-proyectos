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

  const accessToken = await getAppAccessToken();

  const subject = `Nuevo proyecto creado: ${project?.name || 'Sin título'}`;
  const participants = extractEmails(project?.participants || project?.members || []);
  if (participants.length === 0) return null;

  const body = `<p>Se ha creado un nuevo proyecto: <strong>${project?.name}</strong></p>
    <p>Descripción: ${project?.description || '-'}</p>
    <p>Vea el proyecto en la plataforma.</p>`;

  try {
    await sendMailViaGraph(accessToken, subject, body, participants);
    functions.logger.log('Project creation emails sent to', participants);
  } catch (err) {
    functions.logger.error('Error sending project creation emails', err);
  }

  return null;
});

// Trigger: on task created or updated -> notify assignee or on status change
export const onTaskWritten = functions.database.ref('/tasks/{taskId}').onWrite(async (change, context) => {
  const before = change.before.exists() ? change.before.val() : null;
  const after = change.after.exists() ? change.after.val() : null;
  functions.logger.log('Task written', context.params.taskId);

  const accessToken = await getAppAccessToken();

  // New task
  if (!before && after) {
    const assignees = extractEmails(after.assignees || after.assignedTo ? [after.assignedTo] : []);
    const subject = `Nueva tarea asignada: ${after?.title || 'Sin título'}`;
    const body = `<p>Se ha creado y asignado una tarea: <strong>${after?.title}</strong></p>
      <p>Descripción: ${after?.description || '-'}</p>
      <p>Proyecto: ${after?.projectName || '-'}</p>`;
    if (assignees.length) {
      try {
        await sendMailViaGraph(accessToken, subject, body, assignees);
        functions.logger.log('Task assignment emails sent', assignees);
      } catch (err) {
        functions.logger.error('Error sending task assignment emails', err);
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
        try {
          await sendMailViaGraph(accessToken, subject, body, participants);
          functions.logger.log('Task status change emails sent', participants);
        } catch (err) {
          functions.logger.error('Error sending task status emails', err);
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
    const created = await createCalendarEventViaGraph(accessToken, userEmail, event);
    return { success: true, event: created };
  } catch (err: any) {
    functions.logger.error('createCalendarEvent error', err.message || err);
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
    await sendMailViaGraph(accessToken, subject, html, Array.isArray(to) ? to : [to]);
    return { success: true };
  } catch (err) {
    functions.logger.error('sendNotificationEmail error', err);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});
