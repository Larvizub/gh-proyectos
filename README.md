# Plataforma de Gestión de Proyectos

Una plataforma completa de gestión de proyectos similar a Asana, desarrollada con React, TypeScript, Firebase y Microsoft Graph.

## 🚀 Características

- ✅ **Gestión de Proyectos**: Crea, edita y organiza proyectos
- ✅ **Gestión de Tareas**: CRUD completo con estados, prioridades y asignación
- ✅ **Subtareas y Dependencias**: Organización jerárquica de tareas
- ✅ **Comentarios en Tiempo Real**: Sistema de comentarios con Firebase Realtime Database
- ✅ **Vistas Múltiples**: Lista, Kanban y Calendario
- ✅ **Filtros Avanzados**: Búsqueda y filtrado de tareas y proyectos
- ✅ **Notificaciones**: Email notifications mediante Microsoft Graph
- ✅ **Integración con Outlook**: Sincronización de calendario
- ✅ **Autenticación Microsoft**: Login con cuentas corporativas
- ✅ **Modo Oscuro/Claro**: Tema personalizable
- ✅ **PWA**: Aplicación instalable y con capacidades offline
- ✅ **Responsive Design**: Optimizado para móviles y escritorio

## 🛠️ Stack Tecnológico

- **Frontend**: React 19 + TypeScript
- **Routing**: React Router DOM
- **Estilos**: Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Realtime Database, Authentication, Functions)
- **Autenticación**: Microsoft Graph + MSAL
- **Gestión de Estado**: Zustand
- **Fechas**: date-fns
- **Iconos**: Lucide React
- **PWA**: Vite Plugin PWA

## 📋 Requisitos Previos

- Node.js 18+ 
- pnpm 8+
- Cuenta de Firebase
- Azure AD App Registration (para Microsoft Graph)

## 🔧 Configuración

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd gh-proyectos
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://tu_proyecto.firebaseio.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id

# Microsoft Azure AD Configuration
VITE_MSAL_CLIENT_ID=tu_azure_client_id
VITE_MSAL_TENANT_ID=tu_tenant_id
```

### 4. Configurar Firebase

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar Realtime Database
3. Habilitar Authentication (Microsoft provider)
4. Configurar reglas de seguridad

### 5. Configurar Azure AD

1. Registrar aplicación en [Azure Portal](https://portal.azure.com)
2. Configurar permisos: `User.Read`, `Mail.Send`, `Calendars.ReadWrite`
3. Agregar URI de redirección: `http://localhost:5173`

## 🚀 Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev

# Build para producción
pnpm build

# Preview de producción
pnpm preview

# Linting
pnpm lint
```

## 📱 PWA

La aplicación está configurada como PWA y puede instalarse en dispositivos móviles y escritorio.

## 🎨 Colores del Tema

- **Primario**: #273c2a
- **Primario Claro**: #F2B05F
- **Secundario Oscuro**: #124734
- **Secundario Claro**: #FDCF85
- **Gris**: #B0B3B2

## 📖 Estructura del Proyecto

```
src/
├── components/       # Componentes reutilizables
│   ├── ui/          # Componentes de UI (shadcn)
│   └── layout/      # Componentes de layout
├── pages/           # Páginas de la aplicación
├── contexts/        # Contextos de React
├── services/        # Servicios (Firebase, Graph)
├── hooks/           # Custom hooks
├── types/           # Tipos de TypeScript
├── utils/           # Utilidades
├── lib/             # Librerías y configuraciones
└── config/          # Configuraciones (Firebase, MSAL)
```

## 🤝 Contribución

Este proyecto sigue las instrucciones definidas en `.github/instructions/ghProyect.instructions.md`.

## 📝 Licencia

MIT © 2025 Larvizub


## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
