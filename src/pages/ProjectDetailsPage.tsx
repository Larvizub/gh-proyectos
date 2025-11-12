import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { projectsService, tasksService } from '@/services/firebase.service';
import { Task, Project, ViewType, TaskStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import GanttChart from '@/components/tasks/GanttChart';
import TaskEditorModal from '@/components/tasks/TaskEditorModal';
import { LayoutList, LayoutGrid, Calendar, Plus, Clipboard, Activity, Eye, CheckCircle, ArrowDown, Minus, ArrowUp, Zap, Edit3, Trash2 } from 'lucide-react';
import Select from '@/components/ui/select';
import DatePicker from '@/components/ui/DatePicker';
import PageLoader from '@/components/PageLoader';
import { useAuth } from '@/contexts/AuthContext';

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewType, setViewType] = useState<ViewType>('kanban');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  // Task form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');

  // Helper: convert a YYYY-MM-DD date string to a local midnight timestamp (ms)
  const dateStringToTimestamp = (s: string) => {
    if (!s) return undefined;
    const parts = s.split('-');
    if (parts.length !== 3) return undefined;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    return new Date(y, m, d).getTime();
  };

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

  if (loading) return <PageLoader message="Cargando proyecto..." overlay={false} />;
  if (!project) return <div>Proyecto no encontrado</div>;

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();

    if (!project || !user) return;

    // Validate required date fields
    if (!startDate || !dueDate) {
      toast.error('Por favor completa la fecha de inicio y la fecha de vencimiento.');
      return;
    }

    const payload: Partial<Task> = {
      title,
      description: desc,
      projectId: project.id,
      status,
      priority,
  // store timestamps (ms) if provided (date-only, local midnight)
  dueDate: dueDate ? dateStringToTimestamp(dueDate) : undefined,
  startDate: startDate ? dateStringToTimestamp(startDate) : undefined,
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
    setDueDate('');
    setStartDate('');
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

  async function handleDeleteTask(taskId: string) {
    if (!confirm('¿Estás seguro de eliminar esta tarea? Esta acción no se puede deshacer.')) return;

    await toast.promise(
      tasksService.delete(taskId),
      {
        loading: 'Eliminando tarea...',
        success: 'Tarea eliminada',
        error: (err) => `Error: ${err?.message || 'No se pudo eliminar la tarea'}`,
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
              onClick={() => setViewType('gantt')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewType === 'gantt' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Vista Gantt"
            >
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Gantt</span>
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
                  className="w-full rounded-lg border-2 border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-2.5 transition-all outline-none" 
                  placeholder="Ej: Diseñar mockups de la página principal" 
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <textarea 
                  value={desc} 
                  onChange={e => setDesc(e.target.value)} 
                  className="w-full rounded-lg border-2 border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-2.5 transition-all outline-none resize-none" 
                  rows={4} 
                  placeholder="Describe los detalles de la tarea..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado inicial</label>
                    <Select value={status} onChange={(v) => setStatus(v as TaskStatus)} className="w-full">
                      <option value="todo">
                        <div className="flex items-center gap-2">
                          <Clipboard className="h-4 w-4" />
                          Por hacer
                        </div>
                      </option>
                      <option value="in-progress">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          En progreso
                        </div>
                      </option>
                      <option value="review">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          En revisión
                        </div>
                      </option>
                      <option value="completed">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Completada
                        </div>
                      </option>
                    </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prioridad</label>
                  <Select value={priority} onChange={(v) => setPriority(v as any)} className="w-full">
                    <option value="low">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="h-4 w-4" />
                        Baja
                      </div>
                    </option>
                    <option value="medium">
                      <div className="flex items-center gap-2">
                        <Minus className="h-4 w-4" />
                        Media
                      </div>
                    </option>
                    <option value="high">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="h-4 w-4" />
                        Alta
                      </div>
                    </option>
                    <option value="urgent">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Urgente
                      </div>
                    </option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">Fecha de inicio <span className="text-red-500">*</span></label>
                  <DatePicker value={startDate} onChange={v => setStartDate(v)} placeholder="dd/mm/aaaa" ariaLabel="Fecha de inicio" required />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">Fecha de vencimiento <span className="text-red-500">*</span></label>
                  <DatePicker value={dueDate} onChange={v => setDueDate(v)} placeholder="dd/mm/aaaa" ariaLabel="Fecha de vencimiento" required />
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
          onTaskClick={(task) => setSelectedTask(task)}
          onTaskStatusChange={handleTaskStatusChange}
          onTaskDelete={handleDeleteTask}
        />
      )}

      {viewType === 'gantt' && (
        <GanttChart tasks={tasks} onTaskClick={(t) => setSelectedTask(t)} onTaskDelete={handleDeleteTask} />
      )}

      {viewType === 'list' && (
        <div className="overflow-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="px-4 py-2">Título</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Prioridad</th>
                <th className="px-4 py-2">Asignados</th>
                <th className="px-4 py-2">Tags</th>
                <th className="px-4 py-2">Adjuntos</th>
                <th className="px-4 py-2">Inicio</th>
                <th className="px-4 py-2">Vencimiento</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8">No hay tareas en este proyecto</td>
                </tr>
              ) : (
                tasks.map(task => (
                  <tr key={task.id} className="border-b hover:bg-muted/10">
                    <td className="px-4 py-3">{task.title}</td>
                    <td className="px-4 py-3">
                      <div>
                        {task.status === 'todo' && <span className="px-2 py-1 text-xs rounded-full bg-col-todo text-col-todo-text">Por hacer</span>}
                        {task.status === 'in-progress' && <span className="px-2 py-1 text-xs rounded-full bg-col-inprogress text-col-inprogress-text">En progreso</span>}
                        {task.status === 'review' && <span className="px-2 py-1 text-xs rounded-full bg-col-review text-col-review-text">En revisión</span>}
                        {task.status === 'completed' && <span className="px-2 py-1 text-xs rounded-full bg-col-completed text-col-completed-text">Completada</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">{task.priority}</td>
                    <td className="px-4 py-3">{(task.assigneeIds || []).length}</td>
                    <td className="px-4 py-3">{(task.tags || []).slice(0,3).join(', ') || '-'}</td>
                    <td className="px-4 py-3">{(task.attachments || []).length}</td>
                    <td className="px-4 py-3">{task.startDate ? new Date(task.startDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setSelectedTask(task)} className="p-2 rounded hover:bg-muted text-muted-foreground" title="Editar">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDeleteTask(task.id)} className="p-2 rounded hover:bg-destructive/10 text-destructive" title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedTask && (
        <TaskEditorModal task={selectedTask} onClose={() => setSelectedTask(null)} onSaved={() => {/* tasks listener will update */}} />
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
