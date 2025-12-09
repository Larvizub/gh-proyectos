export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'user';
  createdAt: number;
  updatedAt: number;
}

export type SiteKey = 'CORPORATIVO' | 'CCCR' | 'CCCI' | 'CEVP';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerId: string;
  memberIds: string[];
  owners?: string[]; // usuarios con permisos de propietario compartido
  tags?: string[];
  // Sitios donde existe/estará replicado el proyecto (opcional)
  sites?: SiteKey[];
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived' | 'completed';
}

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

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
  subTasks?: SubTask[]; // Subtareas de esta tarea
  tags: string[];
  attachments: Attachment[];
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  uploadedBy?: string;
  createdAt: number;
  reference?: boolean; // true if it's a reference doc
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  userDisplayName?: string;
  userPhotoURL?: string;
  attachment?: Attachment;
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

export type ViewType = 'list' | 'kanban' | 'calendar' | 'gantt';

// Acta de Constitución del Proyecto (PMI Project Charter)
export interface ProjectCharter {
  id: string;
  projectId: string;
  // Información básica
  projectName: string;
  projectDescription: string;
  // Justificación del proyecto
  businessCase: string;
  // Objetivos medibles
  objectives: string;
  // Requisitos de alto nivel
  highLevelRequirements: string;
  // Riesgos de alto nivel (se alimenta del módulo de riesgos)
  highLevelRisks: string;
  // Resumen del cronograma de hitos
  milestoneSummary: string;
  // Presupuesto resumido
  budgetSummary: string;
  // Criterios de éxito
  successCriteria: string;
  // Gerente del proyecto asignado y nivel de autoridad
  projectManager: string;
  projectManagerAuthority: string;
  // Patrocinador del proyecto
  projectSponsor: string;
  // Supuestos
  assumptions: string;
  // Restricciones
  constraints: string;
  // Stakeholders clave
  keyStakeholders: string;
  // Metadatos
  createdBy: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt: number;
}

// Matriz de Riesgos (PMI Risk Management)
export type RiskProbability = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
export type RiskImpact = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
export type RiskStatus = 'identified' | 'analyzing' | 'planned' | 'in-progress' | 'resolved' | 'closed';
export type RiskCategory = 'technical' | 'external' | 'organizational' | 'project-management';

export interface Risk {
  id: string;
  projectId: string;
  // Identificación
  title: string;
  description: string;
  category: RiskCategory;
  // Análisis cualitativo
  probability: RiskProbability;
  impact: RiskImpact;
  riskScore: number; // Calculado: probability * impact
  // Planificación de respuesta
  responseStrategy: 'avoid' | 'transfer' | 'mitigate' | 'accept' | 'exploit' | 'share' | 'enhance';
  responsePlan: string;
  contingencyPlan: string;
  // Responsable
  ownerId: string;
  // Estado y seguimiento
  status: RiskStatus;
  triggerConditions: string;
  // Fechas
  identifiedDate: number;
  reviewDate?: number;
  closedDate?: number;
  // Metadatos
  createdBy: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt: number;
}

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

export type LessonCategory = 
  | 'Scope' 
  | 'Schedule' 
  | 'Cost' 
  | 'Quality' 
  | 'Resources' 
  | 'Communication' 
  | 'Risk' 
  | 'Procurement' 
  | 'Stakeholder'
  | 'Other';

export interface Lesson {
  id: string;
  projectId: string;
  category: LessonCategory;
  issue: string;
  impact: string;
  recommendation: string;
  createdBy: string;
  createdAt: number;
}

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'deferred';

export interface ChangeRequest {
  id: string;
  projectId: string;
  // Información del Cambio
  title: string;
  description: string;
  justification: string; // Razón del cambio
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Análisis de Impacto (PMI)
  impactScope: string;
  impactSchedule: string;
  impactCost: string;
  impactQuality: string;
  impactResources: string;
  impactRisks: string;
  
  proposedAction: string;
  
  // Estado y Aprobación
  status: ChangeRequestStatus;
  requesterId: string;
  approverId?: string;
  approvalDate?: number;
  rejectionReason?: string;
  
  createdAt: number;
  updatedAt: number;
}


