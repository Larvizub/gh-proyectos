import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { projectsService, tasksService, charterService, risksService } from '@/services/firebase.service';
import { Task, Project, ViewType, TaskStatus, ProjectCharter, Risk } from '@/types';
import { Button } from '@/components/ui/button';
import { usersService } from '@/services/firebase.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import GanttChart from '@/components/tasks/GanttChart';
import TaskEditorModal from '@/components/tasks/TaskEditorModal';
import { LayoutList, LayoutGrid, Calendar, Plus, Clipboard, Activity, Eye, CheckCircle, ArrowDown, Minus, ArrowUp, Zap, Edit3, Trash2, User, ArrowLeft, FileText, Info, AlertTriangle, ExternalLink } from 'lucide-react';
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
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus | 'overdue'>('all');
  const [openTagFilter, setOpenTagFilter] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewType, setViewType] = useState<ViewType>('overview');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskDeleteModalOpen, setTaskDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [charterModalOpen, setCharterModalOpen] = useState(false);
  const [charter, setCharter] = useState<ProjectCharter | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);

  const isOwner = project && user && (
    project.ownerId === user.id || 
    (project.owners || []).includes(user.id)
  );

  const allTasksCompleted = tasks.length > 0 && tasks.every(t => t.status === 'completed');
  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
  const totalTasksCount = tasks.length;
  const progressPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const filteredTasks = useMemo(() => {
    let result = tasks;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTs = todayStart.getTime();

    if (tagFilters.length > 0) {
      result = result.filter(t => (t.tags || []).some(tag => tagFilters.includes(tag)));
    }

    if (statusFilter === 'overdue') {
      result = result.filter(t => typeof t.dueDate === 'number' && t.dueDate < todayStartTs && t.status !== 'completed');
    } else if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    return result;
  }, [tasks, tagFilters, statusFilter]);

  const handleCloseProject = async () => {
    if (!project) return;
    if (!confirm('¿Estás seguro de cerrar este proyecto? Esto lo moverá a la sección de Lecciones Aprendidas.')) return;
    
    try {
      await projectsService.update(project.id, { status: 'completed' });
      toast.success('Proyecto cerrado exitosamente');
      navigate('/lessons');
    } catch (error) {
      console.error('Error closing project:', error);
      toast.error('Error al cerrar el proyecto');
    }
  };

  // Task form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [newTaskSelectedTags, setNewTaskSelectedTags] = useState<string[]>([]);
  const [newTaskOpenTags, setNewTaskOpenTags] = useState(false);
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskAssigneeInput, setNewTaskAssigneeInput] = useState('');
  const [newTaskFiles, setNewTaskFiles] = useState<File[]>([]);
  const [newTaskFileInputKey, setNewTaskFileInputKey] = useState(Date.now());

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

    // Listener para el proyecto
    const unsubProject = projectsService.subscribeToProject(id, (p: Project | null) => {
      if (mounted) {
        setProject(p);
        setLoading(false);
      }
    });

    // Listener para el Acta
    const unsubCharter = charterService.listen(id, (c: ProjectCharter | null) => {
      if (mounted) {
        setCharter(c);
      }
    });

    // Listener para Riesgos
    const unsubRisks = risksService.listenByProject(id, (list: Risk[]) => {
      if (mounted) {
        setRisks(list.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)));
      }
    });

    return () => {
      mounted = false;
      unsubProject();
      unsubCharter();
      unsubRisks();
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
      assigneeIds: newTaskAssignees || [],
      creatorId: user.id,
      tags: newTaskSelectedTags || [],
      attachments: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let newTaskId: string | null = null;
    await toast.promise(
      (async () => {
        newTaskId = await tasksService.create(payload as any);
        // if files were attached, upload them and let tasksService.append attachments
        if (newTaskFiles && newTaskFiles.length > 0 && newTaskId) {
          for (const f of newTaskFiles) {
            try {
              await tasksService.uploadAttachment(newTaskId, f, user.id);
            } catch (err) {
              console.warn('Failed uploading attachment for new task', err);
            }
          }
        }
      })(),
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
    setNewTaskAssignees([]);
    setNewTaskAssigneeInput('');
    setNewTaskFiles([]);
    setNewTaskFileInputKey(Date.now());
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
                <div className="w-full sm:w-[200px] relative">
                  <button
                    type="button"
                    onClick={() => setOpenTagFilter(!openTagFilter)}
                    className="w-full rounded-md border border-input bg-input px-3 py-2 text-left text-sm text-foreground shadow-sm flex items-center justify-between"
                  >
                    <span className="truncate">
                      {tagFilters.length === 0 ? 'Todos los tags' : 
                       tagFilters.length === 1 ? tagFilters[0] : 
                       `${tagFilters.length} tags seleccionados`}
                    </span>
                    <svg className={`h-4 w-4 text-muted-foreground ml-3 transition-transform ${openTagFilter ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                    </svg>
                  </button>
                  
                  {openTagFilter && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setOpenTagFilter(false)} 
                      />
                      <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md bg-popover shadow-lg ring-1 ring-black/10 p-1">
                        <button
                          onClick={() => {
                            setTagFilters([]);
                            setOpenTagFilter(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${tagFilters.length === 0 ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                          Todos los tags
                        </button>
                        <div className="h-px bg-border my-1" />
                        {[...(project.tags || [])].sort((a, b) => a.localeCompare(b)).map(tag => (
                          <label 
                            key={tag} 
                            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm cursor-pointer transition-colors"
                          >
                            <input 
                              type="checkbox" 
                              className="rounded border-input text-primary focus:ring-primary"
                              checked={tagFilters.includes(tag)} 
                              onChange={(e) => {
                                setTagFilters(prev => 
                                  e.target.checked 
                                    ? [...prev, tag] 
                                    : prev.filter(x => x !== tag)
                                );
                              }} 
                            />
                            <span className="truncate">{tag}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              <div className="w-full sm:w-[200px]">
                <Select value={statusFilter} onChange={(v) => setStatusFilter(v as 'all' | TaskStatus | 'overdue')}>
                  <option value="all">Todos los estados</option>
                  <option value="todo">Por hacer</option>
                  <option value="in-progress">En progreso</option>
                  <option value="review">En revisión</option>
                  <option value="completed">Completada</option>
                  <option value="overdue">Vencidas</option>
                </Select>
              </div>
              
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

            {allTasksCompleted && project?.status !== 'completed' && (
              <Button
                onClick={handleCloseProject}
                variant="destructive"
                className="hidden sm:inline-flex h-11 shadow-sm whitespace-nowrap"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Cierre del Proyecto
              </Button>
            )}
          </div>

          {/* Fila 3: Selector de vistas y botón nueva tarea para mobile */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-between sm:justify-start">
            {/* Selector de vista - compacto en mobile */}
            <div className="flex rounded-lg border-2 border-border bg-background p-0.5 sm:p-1 shadow-sm">
              <button
                onClick={() => setViewType('overview')}
                className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-md transition-all ${
                  viewType === 'overview' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                title="Resumen del Proyecto"
              >
                <Info className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium hidden lg:inline">Resumen</span>
              </button>
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
            <div className="flex gap-2 sm:hidden">
              <Button 
                onClick={() => setShowNewTaskForm(!showNewTaskForm)}
                className="h-9 shadow-sm whitespace-nowrap"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Nueva Tarea</span>
                <span className="xs:hidden">Nueva</span>
              </Button>

              {allTasksCompleted && project?.status !== 'completed' && (
                <Button
                  onClick={handleCloseProject}
                  variant="destructive"
                  className="h-9 shadow-sm whitespace-nowrap"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
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
                          ) : [...(project.tags || [])].sort((a, b) => a.localeCompare(b)).map(tag => (
                            <label key={tag} className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-muted text-sm cursor-pointer">
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
              
              <div>
                <label className="text-sm font-medium">Asignar a</label>
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newTaskAssignees.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Sin asignar</span>
                    ) : (
                      newTaskAssignees.map(id => {
                        const u = usersMap[id];
                        return (
                          <span key={id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/70 text-sm">
                            <span className="truncate max-w-[14rem]">{u?.displayName || u?.email || id}</span>
                            <button type="button" className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/10 hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => setNewTaskAssignees(prev => prev.filter(x => x !== id))}>×</button>
                          </span>
                        );
                      })
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input list="newtask-assignees-list" value={newTaskAssigneeInput} onChange={e => setNewTaskAssigneeInput(e.target.value)} placeholder={newTaskAssignees.length === 0 ? 'Añadir asignado por nombre o email' : 'Añadir más...'} className="flex-1 h-10 rounded-md border border-input bg-input px-3 text-sm" />
                    <button type="button" className="inline-flex items-center gap-2 px-4 h-10 rounded-md bg-primary text-primary-foreground" onClick={() => {
                      const val = (newTaskAssigneeInput || '').trim();
                      if (!val) return;
                      // try to find by email or displayName
                      const found = Object.values(usersMap).find((u: any) => (u.email || '').toLowerCase() === val.toLowerCase() || (u.displayName || '').toLowerCase() === val.toLowerCase());
                      if (found && found.id) {
                        setNewTaskAssignees(prev => prev.includes(found.id) ? prev : [...prev, found.id]);
                        setNewTaskAssigneeInput('');
                        return;
                      }
                      // try partial match
                      const partial = Object.values(usersMap).find((u: any) => (u.displayName || '').toLowerCase().includes(val.toLowerCase()) || (u.email || '').toLowerCase().includes(val.toLowerCase()));
                      if (partial && partial.id) {
                        setNewTaskAssignees(prev => prev.includes(partial.id) ? prev : [...prev, partial.id]);
                        setNewTaskAssigneeInput('');
                      }
                    }}>Añadir</button>
                  </div>
                  <datalist id="newtask-assignees-list">
                    {Object.values(usersMap).map((u: any) => <option key={u.id} value={u.email || u.id}>{u.displayName || u.email}</option>)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Adjuntos (opcional)</label>
                <div className="mt-2">
                  <div className="flex items-center gap-3">
                    <input id="newtask-file-input" key={String(newTaskFileInputKey)} type="file" multiple onChange={e => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      setNewTaskFiles(files);
                    }} className="hidden" />
                    <label htmlFor="newtask-file-input" className={`inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground cursor-pointer` }>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12v9m0-9l3.5 3.5M12 12L8.5 15.5M16 5l-4-4-4 4"/></svg>
                      <span className="text-sm">Elegir archivos</span>
                    </label>
                    <span className="text-sm text-muted-foreground">{newTaskFiles.length === 0 ? 'Sin archivos seleccionados' : `${newTaskFiles.length} archivo(s) seleccionado(s)`}</span>
                  </div>
                  {newTaskFiles.length > 0 && (
                    <div className="mt-2 grid gap-2">
                      {newTaskFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-muted/5 rounded px-3 py-2 text-sm">
                          <div className="truncate mr-2">{f.name}</div>
                          <button type="button" className="text-destructive" onClick={() => setNewTaskFiles(prev => prev.filter((_, i) => i !== idx))}>Remover</button>
                        </div>
                      ))}
                    </div>
                  )}
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
      {viewType === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Acta de Constitución</CardTitle>
                    <p className="text-xs text-muted-foreground">Información estratégica y objetivos</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCharterModalOpen(true)} className="gap-2">
                  {charter ? <Eye className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {charter ? (isOwner ? 'Ver / Editar' : 'Ver Acta') : 'Completar'}
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                {charter ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Objetivos Medibles</p>
                        <p className="text-sm leading-relaxed line-clamp-4">{charter.objectives || 'No definidos'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Criterios de Éxito</p>
                        <p className="text-sm leading-relaxed line-clamp-4">{charter.successCriteria || 'No definidos'}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-dashed">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Stakeholders Clave</p>
                        <p className="text-sm leading-relaxed line-clamp-2 italic text-muted-foreground">
                          {charter.keyStakeholders || 'No definidos'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Patrocinador</p>
                        <p className="text-sm font-medium">
                          {charter.projectSponsor || 'No asignado'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center bg-muted/20 rounded-xl border-2 border-dashed">
                    <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm mb-4">El acta de constitución es necesaria para formalizar el proyecto.</p>
                    {isOwner ? (
                      <Button onClick={() => setCharterModalOpen(true)} variant="secondary" size="sm">
                        Completar Acta de Constitución
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">El acta aún no ha sido completada por el dueño del proyecto.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Matriz de Riesgos</CardTitle>
                    <p className="text-xs text-muted-foreground">Top riesgos identificados</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/risks/${project.id}`)} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Ver Matriz
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                {risks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {risks.slice(0, 4).map(risk => (
                      <div key={risk.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:border-orange-500/30 transition-colors">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-sm font-semibold truncate">{risk.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground uppercase">Score: {risk.riskScore}</span>
                          </div>
                        </div>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          risk.riskScore >= 16 ? 'bg-red-500 text-white' :
                          risk.riskScore >= 10 ? 'bg-orange-500 text-white' :
                          risk.riskScore >= 5 ? 'bg-yellow-500 text-black' :
                          'bg-green-500 text-white'
                        }`}>
                          {risk.riskScore}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center bg-muted/20 rounded-xl border-2 border-dashed">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm mb-4">No se han identificado riesgos en este proyecto.</p>
                    {isOwner ? (
                      <Button onClick={() => navigate(`/risks/${project.id}`)} variant="secondary" size="sm">
                        Identificar Primer Riesgo
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">El equipo aún no ha reportado riesgos.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 bg-primary/5 border-primary/20 shadow-sm">
              <CardHeader className="pb-2 border-b border-primary/10">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Estado de Avance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Progreso General</span>
                    <span className="text-primary font-bold">{progressPercentage}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden border">
                    <div 
                      className="h-full bg-primary transition-all duration-1000 ease-out" 
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-background rounded-lg border shadow-sm">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Tareas</p>
                    <p className="text-2xl font-bold">{totalTasksCount}</p>
                  </div>
                  <div className="p-3 bg-background rounded-lg border shadow-sm">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Completadas</p>
                    <p className="text-2xl font-bold text-green-600">{completedTasksCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Sobre el Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Descripción</p>
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {project.description || 'Sin descripción detallada.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Propietario</p>
                    <p className="text-sm font-medium">{usersMap[project.ownerId]?.displayName || usersMap[project.ownerId]?.email || 'Cargando...'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-primary" />
                  Próximos Pasos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasks.filter(t => t.status !== 'completed').slice(0, 3).map(task => (
                    <div key={task.id} className="flex items-start gap-3 text-sm">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                        task.priority === 'urgent' ? 'bg-red-500 animate-pulse' :
                        task.priority === 'high' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Vence: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Sin fecha'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => t.status !== 'completed').length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No hay tareas pendientes.</p>
                  )}
                  <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setViewType('kanban')}>
                    Ir al tablero Kanban
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {viewType === 'kanban' && (
        <div className="w-full max-w-full">
          <KanbanBoard 
            tasks={filteredTasks}
            onTaskClick={(task) => setSelectedTask(task)}
            onTaskStatusChange={handleTaskStatusChange}
            onTaskDelete={handleDeleteTask}
          />
        </div>
      )}

      {viewType === 'gantt' && (
        <GanttChart tasks={filteredTasks} onTaskClick={(t) => setSelectedTask(t)} onTaskDelete={handleDeleteTask} />
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
                  {(filteredTasks.length === 0) ? (
                    <tr><td colSpan={9} className="p-6 text-muted-foreground text-center">No hay tareas que coincidan con los filtros</td></tr>
                  ) : (
                    filteredTasks.map(task => (
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
          <CalendarView tasks={filteredTasks} onTaskClick={(t) => setSelectedTask(t)} onTaskDelete={handleDeleteTask} />
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
