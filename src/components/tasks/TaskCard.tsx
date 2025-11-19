import { Task, TaskPriority, TaskStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  User, 
  CheckCircle2, 
  Circle, 
  AlertCircle,
  Flag,
  Calendar,
  Paperclip,
  Edit3,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { memo, useEffect, useState } from 'react';
import { useUsers } from '@/contexts/UsersContext';
import { useAuth } from '@/contexts/AuthContext';
import { projectsService } from '@/services/firebase.service';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onDelete?: () => void;
}

const statusConfig: Record<TaskStatus, { label: string; icon: React.ReactNode; className: string }> = {
  'todo': {
    label: 'Por hacer',
    icon: <Circle className="h-4 w-4" />,
    className: 'bg-col-todo text-col-todo-text'
  },
  'in-progress': {
    label: 'En progreso',
    icon: <Clock className="h-4 w-4" />,
    className: 'bg-col-inprogress text-col-inprogress-text'
  },
  'review': {
    label: 'En revisión',
    icon: <AlertCircle className="h-4 w-4" />,
    className: 'bg-col-review text-col-review-text'
  },
  'completed': {
    label: 'Completada',
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: 'bg-col-completed text-col-completed-text'
  }
};

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  'low': {
    label: 'Baja',
    className: 'text-gray-500'
  },
  'medium': {
    label: 'Media',
    className: 'text-blue-500'
  },
  'high': {
    label: 'Alta',
    className: 'text-orange-500'
  },
  'urgent': {
    label: 'Urgente',
    className: 'text-red-500'
  }
};

function TaskCardComponent({ task, onClick, onDelete }: TaskCardProps) {
  const { usersMap } = useUsers();
  const { user } = useAuth();
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [projectOwners, setProjectOwners] = useState<string[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  
  // defensive defaults in case some fields are missing at runtime
  const statusInfo = statusConfig[task?.status ?? 'todo'];
  const priorityInfo = priorityConfig[task?.priority ?? 'low'];

  const tags = task?.tags ?? [];
  const assigneeIds = task?.assigneeIds ?? [];
  const attachments = task?.attachments ?? [];
  const assignees = assigneeIds.map(id => usersMap[id]).filter(Boolean);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!task?.projectId) return;
      try {
        const p = await projectsService.get(task.projectId);
        if (!mounted) return;
        setProjectOwnerId(p?.ownerId || null);
        setProjectOwners(p?.owners || null);
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [task?.projectId]);

  useEffect(() => {
    // Compute canEdit: true if current user is project owner or in project owners list or assigned to task
    const uid = user?.id;
    if (!uid) { setCanEdit(false); return; }

    let assigned = false;
    if (task) {
      if (Array.isArray(task.assigneeIds) && uid && task.assigneeIds.includes(uid)) assigned = true;
      const a = (task as any).assignedTo;
      if (typeof a === 'string') {
        if (a === uid || a === user?.email) assigned = true;
      } else if (a && typeof a === 'object') {
        if (a.userId === uid || a.email === user?.email) assigned = true;
      }
    }

    const ownerMatch = projectOwnerId === uid || (projectOwners && projectOwners.includes(uid));
    setCanEdit(ownerMatch || assigned);
  }, [user?.id, user?.email, projectOwnerId, projectOwners, task]);

  // normalize and validate dueDate (could be number, string, or invalid)
  const rawDue = task?.dueDate;
  const dueDateNum = rawDue == null ? NaN : Number(rawDue);
  const hasValidDueDate = !isNaN(dueDateNum) && dueDateNum > 0;
  const dueDateObj = hasValidDueDate ? new Date(dueDateNum) : null;
  const isOverdue = hasValidDueDate && dueDateNum < Date.now() && task?.status !== 'completed';
  let dueLabel: string | null = null;
  if (hasValidDueDate && dueDateObj) {
    try {
      dueLabel = formatDistanceToNow(dueDateObj, { addSuffix: true, locale: es });
    } catch (e) {
      // ignore formatting errors and keep label null
      dueLabel = null;
    }
  }
  
  return (
    <Card 
      className="hover:shadow-xl transition-all duration-200 cursor-pointer border-2 hover:border-primary/50 hover:scale-[1.02] group ring-1 ring-transparent dark:ring-white/5 relative"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {task?.title ?? 'Sin título'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Priority flag */}
            <Flag className={`h-5 w-5 flex-shrink-0 ${priorityInfo.className} transition-transform group-hover:scale-110`} fill="currentColor" />

            {/* Action icons: edit (opens editor via parent click) and delete */}
            {canEdit ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Editar"
                >
                  <Edit3 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="text-xs text-muted-foreground px-2">Solo propietario/asignado</div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className={`${statusInfo.className} font-medium shadow-sm`}>
            {statusInfo.icon}
            <span className="ml-1.5">{statusInfo.label}</span>
          </Badge>
          
          {tags.length > 0 && tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs border-2">
              #{tag}
            </Badge>
          ))}
          
          {tags.length > 2 && (
            <Badge variant="outline" className="text-xs border-2 font-semibold">
              +{tags.length - 2}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <div className="flex items-center gap-3">
            {hasValidDueDate && dueLabel && (
              <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {dueLabel}
                </span>
              </div>
            )}
            
            {assignees.length > 0 && (
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium truncate max-w-[10rem]">{assignees.map(a => a.displayName || a.email).slice(0,3).join(', ')}</span>
              </div>
            )}
            
            {attachments.length > 0 && (
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
                <Paperclip className="h-3.5 w-3.5" />
                <span className="font-medium">{attachments.length}</span>
              </div>
            )}
          </div>
          
          {isOverdue && (
            <Badge variant="destructive" className="text-xs font-bold shadow-sm">
              ⚠️ Vencida
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const TaskCard = memo(TaskCardComponent);
