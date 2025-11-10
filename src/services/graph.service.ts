import { Client } from '@microsoft/microsoft-graph-client';
import { msalInstance } from '@/config/msal';

// Obtener el cliente de Graph autenticado
async function getAuthenticatedClient(): Promise<Client> {
  const accounts = msalInstance.getAllAccounts();
  
  if (accounts.length === 0) {
    throw new Error('No hay cuentas autenticadas');
  }

  const request = {
    scopes: ['User.Read', 'Mail.Send', 'Calendars.ReadWrite'],
    account: accounts[0],
  };

  const response = await msalInstance.acquireTokenSilent(request);

  const client = Client.init({
    authProvider: (done) => {
      done(null, response.accessToken);
    },
  });

  return client;
}

// Obtener información del usuario
export async function getUserProfile() {
  try {
    const client = await getAuthenticatedClient();
    const user = await client.api('/me').get();
    return user;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

// Enviar correo electrónico
export async function sendEmail(to: string[], subject: string, body: string) {
  try {
    const client = await getAuthenticatedClient();
    
    const mail = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: to.map(email => ({
          emailAddress: {
            address: email,
          },
        })),
      },
    };

    await client.api('/me/sendMail').post(mail);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Crear evento en el calendario
export async function createCalendarEvent(
  subject: string,
  start: Date,
  end: Date,
  attendees: string[] = [],
  body?: string
) {
  try {
    const client = await getAuthenticatedClient();
    
    const event = {
      subject,
      body: body ? {
        contentType: 'HTML',
        content: body,
      } : undefined,
      start: {
        dateTime: start.toISOString(),
        timeZone: 'America/Mexico_City',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'America/Mexico_City',
      },
      attendees: attendees.map(email => ({
        emailAddress: {
          address: email,
        },
        type: 'required',
      })),
    };

    const result = await client.api('/me/calendar/events').post(event);
    return result;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

// Actualizar evento del calendario
export async function updateCalendarEvent(
  eventId: string,
  updates: {
    subject?: string;
    start?: Date;
    end?: Date;
    body?: string;
  }
) {
  try {
    const client = await getAuthenticatedClient();
    
    const event: any = {};
    
    if (updates.subject) event.subject = updates.subject;
    if (updates.body) event.body = { contentType: 'HTML', content: updates.body };
    if (updates.start) {
      event.start = {
        dateTime: updates.start.toISOString(),
        timeZone: 'America/Mexico_City',
      };
    }
    if (updates.end) {
      event.end = {
        dateTime: updates.end.toISOString(),
        timeZone: 'America/Mexico_City',
      };
    }

    await client.api(`/me/calendar/events/${eventId}`).patch(event);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
}

// Eliminar evento del calendario
export async function deleteCalendarEvent(eventId: string) {
  try {
    const client = await getAuthenticatedClient();
    await client.api(`/me/calendar/events/${eventId}`).delete();
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
}

// Obtener eventos del calendario
export async function getCalendarEvents(startDate: Date, endDate: Date) {
  try {
    const client = await getAuthenticatedClient();
    
    const events = await client
      .api('/me/calendar/events')
      .filter(
        `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`
      )
      .select('subject,start,end,bodyPreview,attendees')
      .orderby('start/dateTime')
      .get();

    return events.value;
  } catch (error) {
    console.error('Error getting calendar events:', error);
    throw error;
  }
}
