import { database, getDatabaseForSite, resolveDatabase, DATABASE_URLS, functions as cloudFunctions, SiteKey } from '@/config/firebase';
import { ref, push, set, get, update, remove, onValue, off, query, orderByChild, equalTo } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { getStorage, ref as storageRef, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Project, Task, Comment, User } from '@/types';

// Proyectos
export const projectsService = {
  create: async (project: Omit<Project, 'id'>) => {
    const dbToUse = resolveDatabase();
    const projectsRef = ref(dbToUse, 'projects');
    const newProjectRef = push(projectsRef);
    // Visible log to trace payload
    try {
      // eslint-disable-next-line no-console
      console.log('[projectsService.create] saving project payload', project);
    } catch (e) {}
    await set(newProjectRef, { ...project, id: newProjectRef.key, createdAt: Date.now() });
    // Read back and log what was stored
    try {
      const snap = await get(newProjectRef);
      // eslint-disable-next-line no-console
      console.log('[projectsService.create] stored project', snap.exists() ? snap.val() : null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[projectsService.create] failed to read back project', e);
    }
    return newProjectRef.key;
  },

  update: async (projectId: string, updates: Partial<Project>) => {
  const dbToUse = resolveDatabase();
  const projectRef = ref(dbToUse, `projects/${projectId}`);
    try {
      // eslint-disable-next-line no-console
      console.log('[projectsService.update] updating project', projectId, updates);
    } catch (e) {}
    await update(projectRef, { ...updates, updatedAt: Date.now() });
    try {
      const snap = await get(projectRef);
      // eslint-disable-next-line no-console
      console.log('[projectsService.update] stored project after update', snap.exists() ? snap.val() : null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[projectsService.update] failed to read back project', e);
    }
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

// Notifications
export const notificationsService = {
  createForUsers: async (userIds: string[], payload: { type: string; title: string; message?: string; relatedId?: string; excludeUserId?: string | null } ) => {
    // Try to use server callable when available (ensures notifications are created in default DB and emails sent)
    try {
      const fn = cloudFunctions ? httpsCallable(cloudFunctions as any, 'sendNotification') : null;
      if (fn) {
        // Try to pass the configured DB URL for the selected site so the callable can resolve users there
        const site = typeof window !== 'undefined' ? (localStorage.getItem('selectedSite') as SiteKey | null) : null;
        const dbUrl = site ? DATABASE_URLS[site] : undefined;
        const payloadToSend = { userIds, payload, dbUrl } as any;
        try {
          await fn(payloadToSend);
          return;
        } catch (err) {
          // fallthrough to DB write fallback
          // eslint-disable-next-line no-console
          console.warn('notificationsService: sendNotification callable failed, falling back to DB write', err);
        }
      }

      // Fallback: write notifications to the selected DB (legacy behavior)
      const dbToUse = resolveDatabase();
      const notificationsRef = ref(dbToUse, 'notifications');
      const now = Date.now();
      const { type, title, message, relatedId, excludeUserId } = payload;

      for (const userId of userIds) {
        if (!userId) continue;
        if (excludeUserId && userId === excludeUserId) continue;
        const newNotifRef = push(notificationsRef);
        const notif = {
          id: newNotifRef.key,
          userId,
          type,
          title,
          message: message || '',
          read: false,
          relatedId: relatedId || null,
          createdAt: now,
        } as any;
        try {
          // eslint-disable-next-line no-await-in-loop
          await set(newNotifRef, notif);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Failed to create notification for user', userId, err);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('notificationsService.createForUsers failed', err);
      throw err;
    }
  }
  // La función notifyTaskUpdate se ha eliminado porque las notificaciones
  // ahora se envían automáticamente mediante triggers de base de datos (.onWrite)
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

  getAll: async (): Promise<Task[]> => {
  const dbToUse = resolveDatabase();
  const tasksRef = ref(dbToUse, 'tasks');
    const snapshot = await get(tasksRef);
    if (!snapshot.exists()) return [];
    const tasks: Task[] = [];
    snapshot.forEach((child) => {
      tasks.push(child.val());
    });
    return tasks;
  },

  update: async (taskId: string, updates: Partial<Task>) => {
  const dbToUse = resolveDatabase();
  const taskRef = ref(dbToUse, `tasks/${taskId}`);
    
    // Log para diagnosticar - URL completa
    try {
      const dbRef = (dbToUse as any)._repoInternal?.repoInfo_;
      const fullUrl = dbRef ? `${dbRef.secure ? 'https' : 'http'}://${dbRef.host}` : 'unknown';
      console.log('[tasksService.update] Database URL:', fullUrl);
      console.log('[tasksService.update] TaskId:', taskId);
      console.log('[tasksService.update] Updates:', updates);
    } catch (e) {
      console.warn('[tasksService.update] Could not log database details', e);
    }
    
    // Protect against indefinite hangs by racing the update with a timeout
    const op = update(taskRef, { ...updates, updatedAt: Date.now() });
    const timeoutMs = 15000; // 15s
    await Promise.race([
      op,
      new Promise((_, rej) => setTimeout(() => rej(new Error('update timeout')), timeoutMs)),
    ]);
    
    console.log('[tasksService.update] Task updated successfully');
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

    // Use uploadBytes (promise) to ensure the upload finishes and returns an upload result
    // Fallback to uploadBytesResumable if uploadBytes is not available for the environment
    let uploadResult: any;
    try {
      uploadResult = await uploadBytes(fileRef, file as any);
    } catch (e) {
      // As a fallback, try resumable upload (attach a small wrapper promise)
      uploadResult = await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, file as any);
        task.on('state_changed', () => {}, (err) => reject(err), () => resolve((task as any).snapshot));
      });
    }
    const url = await getDownloadURL((uploadResult as any).ref);

    // Create attachment object
    const attachment = {
      id: (fileRef as any).name || path.split('/').pop(),
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
  // Invite an email address to the platform (creates an invitation record)
  invite: async (email: string) => {
  const dbToUse = resolveDatabase();
  const invitesRef = ref(dbToUse, 'admin/invitations');
    const newRef = push(invitesRef);
    const payload = { id: newRef.key, email: String(email).toLowerCase(), createdAt: Date.now(), status: 'pending' } as any;
    await set(newRef, payload);
    return payload;
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

// Externos (lista de correos que pueden omitir restricción por dominio)
export const externalsService = {
  path: 'admin/externos',

  getAll: async (): Promise<Array<{ id: string; email: string; createdAt?: number }>> => {
    const dbToUse = resolveDatabase();
    const externalsRef = ref(dbToUse, 'admin/externos');
    const snapshot = await get(externalsRef);
    if (!snapshot.exists()) return [];
    const items: Array<{ id: string; email: string; createdAt?: number }> = [];
    snapshot.forEach((child) => {
      items.push(child.val());
    });
    return items;
  },

  add: async (email: string) => {
    const dbToUse = resolveDatabase();
    const externalsRef = ref(dbToUse, 'admin/externos');
    const newRef = push(externalsRef);
    const payload = { id: newRef.key, email, createdAt: Date.now() };
    await set(newRef, payload);
    return payload;
  },

  remove: async (id: string) => {
    const dbToUse = resolveDatabase();
    const itemRef = ref(dbToUse, `admin/externos/${id}`);
    await remove(itemRef);
  },

  listen: (callback: (items: Array<{ id: string; email: string; createdAt?: number }>) => void) => {
    const dbToUse = resolveDatabase();
    const externalsRef = ref(dbToUse, 'admin/externos');
    onValue(externalsRef, (snapshot) => {
      const items: Array<{ id: string; email: string; createdAt?: number }> = [];
      snapshot.forEach((child) => { items.push(child.val()); });
      callback(items);
    });
    return () => off(externalsRef);
  }
};

// Acta de Constitución del Proyecto (Project Charter - PMI)
export const charterService = {
  get: async (projectId: string) => {
    const dbToUse = resolveDatabase();
    const charterRef = ref(dbToUse, `charters/${projectId}`);
    const snapshot = await get(charterRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  save: async (projectId: string, charter: any) => {
    const dbToUse = resolveDatabase();
    const charterRef = ref(dbToUse, `charters/${projectId}`);
    await set(charterRef, { ...charter, projectId, updatedAt: Date.now() });
  },

  delete: async (projectId: string) => {
    const dbToUse = resolveDatabase();
    const charterRef = ref(dbToUse, `charters/${projectId}`);
    await remove(charterRef);
  },

  listen: (projectId: string, callback: (charter: any) => void) => {
    const dbToUse = resolveDatabase();
    const charterRef = ref(dbToUse, `charters/${projectId}`);
    onValue(charterRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null);
    });
    return () => off(charterRef);
  }
};

// Matriz de Riesgos (Risk Management - PMI)
export const risksService = {
  create: async (risk: any) => {
    const dbToUse = resolveDatabase();
    const risksRef = ref(dbToUse, 'risks');
    const newRiskRef = push(risksRef);
    const payload = { ...risk, id: newRiskRef.key, createdAt: Date.now(), updatedAt: Date.now() };
    await set(newRiskRef, payload);
    return newRiskRef.key;
  },

  update: async (riskId: string, updates: any) => {
    const dbToUse = resolveDatabase();
    const riskRef = ref(dbToUse, `risks/${riskId}`);
    await update(riskRef, { ...updates, updatedAt: Date.now() });
  },

  delete: async (riskId: string) => {
    const dbToUse = resolveDatabase();
    const riskRef = ref(dbToUse, `risks/${riskId}`);
    await remove(riskRef);
  },

  get: async (riskId: string) => {
    const dbToUse = resolveDatabase();
    const riskRef = ref(dbToUse, `risks/${riskId}`);
    const snapshot = await get(riskRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  getByProject: async (projectId: string) => {
    const dbToUse = resolveDatabase();
    const risksRef = ref(dbToUse, 'risks');
    const q = query(risksRef, orderByChild('projectId'), equalTo(projectId));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    const risks: any[] = [];
    snapshot.forEach((child) => { risks.push(child.val()); });
    return risks;
  },

  listenByProject: (projectId: string, callback: (risks: any[]) => void) => {
    const dbToUse = resolveDatabase();
    const risksRef = ref(dbToUse, 'risks');
    const q = query(risksRef, orderByChild('projectId'), equalTo(projectId));
    onValue(q, (snapshot) => {
      const risks: any[] = [];
      snapshot.forEach((child) => { risks.push(child.val()); });
      callback(risks);
    });
    return () => off(q);
  }
};
