import { PublicClientApplication, Configuration } from '@azure/msal-browser';

// Configuración de MSAL (Microsoft Authentication Library)\
// Se reemplaza estos valores con los de Azure AD
const msalConfig: Configuration = {
    auth: {
        clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID || 'common'}`,
        // Permitir configurar redirectUri explícitamente vía env (útil para puertos localhost y producción)
        redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI || window.location.origin,
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
};

// Inicializar MSAL
export const msalInstance = new PublicClientApplication(msalConfig);

// Algunas versiones de msal-browser requieren llamar initialize() antes de usar ciertas APIs.
// Proporcionar un helper seguro que llame a initialize() si está disponible y lo ignore en caso contrario.
export async function ensureMsalInitialized(): Promise<void> {
    // @ts-ignore
    if (msalInstance && typeof (msalInstance as any).initialize === 'function') {
        try {
            // @ts-ignore
            await (msalInstance as any).initialize();
        } catch (err) {
            // la inicialización puede fallar si ya está inicializado o no es compatible; registrar y continuar
            // eslint-disable-next-line no-console
            console.warn('MSAL initialize() failed or was unnecessary:', err);
        }
    }

    // Si hubo un redirect flow previo (loginRedirect), MSAL expone handleRedirectPromise
    // para que la app procese la respuesta. Llamarla en la inicialización evita que
    // queden respuestas sin procesar que puedan interferir con popups.
    // @ts-ignore
    if (msalInstance && typeof (msalInstance as any).handleRedirectPromise === 'function') {
        try {
            // @ts-ignore
            const result = await (msalInstance as any).handleRedirectPromise();
            if (result) {
                // eslint-disable-next-line no-console
                console.log('[msal] handleRedirectPromise result:', result);
            }
        } catch (err) {
            // Registrar, pero no fallar la inicialización
            // eslint-disable-next-line no-console
            console.warn('MSAL handleRedirectPromise error (non-fatal):', err);
        }
    }
}

// Exportar el redirectUri usado para que los llamadores puedan inspeccionarlo/verificarlo en tiempo de ejecución
export const msalRedirectUri = msalConfig.auth?.redirectUri;

// Registrar el redirectUri resuelto temprano para que sea visible en la consola del navegador durante el desarrollo
// Esto ayuda a diagnosticar AADSTS900971 (No se proporcionó una dirección de respuesta)
try {
    // eslint-disable-next-line no-console
    console.warn('[msal] resolved redirectUri =', msalRedirectUri);
} catch (e) {
    // ignorar
}

// Scopes necesarios para Microsoft Graph
export const loginRequest = {
    scopes: ['User.Read', 'Mail.Send', 'Calendars.ReadWrite'],
};

export const graphConfig = {
    graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
    graphMailEndpoint: 'https://graph.microsoft.com/v1.0/me/sendMail',
    graphCalendarEndpoint: 'https://graph.microsoft.com/v1.0/me/calendar/events',
};
