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
  Paperclip
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

const statusConfig: Record<TaskStatus, { label: string; icon: React.ReactNode; className: string }> = {
  'todo': {
    label: 'Por hacer',
    icon: <Circle className="h-4 w-4" />,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  },
  'in-progress': {
    label: 'En progreso',
    icon: <Clock className="h-4 w-4" />,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  'review': {
    label: 'En revisión',
    icon: <AlertCircle className="h-4 w-4" />,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  },
  'completed': {
    label: 'Completada',
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
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

export function TaskCard({ task, onClick }: TaskCardProps) {
  const statusInfo = statusConfig[task.status];
  const priorityInfo = priorityConfig[task.priority];
  
  const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== 'completed';
  
  return (
    <Card 
      className="hover:shadow-xl transition-all duration-200 cursor-pointer border-2 hover:border-primary/50 hover:scale-[1.02] group bg-background"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {task.title}
          </CardTitle>
          <Flag className={`h-5 w-5 flex-shrink-0 ${priorityInfo.className} transition-transform group-hover:scale-110`} fill="currentColor" />
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
          
          {task.tags.length > 0 && task.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs border-2">
              #{tag}
            </Badge>
          ))}
          
          {task.tags.length > 2 && (
            <Badge variant="outline" className="text-xs border-2 font-semibold">
              +{task.tags.length - 2}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <div className="flex items-center gap-3">
            {task.dueDate && (
              <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {formatDistanceToNow(task.dueDate, { 
                    addSuffix: true, 
                    locale: es 
                  })}
                </span>
              </div>
            )}
            
            {task.assigneeIds.length > 0 && (
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium">{task.assigneeIds.length}</span>
              </div>
            )}
            
            {task.attachments.length > 0 && (
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
                <Paperclip className="h-3.5 w-3.5" />
                <span className="font-medium">{task.attachments.length}</span>
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
