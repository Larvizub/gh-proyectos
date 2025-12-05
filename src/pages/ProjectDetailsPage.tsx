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
import { LayoutList, LayoutGrid, Calendar, Plus, Clipboard, Activity, Eye, CheckCircle, ArrowDown, Minus, ArrowUp, Zap, Edit3, Trash2, User, ArrowLeft, FileText } from 'lucide-react';
import ProjectModal from '@/components/projects/ProjectModal';
import ProjectCharterModal from '@/components/projects/ProjectCharterModal';
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskDeleteModalOpen, setTaskDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [charterModalOpen, setCharterModalOpen] = useState(false);

  // Task form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [newTaskSelectedTags, setNewTaskSelectedTags] = useState<string[]>([]);
  const [newTaskOpenTags, setNewTaskOpenTags] = useState(false);

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
      tags: newTaskSelectedTags || [],
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
    setNewTaskSelectedTags([]);
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

  function handleDeleteTask(taskId: string) {
    const t = (tasks || []).find((x) => x.id === taskId) || null;
    setTaskToDelete(t);
    setTaskDeleteModalOpen(true);
  }

  async function confirmDeleteTask() {
    if (!taskToDelete || !taskToDelete.id) return;
    const id = taskToDelete.id;
    setTaskDeleteModalOpen(false);
    setTaskToDelete(null);

    await toast.promise(
      tasksService.delete(id),
      {
        loading: 'Eliminando tarea...',
        success: 'Tarea eliminada',
        error: (err) => `Error: ${err?.message || 'No se pudo eliminar la tarea'}`,
      }
    );
  }

  

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header del proyecto */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <div 
                className="h-6 w-6 rounded-lg shadow-sm flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate">{project.name}</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">{project.description}</p>
          </div>
          
          {/* Botones de acción del proyecto - solo desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="h-9">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Proyectos
            </Button>
            <button
              type="button"
              aria-label="Editar proyecto"
              title="Editar proyecto"
              onClick={() => setModalOpen(true)}
              className="relative group inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Edit3 className="h-4 w-4" />
              <span className="sr-only">Editar proyecto</span>
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-background/90 text-sm px-2 py-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 shadow-sm">
                Editar proyecto
              </span>
            </button>
            <button
              type="button"
              aria-label="Eliminar proyecto"
              title="Eliminar proyecto"
              onClick={() => setDeleteModalOpen(true)}
              className="relative group inline-flex items-center justify-center rounded-md p-2 text-red-600 hover:bg-red-600/10 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Eliminar proyecto</span>
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-background/90 text-sm px-2 py-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 shadow-sm">
                Eliminar proyecto
              </span>
            </button>
          </div>
        </div>

        {/* Toolbar de controles - responsivo optimizado */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Fila 1 en mobile: Botón volver y acciones - solo mobile */}
          <div className="flex sm:hidden items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="h-9">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Proyectos
            </Button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Editar proyecto"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Eliminar proyecto"
                onClick={() => setDeleteModalOpen(true)}
                className="inline-flex items-center justify-center rounded-md p-2 text-red-600 hover:bg-red-600/10 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Fila 2: Filtro de tags y acción de nueva tarea */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {project.tags && project.tags.length > 0 ? (
                <div className="w-full sm:w-[200px]">
                  <Select value={tagFilter ?? ''} onChange={(v) => setTagFilter(v ? String(v) : null)} className="w-full">
                    <option value="">Todos los tags</option>
                    {project.tags.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </div>
              ) : null}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCharterModalOpen(true)}
                className="h-[38px] gap-2 whitespace-nowrap"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Acta de Constitución</span>
                <span className="sm:hidden">Acta</span>
              </Button>
            </div>
            
            <Button
              onClick={() => setShowNewTaskForm(!showNewTaskForm)}
              className="hidden sm:inline-flex h-11 shadow-sm whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Tarea
            </Button>
          </div>

          {/* Fila 3: Selector de vistas y botón nueva tarea para mobile */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-between sm:justify-start">
            {/* Selector de vista - compacto en mobile */}
            <div className="flex rounded-lg border-2 border-border bg-background p-0.5 sm:p-1 shadow-sm">
              <button
                onClick={() => {
                  if (isCompact) {
                    toast('La vista Lista no está disponible en pantallas pequeñas.');
                    return;
                  }
                  setViewType('list');
                }}
                className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-md transition-all ${
                  viewType === 'list' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'hover:bg-muted text-muted-foreground'
                } ${isCompact ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isCompact ? 'Lista no disponible en pantallas pequeñas' : 'Vista de lista'}
              >
                <LayoutList className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium hidden lg:inline">Lista</span>
              </button>
              <button
                onClick={() => setViewType('kanban')}
                className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-md transition-all ${
                  viewType === 'kanban' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                title="Vista Kanban"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium hidden lg:inline">Kanban</span>
              </button>
              <button
                onClick={() => {
                  if (isCompact) {
                    toast('La vista Gantt no está disponible en pantallas pequeñas.');
                    return;
                  }
                  setViewType('gantt');
                }}
                className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-md transition-all ${
                  viewType === 'gantt'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted text-muted-foreground'
                } ${isCompact ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isCompact ? 'Gantt no disponible en pantallas pequeñas' : 'Vista Gantt'}
              >
                <Activity className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium hidden lg:inline">Gantt</span>
              </button>
              <button
                onClick={() => setViewType('calendar')}
                className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-md transition-all ${
                  viewType === 'calendar' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                title="Vista de calendario"
              >
                <Calendar className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium hidden lg:inline">Calendario</span>
              </button>
            </div>
            
            {/* Botón nueva tarea (solo mobile) */}
            <Button 
              onClick={() => setShowNewTaskForm(!showNewTaskForm)}
              className="h-9 shadow-sm whitespace-nowrap sm:hidden"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">Nueva Tarea</span>
              <span className="xs:hidden">Nueva</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Modales */}
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
            await projectsService.update(payload.id, {
              name: payload.name,
              description: payload.description,
              color: payload.color,
              status: payload.status,
              tags: payload.tags,
              owners: payload.owners,
              ownerId: payload.ownerId,
              memberIds: payload.owners
            });
            const updated = await projectsService.get(payload.id);
            setProject(updated);
            toast.success('Proyecto actualizado');
          } catch (err) {
            console.error('Error updating project', err);
            toast.error('No se pudo actualizar el proyecto');
          }
        }}
      />

      {/* Delete confirmation modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteModalOpen(false)} />
          <div className="relative w-full max-w-lg z-10">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Confirmar eliminación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Estás a punto de eliminar el proyecto <strong>{project?.name}</strong>. Esta acción eliminará todas las tareas asociadas y los tags del proyecto y no se puede deshacer. ¿Deseas continuar?
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!project?.id) return;
                      setDeleteModalOpen(false);
                      try {
                        await toast.promise((async () => {
                          // obtener tareas del proyecto y eliminarlas
                          const projTasks = await tasksService.getByProject(project.id);
                          for (const t of projTasks) {
                            try {
                              await tasksService.delete(t.id!);
                            } catch (e) {
                              // continuar con las demás incluso si una falla
                              console.warn('Failed to delete task', t.id, e);
                            }
                          }
                          // finalmente eliminar el proyecto
                          await projectsService.delete(project.id);
                        })(), {
                          loading: 'Eliminando proyecto y tareas...',
                          success: 'Proyecto y tareas eliminados',
                          error: (err) => `Error: ${err?.message || 'No se pudo eliminar el proyecto'}`,
                        });
                        navigate('/projects');
                      } catch (err) {
                        console.error('Error deleting project', err);
                        toast.error('No se pudo eliminar el proyecto');
                      }
                    }}
                  >Eliminar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Task delete confirmation modal */}
      {taskDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setTaskDeleteModalOpen(false); setTaskToDelete(null); }} />
          <div className="relative w-full max-w-md z-10">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Eliminar tarea</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Estás a punto de eliminar la tarea <strong>{taskToDelete?.title}</strong>. Esta acción no se puede deshacer. ¿Deseas continuar?
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setTaskDeleteModalOpen(false); setTaskToDelete(null); }}>Cancelar</Button>
                  <Button variant="destructive" onClick={confirmDeleteTask}>Eliminar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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
              
              <div>
                <label className="text-sm font-medium">Tags del proyecto</label>
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newTaskSelectedTags.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Sin tags seleccionados</span>
                    ) : (
                      newTaskSelectedTags.map(t => (
                        <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/70 text-sm">
                          <span className="truncate max-w-[14rem] font-medium">{t}</span>
                          <button type="button" title={`Remover ${t}`} className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/10 hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => setNewTaskSelectedTags(prev => prev.filter(x => x !== t))}>×</button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="relative">
                    <button type="button" className="w-full rounded-md border border-input bg-input px-3 py-2 text-left text-sm text-foreground shadow-sm flex items-center justify-between" onClick={() => setNewTaskOpenTags(prev => !prev)}>
                      <span className="truncate">{newTaskSelectedTags.length === 0 ? 'Añadir tags…' : 'Modificar tags'}</span>
                      <svg className="h-4 w-4 text-muted-foreground ml-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                      </svg>
                    </button>
                    {newTaskOpenTags && (
                      <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md bg-popover shadow-lg ring-1 ring-black/10 p-2">
                        <div className="flex flex-col gap-1">
                          {(!project.tags || project.tags.length === 0) ? (
                            <div className="p-2 text-sm text-muted-foreground">Este proyecto no tiene tags definidos.</div>
                          ) : project.tags.map(tag => (
                            <label key={tag} className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-muted text-sm">
                              <input type="checkbox" checked={newTaskSelectedTags.includes(tag)} onChange={(e) => {
                                setNewTaskSelectedTags(prev => e.target.checked ? [...prev, tag] : prev.filter(x => x !== tag));
                              }} />
                              <span>{tag}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
        <div className="w-full max-w-full">
          <KanbanBoard 
            tasks={tagFilter ? tasks.filter(t => (t.tags || []).includes(tagFilter)) : tasks} 
            onTaskClick={(task) => setSelectedTask(task)}
            onTaskStatusChange={handleTaskStatusChange}
            onTaskDelete={handleDeleteTask}
          />
        </div>
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

      {/* Modal Acta de Constitución */}
      {project && (
        <ProjectCharterModal
          project={project}
          open={charterModalOpen}
          onClose={() => setCharterModalOpen(false)}
        />
      )}

      
    </div>
  );
}
