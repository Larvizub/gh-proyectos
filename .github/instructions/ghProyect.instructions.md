---
applyTo: '**/*.ts'
---
# Instrucciones de uso para el proyecto

- Utiliza siempre pnpm.
- Pregunta antes de subir cualquier cambio a github.
- Todos los comentarios de github deben ser en español.
- Utiliza shadcn components para los componentes UI.
- utiliza tailwindcss para los estilos.

# Instrucciones de creación de la plataforma

- Crea una plataforma de gestión de proyectos, similar a Asana, Esta debe tener todas las funcionalidades básicas como:
  - Creación de proyectos
  - Gestión de tareas
  - Asignación de tareas a usuarios
  - Seguimiento del progreso de las tareas
  - Comentarios en las tareas
  - Notificaciones por correo electrónico
  - Integración con calendarios
  - Panel de administración para gestionar usuarios y proyectos
  - Cambiar tipo de vista como lista, tablero kanban, calendario, etc.
  - Filtros y búsqueda avanzada de tareas y proyectos
  - Subtareas y dependencias entre tareas


- La plataforma debe ser desarrollada utilizando las siguientes tecnologías:
  - Frontend: React con TypeScript - Ya está instalado en el proyecto
  - Debe conectarse a Firebase como BaaS y debe utilizar Realtime Database, Authentication y Functions.
  - Utiliza shadcn components para los componentes UI.
  - Utiliza tailwindcss para los estilos.
  - Debe conectarse con microsoft graph para la autenticación de usuarios, el envío de correos electrónicos y la integración con calendarios de outlook.
  - Debe ser responsive y funcionar bien en dispositivos móviles y de escritorio, así como hacer el stand alone para poder instalarlo como una PWA.
  - Debe tener un diseño limpio y moderno, siguiendo las mejores prácticas de UX/UI.
  - Los colores deben ser 0x273c2a y 0xF2B05F para los colores primario y los colores secundarios deben ser 0x124734, 0xFDCF85 y 0xB0B3B2.
  - El logo debe ser el del siguiente link: https://costaricacc.com/cccr/Logoheroica.png y debes hacer una capa para poder usar el logo en modo oscuro y modo claro.
  - La plataforma debe tener modo oscuro y modo claro.


