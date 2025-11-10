export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'user';
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived' | 'completed';
}

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  creatorId: string;
  dueDate?: number;
  startDate?: number;
  completedAt?: number;
  parentTaskId?: string; // Para subtareas
  dependsOn?: string[]; // IDs de tareas de las que depende
  tags: string[];
  attachments: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'task-assigned' | 'task-updated' | 'comment-added' | 'due-date-approaching' | 'task-completed';
  title: string;
  message: string;
  read: boolean;
  relatedId?: string; // ID del proyecto o tarea relacionado
  createdAt: number;
}

export type ViewType = 'list' | 'kanban' | 'calendar';

export interface FilterOptions {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assigneeIds?: string[];
  tags?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
  searchQuery?: string;
}
