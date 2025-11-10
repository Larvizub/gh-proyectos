# Reglas de seguridad recomendadas para Firebase

Este repositorio incluye reglas recomendadas para los servicios de Firebase usados por el proyecto:

- `database.rules.json` — Realtime Database rules
- `storage.rules` — Cloud Storage rules

Resumen rápido:
- Se exige autenticación (`auth != null`) para la mayoría de lecturas/escrituras.
- Soporta roles (claim `admin`) para operaciones administrativas.
- Los proyectos tienen `owner` y `members`; solo miembros o admins pueden leer/escribir los datos del proyecto.
- Las tareas (`tasks`) están vinculadas a `projectId`; sólo miembros del proyecto pueden crear/leer/editar tareas.
- Archivos en Storage se organizan por `users/{uid}` y `projects/{projectId}`; los permisos siguen la misma lógica.

Cómo desplegar:

1. Realtime Database

```pwsh
# desde la raíz del repo
firebase deploy --only database --project gh-proyectos
```

2. Cloud Storage

```pwsh
firebase deploy --only storage --project gh-proyectos
```

Pruebas locales / recomendaciones:
- Usar el emulador de Firebase para testear reglas en local: `firebase emulators:start --only database,firestore,storage`.
- Crear usuarios de prueba y claims (admin) para verificar caminos protegidos.
- Antes de subir, validar que la estructura de datos del frontend coincide con las validaciones (por ejemplo, `project.owner`, `task.projectId`, `task.createdBy`).

Notas importantes:
- Si estás usando Realtime Database y Firestore a la vez, decide cuál será la fuente de verdad para `projects` y `tasks` y adapta las reglas en consecuencia.
- Estas reglas usan `auth.token.admin` para roles; añade el claim `admin` desde la consola IAM o mediante `admin.auth().setCustomUserClaims(uid, {admin: true})` en tu backend si necesitas admins.
