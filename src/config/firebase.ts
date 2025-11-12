import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { getFunctions } from 'firebase/functions';

// Configuración de Firebase
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

// Servicios
export const auth = getAuth(app);
// Base de datos principal (CORPORATIVO)
export const database = getDatabase(app, import.meta.env.VITE_FIREBASE_DATABASE_URL);
// Especificar la región de las Cloud Functions
export const functions = getFunctions(app, 'us-central1');

export type SiteKey = 'CORPORATIVO' | 'CCCR' | 'CCCI' | 'CEVP';

// Mapeo de sitios a URLs de bases de datos
const DATABASE_URLS: Record<SiteKey, string> = {
  CORPORATIVO: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  CCCR: import.meta.env.VITE_FIREBASE_DATABASE_URL_CCCR,
  CCCI: import.meta.env.VITE_FIREBASE_DATABASE_URL_CCCI,
  CEVP: import.meta.env.VITE_FIREBASE_DATABASE_URL_CEVP,
};

// Cache de instancias de base de datos
const databaseInstances = new Map<SiteKey, Database>();

/**
 * Obtiene la instancia de base de datos para el sitio especificado
 * Cachea las instancias para reutilizarlas
 */
export function getDatabaseForSite(site: SiteKey): Database {
  // Si ya existe en el cache, retornarla
  if (databaseInstances.has(site)) {
    return databaseInstances.get(site)!;
  }
  
  // Crear nueva instancia
  const dbUrl = DATABASE_URLS[site];
  if (!dbUrl) {
    console.error(`No database URL found for site: ${site}`);
    return database; // Fallback a la base de datos principal
  }
  
  const dbInstance = getDatabase(app, dbUrl);
  databaseInstances.set(site, dbInstance);
  
  return dbInstance;
}

/**
 * Resuelve la instancia de Database a usar en cliente según la selección del usuario.
 * Si existe `localStorage.selectedSite` y coincide con un SiteKey conocido, retorna
 * la instancia asociada; en otro caso retorna la base de datos por defecto `database`.
 */
export function resolveDatabase(): Database {
  try {
    if (typeof window === 'undefined') return database;
    const s = localStorage.getItem('selectedSite') as SiteKey | null;
    if (s && DATABASE_URLS[s]) {
      return getDatabaseForSite(s);
    }
  } catch (err) {
    // Si falla por cualquier motivo (e.g., acceso a localStorage en entorno protegido), usar por defecto
    console.warn('resolveDatabase: could not read selectedSite from localStorage, falling back to default database', err);
  }
  return database;
}

export default app;
