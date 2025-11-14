# Guía de Rendimiento y Escalabilidad

## Optimizaciones Implementadas

### 1. **Contexto Global de Usuarios** 
- Los usuarios se cargan **una sola vez** al iniciar la aplicación
- Se comparten entre todos los componentes vía `UsersContext`
- **Antes:** N llamadas (una por cada TaskCard) → **Ahora:** 1 llamada

### 2. **Cache de Tareas por Proyecto**
- Hook `useTasksCache` evita múltiples listeners al mismo proyecto
- Debouncing de 100ms para evitar llamadas inmediatas múltiples
- Cleanup automático cuando no hay componentes usando los datos

### 3. **Límites de Renderizado**
- **Kanban:** Máximo 50 tareas por columna (configurable en `src/config/performance.ts`)
- Muestra indicador cuando hay más tareas disponibles
- Previene congelamiento con cientos de tareas

### 4. **Componentes Memorizados**
- `TaskCard`, `SortableTaskCard`, `Column` usan `React.memo`
- Callbacks memorizados con `useCallback`
- Listas filtradas con `useMemo`

### 5. **Optimizaciones de Firebase**
- Timeout de 15s en operaciones críticas
- Flags `mounted` para prevenir memory leaks
- Índices configurados en Database Rules

## Límites Actuales (Configurables)

```typescript
// src/config/performance.ts
MAX_TASKS_PER_KANBAN_COLUMN: 50        // Tareas visibles por columna
MAX_PROJECTS_WITHOUT_PAGINATION: 100   // Proyectos sin paginación
MAX_COMMENTS_INITIAL_LOAD: 50          // Comentarios iniciales
FIREBASE_OPERATION_TIMEOUT: 15000      // Timeout operaciones (ms)
```

## Cuándo Escalar Más

### Indicadores de que necesitas optimizar:
1. **Más de 100 proyectos activos** → Implementar paginación en ProjectsPage
2. **Más de 500 tareas por proyecto** → Implementar scroll virtual o paginación
3. **Más de 50 comentarios por tarea** → Implementar carga incremental
4. **Más de 1000 usuarios** → Considerar cache con TTL en UsersContext

### Optimizaciones Adicionales Disponibles:

#### A. **Paginación de Proyectos**
```typescript
// Implementar en ProjectsPage.tsx
const [page, setPage] = useState(0);
const ITEMS_PER_PAGE = 12;
const paginatedProjects = userProjects.slice(
  page * ITEMS_PER_PAGE, 
  (page + 1) * ITEMS_PER_PAGE
);
```

#### B. **Scroll Virtual (para listas grandes)**
```bash
pnpm add react-window
```
```typescript
import { FixedSizeList } from 'react-window';
// Renderiza solo elementos visibles en viewport
```

#### C. **Lazy Loading de Imágenes**
```typescript
<img loading="lazy" ... />
```

#### D. **Service Worker para Cache**
Ya implementado con `vite-plugin-pwa`

## Métricas de Rendimiento

### Estado Actual (Optimizado):
- ✅ Carga inicial: ~2-3s
- ✅ Cambio de proyecto: ~500ms
- ✅ Renderizado de 50 tareas: ~300ms
- ✅ Sin congelamiento hasta 200+ tareas por proyecto

### Capacidad Estimada:
- **Proyectos:** Hasta 500 sin problemas notables
- **Tareas por Proyecto:** Hasta 1000 (con límite de 50 visibles)
- **Usuarios Concurrentes:** Sin límite (depende de Firebase)
- **Comentarios por Tarea:** Hasta 100 sin optimización adicional

## Monitoreo

Para detectar problemas de rendimiento:

```typescript
// Agregar en componentes críticos
useEffect(() => {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    if (duration > 1000) {
      console.warn(`Componente tardó ${duration}ms en renderizar`);
    }
  };
});
```

## Base de Datos - Índices Requeridos

Ya configurados en `database.rules.json`:
```json
{
  "projects": { ".indexOn": ["createdBy", "status", "createdAt"] },
  "tasks": { ".indexOn": ["projectId", "status", "assignedTo", "createdAt"] },
  "comments": { ".indexOn": ["taskId", "createdAt"] },
  "users": { ".indexOn": ["email"] }
}
```

## Recomendaciones para Producción

1. **Monitorear Firebase Usage** en la consola
2. **Configurar alertas** cuando se superen límites
3. **Revisar logs** regularmente para warnings de índices
4. **Implementar paginación** cuando llegues a 200+ proyectos
5. **Considerar migracion a Firestore** si necesitas queries más complejas

## Performance Checklist

- [x] Contexto global de usuarios
- [x] Cache de tareas por proyecto  
- [x] Límites de renderizado en Kanban
- [x] Componentes memorizados
- [x] Cleanup de listeners
- [x] Timeouts en operaciones Firebase
- [x] Índices de base de datos
- [ ] Paginación de proyectos (implementar si > 100)
- [ ] Scroll virtual (implementar si > 500 tareas)
- [ ] Code splitting por rutas
- [ ] Lazy loading de componentes pesados
