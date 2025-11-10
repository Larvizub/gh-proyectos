import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';

// Configuración de Firebase
// Reemplaza estos valores con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
export const auth = getAuth(app);
export const database = getDatabase(app);
export const functions = getFunctions(app);

type SiteKey = 'CORPORATIVO' | 'CCCR' | 'CCCI' | 'CEVP';

const siteDatabaseUrls: Record<SiteKey, string> = {
  CORPORATIVO: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  CCCR: import.meta.env.VITE_FIREBASE_DATABASE_URL_CCCR,
  CCCI: import.meta.env.VITE_FIREBASE_DATABASE_URL_CCCI,
  CEVP: import.meta.env.VITE_FIREBASE_DATABASE_URL_CEVP,
};

const appsCache: Record<string, FirebaseApp> = {};

export function getDatabaseForSite(site: SiteKey) {
  const url = siteDatabaseUrls[site];
  if (!url) {
    throw new Error(`Database URL not configured for site ${site}`);
  }

  const appName = `app_${site}`;

  // If app already initialized, return its database
  try {
    if (appsCache[appName]) {
      return getDatabase(appsCache[appName]);
    }
    // If an app with same name exists in firebase apps, reuse it
    const existing = getApps().find((a) => a.name === appName);
    if (existing) {
      appsCache[appName] = existing;
      return getDatabase(existing);
    }
  } catch (e) {
    // ignore
  }

  // Create a new app instance with overridden databaseURL
  const cfg = { ...firebaseConfig, databaseURL: url } as any;
  const newApp = initializeApp(cfg, appName);
  appsCache[appName] = newApp;
  return getDatabase(newApp);
}

export default app;
