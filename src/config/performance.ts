/**
 * Límites de rendimiento para la aplicación
 * Ajusta estos valores según tus necesidades de escalabilidad
 */

export const PERFORMANCE_LIMITS = {
  // Número máximo de tareas a renderizar por columna en Kanban
  MAX_TASKS_PER_KANBAN_COLUMN: 50,
  
  // Número máximo de proyectos a mostrar sin paginación
  MAX_PROJECTS_WITHOUT_PAGINATION: 100,
  
  // Número máximo de comentarios a cargar inicialmente
  MAX_COMMENTS_INITIAL_LOAD: 50,
  
  // Debounce time para búsquedas (ms)
  SEARCH_DEBOUNCE_MS: 300,
  
  // Timeout para operaciones de Firebase (ms)
  FIREBASE_OPERATION_TIMEOUT: 15000,
  
  // Tamaño máximo de archivo para adjuntos (bytes) - 10MB
  MAX_FILE_SIZE: 10 * 1024 * 1024,
} as const;

/**
 * Configuración de caché
 */
export const CACHE_CONFIG = {
  // Tiempo de vida del caché de usuarios (ms) - 5 minutos
  USERS_CACHE_TTL: 5 * 60 * 1000,
  
  // Tiempo de vida del caché de proyectos (ms) - 2 minutos
  PROJECTS_CACHE_TTL: 2 * 60 * 1000,
} as const;
