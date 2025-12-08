import { useState } from 'react';
import { SubTask } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ListTodo, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface SubTasksProps {
  subTasks: SubTask[];
  onChange: (subTasks: SubTask[]) => void;
}

export function SubTasks({ subTasks, onChange }: SubTasksProps) {
  const [showForm, setShowForm] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const completedCount = subTasks.filter(st => st.completed).length;
  const totalCount = subTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAddSubTask = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newSubTaskTitle.trim()) return;

    setSubmitting(true);
    
    try {
      const newSubTask: SubTask = {
        id: `subtask-${Date.now()}`,
        title: newSubTaskTitle.trim(),
        completed: false,
        createdAt: Date.now(),
      };

      onChange([...subTasks, newSubTask]);

      setNewSubTaskTitle('');
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
          <form onSubmit={handleAddSubTask} className="flex gap-2">
            <input
              type="text"
              value={newSubTaskTitle}
              onChange={(e) => setNewSubTaskTitle(e.target.value)}
              placeholder="Título de la subtarea..."
              className="flex-1 rounded-md border bg-input text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
              disabled={submitting}
              autoFocus
            />
            <Button type="submit" size="sm" disabled={submitting}>
              Agregar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setNewSubTaskTitle('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Lista de subtareas */}
        {totalCount === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay subtareas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {subTasks.map((subTask) => (
              <div
                key={subTask.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
              >
                <Checkbox
                  checked={subTask.completed}
                  onCheckedChange={() => handleToggleSubTask(subTask.id)}
                />
                <span
                  className={`flex-1 text-sm ${
                    subTask.completed
                      ? 'line-through text-muted-foreground'
                      : ''
                  }`}
                >
                  {subTask.title}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteSubTask(subTask.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
