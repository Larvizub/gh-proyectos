import { useState } from 'react';
import { SubTask } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ListTodo, Plus, X, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SubTasksProps {
  subTasks: SubTask[];
  onChange: (subTasks: SubTask[]) => void;
}

export function SubTasks({ subTasks, onChange }: SubTasksProps) {
  const [showForm, setShowForm] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskDueDate, setNewSubTaskDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const completedCount = subTasks.filter(st => st.completed).length;
  const totalCount = subTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAddSubTask = () => {
    if (!newSubTaskTitle.trim()) return;

    setSubmitting(true);
    
    try {
      const dueDateTimestamp = newSubTaskDueDate 
        ? new Date(newSubTaskDueDate + 'T12:00:00').getTime() 
        : undefined;

      const newSubTask: SubTask = {
        id: `subtask-${Date.now()}`,
        title: newSubTaskTitle.trim(),
        completed: false,
        dueDate: dueDateTimestamp,
        createdAt: Date.now(),
      };

      onChange([...subTasks, newSubTask]);

      setNewSubTaskTitle('');
      setNewSubTaskDueDate('');
      setShowForm(false);
    } catch (error: any) {
      toast.error(error?.message || 'Error al agregar subtarea');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSubTask = (subTaskId: string) => {
    try {
      const updatedSubTasks = subTasks.map(st =>
        st.id === subTaskId ? { ...st, completed: !st.completed } : st
      );

      onChange(updatedSubTasks);
    } catch (error: any) {
      toast.error(error?.message || 'Error al actualizar subtarea');
    }
  };

  const handleDeleteSubTask = (subTaskId: string) => {
    try {
      const updatedSubTasks = subTasks.filter(st => st.id !== subTaskId);

      onChange(updatedSubTasks);
    } catch (error: any) {
      toast.error(error?.message || 'Error al eliminar subtarea');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            <span>Subtareas</span>
            <span className="text-sm font-normal text-muted-foreground">
              ({completedCount}/{totalCount})
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progreso */}
        {totalCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Formulario para nueva subtarea */}
        {showForm && (
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <input
              type="text"
              value={newSubTaskTitle}
              onChange={(e) => setNewSubTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubTask();
                }
              }}
              placeholder="Título de la subtarea..."
              className="w-full rounded-md border bg-input text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
              disabled={submitting}
              autoFocus
            />
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground ml-1">
                Fecha de vencimiento
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={newSubTaskDueDate}
                    onChange={(e) => setNewSubTaskDueDate(e.target.value)}
                    className="w-full rounded-md border bg-input text-foreground placeholder:text-muted-foreground pl-9 pr-3 py-2 text-sm appearance-none"
                    disabled={submitting}
                  />
                </div>
                <Button 
                  type="button" 
                  size="sm" 
                  disabled={submitting}
                  onClick={handleAddSubTask}
                >
                  Agregar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setNewSubTaskTitle('');
                    setNewSubTaskDueDate('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de subtareas */}
        {totalCount === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay subtareas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {subTasks.map((subTask) => {
              const overdue = subTask.dueDate && subTask.dueDate < Date.now() && !subTask.completed;
              return (
                <div
                  key={subTask.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                >
                  <Checkbox
                    checked={subTask.completed}
                    onCheckedChange={() => handleToggleSubTask(subTask.id)}
                  />
                  <div className="flex-1 flex flex-col min-w-0">
                    <span
                      className={`text-sm truncate ${
                        subTask.completed
                          ? 'line-through text-muted-foreground'
                          : ''
                      }`}
                    >
                      {subTask.title}
                    </span>
                    {subTask.dueDate && (
                      <span className={`text-[10px] flex items-center gap-1 ${overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        <CalendarIcon className="h-3 w-3" />
                        {format(subTask.dueDate, 'PPP', { locale: es })}
                        {overdue && ' (Vencida)'}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteSubTask(subTask.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
