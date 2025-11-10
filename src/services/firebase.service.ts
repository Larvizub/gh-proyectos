import { database } from '@/config/firebase';
import { ref, push, set, get, update, remove, onValue, off, query, orderByChild, equalTo } from 'firebase/database';
import { Project, Task, Comment, User } from '@/types';

// Proyectos
export const projectsService = {
  create: async (project: Omit<Project, 'id'>) => {
    const projectsRef = ref(database, 'projects');
    const newProjectRef = push(projectsRef);
    await set(newProjectRef, { ...project, id: newProjectRef.key });
    return newProjectRef.key;
  },

  update: async (projectId: string, updates: Partial<Project>) => {
    const projectRef = ref(database, `projects/${projectId}`);
    await update(projectRef, { ...updates, updatedAt: Date.now() });
  },

  delete: async (projectId: string) => {
    const projectRef = ref(database, `projects/${projectId}`);
    await remove(projectRef);
  },

  get: async (projectId: string): Promise<Project | null> => {
    const projectRef = ref(database, `projects/${projectId}`);
    const snapshot = await get(projectRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  getAll: async (): Promise<Project[]> => {
    const projectsRef = ref(database, 'projects');
    const snapshot = await get(projectsRef);
    if (!snapshot.exists()) return [];
    
    const projects: Project[] = [];
    snapshot.forEach((child) => {
      projects.push(child.val());
    });
    return projects;
  },

  listen: (callback: (projects: Project[]) => void) => {
    const projectsRef = ref(database, 'projects');
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
    const tasksRef = ref(database, 'tasks');
    const newTaskRef = push(tasksRef);
    await set(newTaskRef, { ...task, id: newTaskRef.key });
    return newTaskRef.key;
  },

  update: async (taskId: string, updates: Partial<Task>) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    await update(taskRef, { ...updates, updatedAt: Date.now() });
  },

  delete: async (taskId: string) => {
    const taskRef = ref(database, `tasks/${taskId}`);
    await remove(taskRef);
  },

  get: async (taskId: string): Promise<Task | null> => {
    const taskRef = ref(database, `tasks/${taskId}`);
    const snapshot = await get(taskRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  getByProject: async (projectId: string): Promise<Task[]> => {
    const tasksRef = ref(database, 'tasks');
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
    const tasksRef = ref(database, 'tasks');
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
};

// Comentarios
export const commentsService = {
  create: async (comment: Omit<Comment, 'id'>) => {
    const commentsRef = ref(database, 'comments');
    const newCommentRef = push(commentsRef);
    await set(newCommentRef, { ...comment, id: newCommentRef.key });
    return newCommentRef.key;
  },

  update: async (commentId: string, updates: Partial<Comment>) => {
    const commentRef = ref(database, `comments/${commentId}`);
    await update(commentRef, { ...updates, updatedAt: Date.now() });
  },

  delete: async (commentId: string) => {
    const commentRef = ref(database, `comments/${commentId}`);
    await remove(commentRef);
  },

  getByTask: async (taskId: string): Promise<Comment[]> => {
    const commentsRef = ref(database, 'comments');
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
    const commentsRef = ref(database, 'comments');
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
    const userRef = ref(database, `users/${user.id}`);
    await set(userRef, user);
  },

  update: async (userId: string, updates: Partial<User>) => {
    const userRef = ref(database, `users/${userId}`);
    await update(userRef, { ...updates, updatedAt: Date.now() });
  },

  get: async (userId: string): Promise<User | null> => {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  getAll: async (): Promise<User[]> => {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];
    
    const users: User[] = [];
    snapshot.forEach((child) => {
      users.push(child.val());
    });
    return users;
  },
};
