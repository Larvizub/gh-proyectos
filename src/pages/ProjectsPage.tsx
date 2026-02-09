import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, CheckCircle, Calendar, Trophy, Users, User, LayoutGrid, List, Search, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { projectsService, tasksService } from '@/services/firebase.service';
import ProjectModal from '@/components/projects/ProjectModal';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/contexts/UsersContext';
import { PageLoader } from '@/components/PageLoader';

export function ProjectsPage() {
  const { user } = useAuth();
  const { users } = useUsers();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Estados para filtros y vista
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');

  useEffect(() => {
    const unsubscribe = projectsService.listen((projectsData) => {
      setProjects(projectsData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);
  // Obtener tareas del usuario para incluir proyectos donde el usuario tenga tareas asignadas
  const [assignedProjectIds, setAssignedProjectIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        const tasks = await tasksService.getAll();
        const ids = new Set<string>();
        tasks.forEach((t) => {
          // detectar asignaciones en varios formatos
          const taskAny = t as any;
          const assigned = taskAny.assignedTo;
          if (assigned) {
            if (typeof assigned === 'string') {
              if (assigned === user.id || String(assigned).toLowerCase() === String(user.email).toLowerCase()) {
                if (t.projectId) ids.add(t.projectId);
              }
            } else if (typeof assigned === 'object') {
              if (assigned.userId === user.id || String(assigned.email || '').toLowerCase() === String(user.email).toLowerCase()) {
                if (t.projectId) ids.add(t.projectId);
              }
            }
          }
          const assigneeIds = t.assigneeIds || taskAny.assignedUserIds || null;
          if (Array.isArray(assigneeIds) && assigneeIds.includes(user.id)) {
            if (t.projectId) ids.add(t.projectId);
          }
        });
        if (mounted) setAssignedProjectIds(ids);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to load tasks to compute assigned projects', err);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  // Memorizar el filtrado para evitar recálculos en cada render
  const userProjects = useMemo(() => {
    let filtered = projects.filter(
      p => p.ownerId === user?.id || p.memberIds?.includes(user?.id || '') || p.owners?.includes(user?.id || '') || assignedProjectIds.has(p.id)
    );

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description?.toLowerCase().includes(query)
      );
    }

    // Filtrar por miembro seleccionado
    if (selectedMemberId !== 'all') {
      filtered = filtered.filter(p => 
        p.memberIds?.includes(selectedMemberId) || 
        p.owners?.includes(selectedMemberId) ||
        p.ownerId === selectedMemberId
      );
    }

    // Ordenar alfabéticamente por nombre
    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [projects, user?.id, assignedProjectIds, searchQuery, selectedMemberId]);

  // Ordenar usuarios alfabéticamente para el selector
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = a.displayName || a.email;
      const nameB = b.displayName || b.email;
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }, [users]);

  if (loading) {
    // No usamos el overlay completo aquí para evitar un parpadeo al navegar entre rutas.
    return <PageLoader message="Cargando proyectos..." overlay={false} />;
  }
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <FolderKanban className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground">Gestiona tus proyectos y tareas</p>
        </div>
        <div className="ml-auto">
          <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow" onClick={() => navigate('/projects/new')}>
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Proyecto
          </Button>
        </div>
      </div>

      {/* Filtros y controles de vista */}
      {projects.length > 0 && (
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Búsqueda por nombre */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o descripción..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filtro por persona */}
              <div className="w-full lg:w-64">
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border-2 border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <option value="all">Todos los miembros</option>
                  {sortedUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de vista */}
              <div className="flex gap-2 border rounded-lg p-1 bg-muted/50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-all ${
                    viewMode === 'grid'
                      ? 'bg-background shadow-sm text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Vista de tarjetas"
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-all ${
                    viewMode === 'list'
                      ? 'bg-background shadow-sm text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Vista de lista"
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Indicador de filtros activos */}
            {(searchQuery || selectedMemberId !== 'all') && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>
                  Mostrando {userProjects.length} de {projects.filter(p => p.ownerId === user?.id || p.memberIds?.includes(user?.id || '') || p.owners?.includes(user?.id || '') || assignedProjectIds.has(p.id)).length} proyectos
                </span>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedMemberId('all');
                  }}
                  className="ml-2 text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="rounded-full bg-primary/10 p-6 mb-4">
              <FolderKanban className="h-16 w-16 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No hay proyectos</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Comienza creando tu primer proyecto y empieza a organizar tus tareas de manera eficiente
            </p>
            <Button size="lg" className="shadow-lg" onClick={() => navigate('/projects/new')}>
              <Plus className="mr-2 h-5 w-5" />
              Crear Proyecto
            </Button>
          </CardContent>
        </Card>
      ) : userProjects.length === 0 ? (
        <Card className="border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron proyectos</h3>
            <p className="text-muted-foreground text-center mb-4">
              Intenta ajustar los filtros de búsqueda
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedMemberId('all');
              }}
            >
              Limpiar filtros
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {userProjects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`}> 
              <Card className="hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 hover:border-primary/50 hover:scale-[1.02] group">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div 
                        className="h-10 w-10 rounded-xl shadow-md flex-shrink-0 ring-2 ring-white dark:ring-gray-950"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-1">
                          {project.name}
                        </CardTitle>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-3 py-1.5 rounded-full font-semibold shadow-sm flex-shrink-0 ${
                      project.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                        : project.status === 'completed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}>
                      {project.status === 'active' ? (
                        <>
                          <CheckCircle className="h-4 w-4 inline-block mr-2" />
                          Activo
                        </>
                      ) : project.status === 'completed' ? (
                        <>
                          <Trophy className="h-4 w-4 inline-block mr-2" />
                          Completado
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 inline-block mr-2" />
                          Planeado
                        </>
                      )}
                    </span>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingProject(project); setModalOpen(true); }}
                        title="Editar proyecto"
                        className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-muted/20 hover:bg-muted"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2 mt-3 text-base leading-relaxed">
                    {project.description || 'Sin descripción'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
                    <span className="flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4" />
                      <span>{project.memberIds.length} miembros</span>
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      project.ownerId === user?.id 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {project.ownerId === user?.id ? (
                        <>
                          <Trophy className="h-3.5 w-3.5 inline-block mr-1" />
                          Propietario
                        </>
                      ) : (
                        <>
                          <User className="h-3.5 w-3.5 inline-block mr-1" />
                          Miembro
                        </>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        /* Vista de lista/tabla */
        <div className="space-y-4">
          {userProjects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 group">
                <CardContent className="p-5">
                  <div className="flex items-center gap-5">
                    {/* Color indicator */}
                    <div 
                      className="h-14 w-14 rounded-xl shadow-md flex-shrink-0 ring-2 ring-white dark:ring-gray-950"
                      style={{ backgroundColor: project.color }}
                    />
                    
                    {/* Información del proyecto */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="text-lg font-bold group-hover:text-primary transition-colors truncate">
                          {project.name}
                        </h3>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold shadow-sm flex-shrink-0 ${
                          project.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                            : project.status === 'completed'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                        }`}>
                          {project.status === 'active' ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5 inline-block mr-1" />
                              Activo
                            </>
                          ) : project.status === 'completed' ? (
                            <>
                              <Trophy className="h-3.5 w-3.5 inline-block mr-1" />
                              Completado
                            </>
                          ) : (
                            <>
                              <Calendar className="h-3.5 w-3.5 inline-block mr-1" />
                              Planeado
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 leading-relaxed">
                        {project.description || 'Sin descripción'}
                      </p>
                    </div>

                    {/* Estadísticas */}
                    <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{project.memberIds.length} miembros</span>
                      </div>
                      
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        project.ownerId === user?.id 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {project.ownerId === user?.id ? (
                          <>
                            <Trophy className="h-3.5 w-3.5 inline-block mr-1" />
                            Propietario
                          </>
                        ) : (
                          <>
                            <User className="h-3.5 w-3.5 inline-block mr-1" />
                            Miembro
                          </>
                        )}
                      </span>
                    </div>

                    {/* Botón de editar */}
                    <button
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        setEditingProject(project); 
                        setModalOpen(true); 
                      }}
                      title="Editar proyecto"
                      className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-muted/20 hover:bg-muted transition-colors"
                    >
                      Editar
                    </button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {editingProject && modalOpen && (
        <ProjectModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingProject(null); }}
          initial={editingProject}
          onSave={async (payload: Partial<Project> & { id?: string }) => {
            try {
              if (payload.id) {
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
                toast.success('Proyecto actualizado');
              } else {
                if (!user) {
                  toast.error('Debes iniciar sesión para crear proyectos');
                  return;
                }
                const createPayload: any = {
                  name: payload.name,
                  description: payload.description,
                  color: payload.color || '#6366f1',
                  tags: payload.tags || [],
                  status: 'active',
                  ownerId: user.id,
                  memberIds: [user.id],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                await projectsService.create(createPayload);
                toast.success('Proyecto creado correctamente');
              }
              setModalOpen(false);
              setEditingProject(null);
            } catch (err) {
              console.error('Error saving project', err);
              toast.error('No se pudo guardar el proyecto');
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}
