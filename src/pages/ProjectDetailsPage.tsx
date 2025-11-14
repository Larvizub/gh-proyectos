import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { projectsService, tasksService } from '@/services/firebase.service';
import { Task, Project, ViewType, TaskStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { usersService } from '@/services/firebase.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import GanttChart from '@/components/tasks/GanttChart';
import TaskEditorModal from '@/components/tasks/TaskEditorModal';
import { LayoutList, LayoutGrid, Calendar, Plus, Clipboard, Activity, Eye, CheckCircle, ArrowDown, Minus, ArrowUp, Zap, Edit3, Trash2, User, ArrowLeft } from 'lucide-react';
import ProjectModal from '@/components/projects/ProjectModal';
import Select from '@/components/ui/select';
import DatePicker from '@/components/ui/DatePicker';
import PageLoader from '@/components/PageLoader';
import { useAuth } from '@/contexts/AuthContext';
import CalendarView from '@/components/tasks/CalendarView';
import { useTasksCache } from '@/hooks/useTasksCache';

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const { tasks } = useTasksCache(id);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewType, setViewType] = useState<ViewType>('kanban');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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

    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const p = await projectsService.get(id);
        if (mounted) {
          setProject(p);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading project:', error);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await usersService.getAll();
        if (!mounted) return;
        const map: Record<string, any> = {};
        (all || []).forEach((u: any) => { map[u.id] = u; });
        setUsersMap(map);
      } catch (e) {
        console.warn('Failed to load users', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Si entramos en modo compacto, forzar una vista soportada (kanban o calendar)
  useEffect(() => {
    if (isCompact && (viewType === 'gantt' || viewType === 'list')) {
      setViewType('kanban');
      toast('Las vistas Gantt y Lista no están disponibles en pantallas pequeñas. Se ha cambiado a Kanban.');
    }
  }, [isCompact, viewType]);
  // Listener para detectar pantalla compacta
  useEffect(() => {
    function updateCompact() {
      setIsCompact(window.innerWidth < 768);
    }
    updateCompact();
    window.addEventListener('resize', updateCompact);
    return () => window.removeEventListener('resize', updateCompact);
  }, []);

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
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="h-9 mr-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Proyectos
          </Button>
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Editar
          </Button>
          
          {/* Project edit modal */}
          {/* Tag filter */}
          {project.tags && project.tags.length > 0 && (
            <div className="ml-4">
              <Select value={tagFilter ?? ''} onChange={(v) => setTagFilter(v ? String(v) : null)} className="w-48">
                <option value="">Todos los tags</option>
                {project.tags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
          )}
          <ProjectModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            initial={project}
            onSave={async (payload: Partial<Project> & { id?: string }) => {
              try {
                if (!payload.id) {
                  toast.error('ID de proyecto faltante');
                  return;
                }
                await projectsService.update(payload.id, { name: payload.name, description: payload.description, color: payload.color });
                const updated = await projectsService.get(payload.id);
                setProject(updated);
                toast.success('Proyecto actualizado');
              } catch (err) {
                console.error('Error updating project', err);
                toast.error('No se pudo actualizar el proyecto');
              }
            }}
          />
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
              onClick={() => {
                if (isCompact) {
                  toast('Las vistas Gantt y Lista no están disponibles en pantallas pequeñas. Se ha cambiado a Kanban.');
                  return;
                }
                setViewType('gantt');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewType === 'gantt'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-muted text-muted-foreground'
              } ${isCompact ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isCompact ? 'Gantt no disponible en pantallas pequeñas' : 'Vista Gantt'}
            >
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Gantt</span>
            </button>
            <button
              onClick={() => setViewType('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewType === 'calendar' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Vista de calendario"
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
                        <option value="todo" className="flex items-center gap-2">
                          <Clipboard className="h-4 w-4 inline-block mr-2" /> Por hacer
                        </option>
                        <option value="in-progress" className="flex items-center gap-2">
                          <Activity className="h-4 w-4 inline-block mr-2" /> En progreso
                        </option>
                        <option value="review" className="flex items-center gap-2">
                          <Eye className="h-4 w-4 inline-block mr-2" /> En revisión
                        </option>
                        <option value="completed" className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 inline-block mr-2" /> Completada
                        </option>
                    </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prioridad</label>
                  <Select value={priority} onChange={(v) => setPriority(v as any)} className="w-full">
                    <option value="low" className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 inline-block mr-2" /> Baja
                    </option>
                    <option value="medium" className="flex items-center gap-2">
                      <Minus className="h-4 w-4 inline-block mr-2" /> Media
                    </option>
                    <option value="high" className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 inline-block mr-2" /> Alta
                    </option>
                    <option value="urgent" className="flex items-center gap-2">
                      <Zap className="h-4 w-4 inline-block mr-2" /> Urgente
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
          tasks={tagFilter ? tasks.filter(t => (t.tags || []).includes(tagFilter)) : tasks} 
          onTaskClick={(task) => setSelectedTask(task)}
          onTaskStatusChange={handleTaskStatusChange}
          onTaskDelete={handleDeleteTask}
        />
      )}

      {viewType === 'gantt' && (
        <GanttChart tasks={tagFilter ? tasks.filter(t => (t.tags || []).includes(tagFilter)) : tasks} onTaskClick={(t) => setSelectedTask(t)} onTaskDelete={handleDeleteTask} />
      )}

      {viewType === 'list' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="text-left">
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
                  {((tagFilter ? tasks.filter(t => (t.tags || []).includes(tagFilter)) : tasks).length === 0) ? (
                    <tr><td colSpan={9} className="p-6 text-muted-foreground text-center">No hay tareas en este proyecto</td></tr>
                  ) : (
                    (tagFilter ? tasks.filter(t => (t.tags || []).includes(tagFilter)) : tasks).map(task => (
                      <tr key={task.id} className="border-t hover:bg-muted/10">
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {(task.assigneeIds || []).slice(0,3).map(id => {
                              const u = usersMap[id];
                              if (!u) return null;
                              return (
                                <span key={id} className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-muted/20 text-sm">
                                  <User className="h-4 w-4" />
                                  <span className="truncate max-w-[120px]">{u.displayName || u.email || u.id}</span>
                                </span>
                              );
                            })}
                            {(task.assigneeIds || []).length > 3 && (
                              <span className="text-sm">+{(task.assigneeIds || []).length - 3}</span>
                            )}
                            {(task.assigneeIds || []).length === 0 && <span className="text-sm text-muted-foreground">-</span>}
                          </div>
                        </td>
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
          </CardContent>
        </Card>
      )}

      {selectedTask && (
        <TaskEditorModal task={selectedTask} onClose={() => setSelectedTask(null)} onSaved={() => {/* tasks listener will update */}} />
      )}

      {viewType === 'calendar' && (
        <div>
          <CalendarView tasks={tagFilter ? tasks.filter(t => (t.tags || []).includes(tagFilter)) : tasks} onTaskClick={(t) => setSelectedTask(t)} onTaskDelete={handleDeleteTask} />
        </div>
      )}

      
    </div>
  );
}
