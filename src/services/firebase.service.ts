import { database, getDatabaseForSite, resolveDatabase, DATABASE_URLS, functions as cloudFunctions, SiteKey } from '@/config/firebase';
import { ref, push, set, get, update, remove, onValue, off, query, orderByChild, equalTo } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Project, Task, Comment, User } from '@/types';

// Proyectos
export const projectsService = {
  create: async (project: Omit<Project, 'id'>) => {
    const dbToUse = resolveDatabase();
    const projectsRef = ref(dbToUse, 'projects');
    const newProjectRef = push(projectsRef);
    await set(newProjectRef, { ...project, id: newProjectRef.key, createdAt: Date.now() });
    return newProjectRef.key;
  },

  update: async (projectId: string, updates: Partial<Project>) => {
  const dbToUse = resolveDatabase();
  const projectRef = ref(dbToUse, `projects/${projectId}`);
    await update(projectRef, { ...updates, updatedAt: Date.now() });
  },

  delete: async (projectId: string) => {
  const dbToUse = resolveDatabase();
  const projectRef = ref(dbToUse, `projects/${projectId}`);
    await remove(projectRef);
  },

  get: async (projectId: string): Promise<Project | null> => {
  const dbToUse = resolveDatabase();
  const projectRef = ref(dbToUse, `projects/${projectId}`);
  const snapshot = await get(projectRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  getAll: async (): Promise<Project[]> => {
  const dbToUse = resolveDatabase();
  const projectsRef = ref(dbToUse, 'projects');
    const snapshot = await get(projectsRef);
    if (!snapshot.exists()) return [];
    
    const projects: Project[] = [];
    snapshot.forEach((child) => {
      projects.push(child.val());
    });
    return projects;
  },

  listen: (callback: (projects: Project[]) => void) => {
  const dbToUse = resolveDatabase();
  const projectsRef = ref(dbToUse, 'projects');
    onValue(projectsRef, (snapshot) => {
      const projects: Project[] = [];
      snapshot.forEach((child) => {
        projects.push(child.val());
      });
      callback(projects);
    });
    return () => off(projectsRef);
  },
};

// Tareas
export const tasksService = {
  create: async (task: Omit<Task, 'id'>) => {
  const dbToUse = resolveDatabase();
  const tasksRef = ref(dbToUse, 'tasks');
    const newTaskRef = push(tasksRef);
    await set(newTaskRef, { ...task, id: newTaskRef.key });
    return newTaskRef.key;
  },

  update: async (taskId: string, updates: Partial<Task>) => {
  const dbToUse = resolveDatabase();
  const taskRef = ref(dbToUse, `tasks/${taskId}`);
    await update(taskRef, { ...updates, updatedAt: Date.now() });
  },

  delete: async (taskId: string) => {
    const dbToUse = resolveDatabase();
    const taskRef = ref(dbToUse, `tasks/${taskId}`);
    await remove(taskRef);
  },

  get: async (taskId: string): Promise<Task | null> => {
    const s = typeof window !== 'undefined' ? localStorage.getItem('selectedSite') : null;
    const dbToUse = s ? getDatabaseForSite(s as any) : database;
    const taskRef = ref(dbToUse, `tasks/${taskId}`);
    const snapshot = await get(taskRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  getByProject: async (projectId: string): Promise<Task[]> => {
  const dbToUse = resolveDatabase();
  const tasksRef = ref(dbToUse, 'tasks');
  const tasksQuery = query(tasksRef, orderByChild('projectId'), equalTo(projectId));
  const snapshot = await get(tasksQuery);
    
    if (!snapshot.exists()) return [];
    
    const tasks: Task[] = [];
    snapshot.forEach((child) => {
      tasks.push(child.val());
    });
    return tasks;
  },

  listen: (projectId: string, callback: (tasks: Task[]) => void) => {
  const dbToUse = resolveDatabase();
  const tasksRef = ref(dbToUse, 'tasks');
  const tasksQuery = query(tasksRef, orderByChild('projectId'), equalTo(projectId));
    
    onValue(tasksQuery, (snapshot) => {
      const tasks: Task[] = [];
      snapshot.forEach((child) => {
        tasks.push(child.val());
      });
      callback(tasks);
    });
    
    return () => off(tasksQuery);
  },

  // Upload a file to Firebase Storage and attach to the task record
  uploadAttachment: async (taskId: string, file: File, uploadedBy?: string, reference = false) => {
    const storage = getStorage();
    const path = `taskAttachments/${taskId}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, path);

    const snapshot = await uploadBytesResumable(fileRef, file);
    const url = await getDownloadURL(snapshot.ref);

    // Create attachment object
    const attachment = {
      id: snapshot.ref.name,
      name: file.name,
      url,
      uploadedBy: uploadedBy || null,
      createdAt: Date.now(),
      reference
    } as any;

    // Fetch current task attachments and append
    const dbToUse = resolveDatabase();
    const taskRef = ref(dbToUse, `tasks/${taskId}`);
    const snap = await get(taskRef);
    if (!snap.exists()) throw new Error('Task not found');
    const task = snap.val() as Task;
    const existing: any[] = task.attachments || [];
    existing.push(attachment);
    await update(taskRef, { attachments: existing, updatedAt: Date.now() });

    return attachment;
  },

  removeAttachment: async (taskId: string, attachmentId: string) => {
    // Remove attachment metadata from task (does not delete from Storage)
    const dbToUse = resolveDatabase();
    const taskRef = ref(dbToUse, `tasks/${taskId}`);
    const snap = await get(taskRef);
    if (!snap.exists()) throw new Error('Task not found');
    const task = snap.val() as Task;
    const existing: any[] = task.attachments || [];
    const remaining = existing.filter(a => a.id !== attachmentId);
    await update(taskRef, { attachments: remaining, updatedAt: Date.now() });
    return remaining;
  }
};

// Comentarios
export const commentsService = {
  create: async (comment: Omit<Comment, 'id'>) => {
  const dbToUse = resolveDatabase();
  const commentsRef = ref(dbToUse, 'comments');
  const newCommentRef = push(commentsRef);
    const payload = { ...comment, id: newCommentRef.key } as Comment;
    await set(newCommentRef, payload);

    // After creating comment, create notifications for assignees of the task (except the commenter)
    try {
      const taskRef = ref(dbToUse, `tasks/${comment.taskId}`);
      const snap = await get(taskRef);
      if (snap.exists()) {
        const task = snap.val() as Task;
        const assignees: string[] = task.assigneeIds || [];
        const notificationsRef = ref(dbToUse, 'notifications');
        const now = Date.now();

        for (const assigneeId of assignees) {
          if (!assigneeId || assigneeId === comment.userId) continue;
          const newNotifRef = push(notificationsRef);
          const notif = {
            id: newNotifRef.key,
            userId: assigneeId,
            type: 'comment-added',
            title: `Nuevo comentario en tarea`,
            message: `${payload.userDisplayName || 'Alguien'}: ${payload.content?.slice(0,120)}`,
            read: false,
            relatedId: task.id,
            createdAt: now
          } as any;
          await set(newNotifRef, notif);
        }
      }
    } catch (err) {
      // no bloquear la creación de comentarios por fallos en notificaciones
      console.warn('Failed to create notifications for comment', err);
    }

    return newCommentRef.key;
  },

  update: async (commentId: string, updates: Partial<Comment>) => {
  const dbToUse = resolveDatabase();
  const commentRef = ref(dbToUse, `comments/${commentId}`);
    await update(commentRef, { ...updates, updatedAt: Date.now() });
  },

  delete: async (commentId: string) => {
  const dbToUse = resolveDatabase();
  const commentRef = ref(dbToUse, `comments/${commentId}`);
    await remove(commentRef);
  },

  getByTask: async (taskId: string): Promise<Comment[]> => {
  const dbToUse = resolveDatabase();
  const commentsRef = ref(dbToUse, 'comments');
  const commentsQuery = query(commentsRef, orderByChild('taskId'), equalTo(taskId));
    const snapshot = await get(commentsQuery);
    
    if (!snapshot.exists()) return [];
    
    const comments: Comment[] = [];
    snapshot.forEach((child) => {
      comments.push(child.val());
    });
    return comments.sort((a, b) => a.createdAt - b.createdAt);
  },

  listen: (taskId: string, callback: (comments: Comment[]) => void) => {
  const dbToUse = resolveDatabase();
  const commentsRef = ref(dbToUse, 'comments');
  const commentsQuery = query(commentsRef, orderByChild('taskId'), equalTo(taskId));
    
    onValue(commentsQuery, (snapshot) => {
      const comments: Comment[] = [];
      snapshot.forEach((child) => {
        comments.push(child.val());
      });
      callback(comments.sort((a, b) => a.createdAt - b.createdAt));
    });
    
    return () => off(commentsQuery);
  },
};

// Usuarios
export const usersService = {
  create: async (user: User) => {
  const dbToUse = resolveDatabase();
  const userRef = ref(dbToUse, `users/${user.id}`);
    await set(userRef, user);
  },

  update: async (userId: string, updates: Partial<User>) => {
  const dbToUse = resolveDatabase();
  const userRef = ref(dbToUse, `users/${userId}`);
  await update(userRef, { ...updates, updatedAt: Date.now() });
  },

  get: async (userId: string): Promise<User | null> => {
  const dbToUse = resolveDatabase();
  const userRef = ref(dbToUse, `users/${userId}`);
  const snapshot = await get(userRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  getAll: async (): Promise<User[]> => {
  const dbToUse = resolveDatabase();
  const usersRef = ref(dbToUse, 'users');
  const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];
    
    const users: User[] = [];
    snapshot.forEach((child) => {
      users.push(child.val());
    });
    return users;
  },
  delete: async (userId: string) => {
  const dbToUse = resolveDatabase();
  const userRef = ref(dbToUse, `users/${userId}`);
    await remove(userRef);
  },
};

// Roles
export type Role = {
  id: string;
  name: string;
  modules?: Record<string, { observe?: boolean; interact?: boolean }>; // e.g. { projects: { observe: true, interact: false } }
  createdAt?: number;
  updatedAt?: number;
};

export const rolesService = {
  create: async (role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>) => {
    const dbToUse = resolveDatabase();
    const rolesRef = ref(dbToUse, 'roles');
    const newRef = push(rolesRef);
    const payload: Role = { ...role as any, id: newRef.key as string, createdAt: Date.now(), updatedAt: Date.now() };
    try {
      await set(newRef, payload);
      return payload;
    } catch (err) {
      // fallback: try server-side callable to create the role (handles DB rules)
      try {
        const site = typeof window !== 'undefined' ? (localStorage.getItem('selectedSite') as SiteKey | null) : null;
        const dbUrl = site ? DATABASE_URLS[site] : undefined;
        const fn = httpsCallable(cloudFunctions as any, 'createRole');
        const res = await fn({ role: payload, dbUrl });
        return (res.data as any).role as Role;
      } catch (err2) {
        throw err2;
      }
    }
  },

  update: async (roleId: string, updates: Partial<Role>) => {
    const dbToUse = resolveDatabase();
    const roleRef = ref(dbToUse, `roles/${roleId}`);
    try {
      await update(roleRef, { ...updates, updatedAt: Date.now() });
    } catch (err) {
      // fallback to server callable
      try {
        const site = typeof window !== 'undefined' ? (localStorage.getItem('selectedSite') as SiteKey | null) : null;
        const dbUrl = site ? DATABASE_URLS[site] : undefined;
        const fn = httpsCallable(cloudFunctions as any, 'updateRole');
        const res = await fn({ roleId, updates, dbUrl });
        return (res.data as any).role as Role;
      } catch (err2) {
        throw err2;
      }
    }
  },

  delete: async (roleId: string) => {
    const dbToUse = resolveDatabase();
    const roleRef = ref(dbToUse, `roles/${roleId}`);
    try {
      await remove(roleRef);
    } catch (err) {
      // fallback to callable
      try {
        const site = typeof window !== 'undefined' ? (localStorage.getItem('selectedSite') as SiteKey | null) : null;
        const dbUrl = site ? DATABASE_URLS[site] : undefined;
        const fn = httpsCallable(cloudFunctions as any, 'deleteRole');
        await fn({ roleId, dbUrl });
      } catch (err2) {
        throw err2;
      }
    }
  },

  getAll: async (): Promise<Role[]> => {
    const dbToUse = resolveDatabase();
    const rolesRef = ref(dbToUse, 'roles');
    const snapshot = await get(rolesRef);
    if (!snapshot.exists()) return [];
    const roles: Role[] = [];
    snapshot.forEach((child) => {
      roles.push(child.val());
    });
    return roles;
  },

  get: async (roleId: string): Promise<Role | null> => {
    const dbToUse = resolveDatabase();
    const roleRef = ref(dbToUse, `roles/${roleId}`);
    const snapshot = await get(roleRef);
    return snapshot.exists() ? snapshot.val() : null;
  }
};
