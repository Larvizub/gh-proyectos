# Plataforma de Gestión de Proyectos (PMO)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

Una plataforma integral de gestión de proyectos diseñada para facilitar el seguimiento de tareas, control de cambios, riesgos y lecciones aprendidas. Integra capacidades de Microsoft Graph para notificaciones y autenticación corporativa.

## 🚀 Características Principales

### 📦 Gestión de Proyectos y Tareas
- **CRUD Completo**: Creación y seguimiento detallado de proyectos y tareas.
- **Vistas dinámicas**: Kanban, Lista, Calendario y Diagrama de Gantt para visualización de cronogramas.
- **Subtareas y Dependencias**: Estructura jerárquica para proyectos complejos.
- **Comentarios**: Colaboración en tiempo real en cada tarea.

### 🛡️ Procesos de Gestión (PMO)
- **Control de Cambios**: Registro y aprobación de modificaciones en el alcance del proyecto.
- **Gestión de Riesgos**: Matriz de riesgos con niveles de impacto y probabilidad.
- **Lecciones Aprendidas**: Repositorio de conocimientos para mejora continua.
- **Acta de Constitución**: Generación y consulta de Project Charters.

### 🔐 Seguridad y Autenticación
- **Microsoft Identity**: Autenticación segura mediante MSAL y Azure AD.
- **Gestión de Roles**: Control de acceso granular para administradores y usuarios externos.
- **Multitenancy**: Soporte para múltiples bases de datos según el recinto (CCCR, CCCI, CEVP).

### 📧 Integración y Notificaciones
- **Microsoft Graph**: Envío de notificaciones por correo electrónico y sincronización de calendario.
- **Firebase Functions**: Lógica de servidor escalable para automatización.

## 🛠️ Stack Tecnológico

- **Frontend**: React 19 + TypeScript 5
- **Routing**: React Router 7
- **Gestión de Estado**: Zustand
- **Backend-as-a-Service**: Firebase (Realtime DB, Auth, Hosting, Functions)
- **Componentes UI**: shadcn/ui + Lucide React
- **Estilos**: Tailwind CSS
- **PWA**: Soporte para instalación y funcionamiento offline

## 📋 Requisitos Previos

- **Node.js**: 18.x o superior
- **pnpm**: 10.x o superior
- **Firebase CLI**: `npm install -g firebase-tools`
- **Registro en Azure AD**: Para autenticación y uso de Microsoft Graph

## 🔧 Configuración del Entorno

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd gh-proyectos
```

### 2. Instalar dependencias
```bash
pnpm install
```

### 3. Variables de Entorno
Crea un archivo `.env` en la raíz con la siguiente estructura:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://tu_proyecto.firebaseio.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id

# Microsoft Azure AD
VITE_MSAL_CLIENT_ID=tu_azure_client_id
VITE_MSAL_TENANT_ID=tu_tenant_id
VITE_MSAL_REDIRECT_URI=http://localhost:5173
```

### 4. Configuración de Firebase
Asegúrate de inicializar las funciones de Firebase si planeas realizar deploys:
```bash
cd functions
pnpm install
```

## 📂 Estructura del Proyecto

```text
gh-proyectos/
├── functions/              # Firebase Cloud Functions (Node.js/TS)
│   ├── src/                # Lógica de notificaciones y Microsoft Graph
│   └── lib/                # Código compilado para despliegue
├── public/                 # Recursos públicos y assets de PWA
├── src/
│   ├── assets/             # Imágenes y recursos estáticos
│   ├── components/
│   │   ├── layout/         # Header, Sidebar, Contenedores principales
│   │   ├── projects/       # Modales y formularios de proyectos
│   │   ├── tasks/          # Kanban, Gantt, Calendario, Comentarios
│   │   ├── ui/             # Componentes base (shadcn/ui)
│   │   └── users/          # Perfiles y gestión de usuarios
│   ├── config/             # Configuración de Firebase, MSAL y constantes
│   ├── contexts/           # Proveedores de estado global (Auth, Theme)
│   ├── hooks/              # Hooks personalizados (useTasksCache)
│   ├── pages/              # Vistas principales de la aplicación
│   ├── services/           # Servicios de API (Firebase, Graph)
│   ├── types/              # Interfaces y tipos de TypeScript
│   └── utils/              # Utilidades de fechas y formateo
├── tailwind.config.ts      # Configuración de estilos
├── vite.config.ts          # Configuración de build y PWA
└── firebase.json           # Configuración de despliegue Firebase
```

## 🚀 Desarrollo y Despliegue

```bash
# Iniciar servidor de desarrollo
pnpm dev

# Construir aplicación para producción
pnpm build

# Ejecutar linting
pnpm lint

# Desplegar a Firebase
firebase deploy
```

## 🛡️ Seguridad y Reglas
Para más información sobre las reglas de seguridad de Firebase y el despliegue de políticas de acceso, consulta [README_RULES.md](README_RULES.md).

## 🎨 Temas
La aplicación soporta **Modo Claro** y **Modo Oscuro**, adaptándose automáticamente a las preferencias del sistema o permitiendo la selección manual mediante el `ThemeContext`.

## 🤝 Contribución
Este proyecto sigue estándares estrictos definidos en `.github/instructions/`. Asegúrate de leer `README_RULES.md` antes de realizar cambios significativos.

---
© 2025 Larvizub

