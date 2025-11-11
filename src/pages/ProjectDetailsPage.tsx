import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { projectsService, tasksService } from '@/services/firebase.service';
import { Task, Project, ViewType, TaskStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { LayoutList, LayoutGrid, Calendar, Plus } from 'lucide-react';
import PageLoader from '@/components/PageLoader';
import { useAuth } from '@/contexts/AuthContext';

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewType, setViewType] = useState<ViewType>('kanban');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  // Task form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');

  useEffect(() => {
    if (!id) return;

    let unsubTasks: (() => void) | undefined;

    (async () => {
      setLoading(true);
      const p = await projectsService.get(id);
      setProject(p);
      setLoading(false);

      unsubTasks = tasksService.listen(id, (ts) => setTasks(ts));
    })();

    return () => {
      if (unsubTasks) unsubTasks();
    };
  }, [id]);

  if (loading) return <PageLoader message="Cargando proyecto..." />;
  if (!project) return <div>Proyecto no encontrado</div>;

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();

    if (!project || !user) return;

    const payload: Partial<Task> = {
      title,
      description: desc,
      projectId: project.id,
      status,
      priority,
      assigneeIds: [],
      creatorId: user.id,
      tags: [],
      attachments: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await toast.promise(
      tasksService.create(payload as any),
      {
        loading: 'Creando tarea...',
        success: 'Tarea creada correctamente',
        error: (err) => `Error: ${err?.message || 'No se pudo crear la tarea'}`,
      }
    );

    setTitle('');
    setDesc('');
    setPriority('medium');
    setStatus('todo');
    setShowNewTaskForm(false);
  }

  async function handleTaskStatusChange(taskId: string, newStatus: TaskStatus) {
    await toast.promise(
      tasksService.update(taskId, { status: newStatus }),
      {
        loading: 'Actualizando...',
        success: 'Estado actualizado',
        error: 'Error al actualizar',
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div 
              className="h-6 w-6 rounded-lg shadow-sm"
              style={{ backgroundColor: project.color }}
            />
            {project.name}
          </h1>
          <p className="text-muted-foreground mt-2">{project.description}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Selector de vista mejorado */}
          <div className="flex rounded-lg border-2 border-border bg-background p-1 shadow-sm">
            <button
              onClick={() => setViewType('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewType === 'list' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Vista de lista"
            >
              <LayoutList className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => setViewType('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewType === 'kanban' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Vista Kanban"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewType('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewType === 'calendar' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
              }`}
              title="Vista de calendario (próximamente)"
              disabled
            >
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Calendario</span>
            </button>
          </div>
          
          <Button 
            onClick={() => setShowNewTaskForm(!showNewTaskForm)}
            className="h-11 shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Nueva Tarea</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      {/* Formulario de nueva tarea */}
      {showNewTaskForm && (
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Crear nueva tarea
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <input 
                  required 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="w-full rounded-lg border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-2.5 transition-all outline-none" 
                  placeholder="Ej: Diseñar mockups de la página principal" 
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <textarea 
                  value={desc} 
                  onChange={e => setDesc(e.target.value)} 
                  className="w-full rounded-lg border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-2.5 transition-all outline-none resize-none" 
                  rows={4} 
                  placeholder="Describe los detalles de la tarea..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado inicial</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value as TaskStatus)} 
                    className="w-full rounded-lg border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-2.5 transition-all outline-none bg-background"
                  >
                    <option value="todo">📋 Por hacer</option>
                    <option value="in-progress">⚡ En progreso</option>
                    <option value="review">👀 En revisión</option>
                    <option value="completed">✅ Completada</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prioridad</label>
                  <select 
                    value={priority} 
                    onChange={e => setPriority(e.target.value as any)} 
                    className="w-full rounded-lg border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-2.5 transition-all outline-none bg-background"
                  >
                    <option value="low">🟢 Baja</option>
                    <option value="medium">🟡 Media</option>
                    <option value="high">🟠 Alta</option>
                    <option value="urgent">🔴 Urgente</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 h-11">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear tarea
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowNewTaskForm(false)}
                  className="h-11"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Vista de tareas */}
      {viewType === 'kanban' && (
        <KanbanBoard 
          tasks={tasks} 
          onTaskClick={(task) => console.log('Click en tarea:', task)}
          onTaskStatusChange={handleTaskStatusChange}
        />
      )}

      {viewType === 'list' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <p className="text-muted-foreground">No hay tareas en este proyecto</p>
              </CardContent>
            </Card>
          ) : (
            tasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task}
                onClick={() => console.log('Click en tarea:', task)}
              />
            ))
          )}
        </div>
      )}

      {viewType === 'calendar' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Vista de calendario próximamente</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
