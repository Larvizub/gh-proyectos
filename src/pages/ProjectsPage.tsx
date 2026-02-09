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
  const { usersMap, loading: usersLoading } = useUsers();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Estados para filtros y vista
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

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

  // Obtener miembros únicos de los proyectos del usuario con información completa
  const projectMembers = useMemo(() => {
    // Si los usuarios aún no se cargaron, retornar array vacío
    if (usersLoading || Object.keys(usersMap).length === 0) {
      console.log('🔍 Esperando usuarios... usersLoading:', usersLoading, 'usersMap size:', Object.keys(usersMap).length);
      return [];
    }

    const memberIdsSet = new Set<string>();
    const allUserProjects = projects.filter(
      p => p.ownerId === user?.id || p.memberIds?.includes(user?.id || '') || p.owners?.includes(user?.id || '') || assignedProjectIds.has(p.id)
    );

    allUserProjects.forEach(project => {
      // Añadir owner
      if (project.ownerId) memberIdsSet.add(project.ownerId);
      // Añadir owners array
      if (project.owners) project.owners.forEach(id => memberIdsSet.add(id));
      // Añadir memberIds
      if (project.memberIds) project.memberIds.forEach(id => memberIdsSet.add(id));
    });

    // Usar usersMap en lugar de find para mejor performance
    const members = Array.from(memberIdsSet)
      .map(id => usersMap[id])
      .filter(Boolean)
      .sort((a, b) => {
        const nameA = a.displayName || a.email;
        const nameB = b.displayName || b.email;
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      });

    // Debug temporal
    console.log('🔍 Debug - Miembros de proyectos:', {
      totalProjects: allUserProjects.length,
      memberIds: Array.from(memberIdsSet),
      usersMapKeys: Object.keys(usersMap).length,
      mappedMembers: members.length,
      members: members.map(m => ({ id: m.id, name: m.displayName || m.email }))
    });

    return members;
  }, [projects, usersMap, usersLoading, user?.id, assignedProjectIds]);

  // Filtrar miembros según la búsqueda
  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) {
      console.log('🔍 Sin búsqueda, mostrando todos los miembros:', projectMembers.length);
      return projectMembers;
    }
    const query = memberSearchQuery.toLowerCase();
    const filtered = projectMembers.filter(member => {
      const name = member.displayName || member.email;
      return name.toLowerCase().includes(query);
    });
    console.log('🔍 Búsqueda:', memberSearchQuery, '- Resultados:', filtered.length);
    return filtered;
  }, [projectMembers, memberSearchQuery]);

  // Obtener el nombre del miembro seleccionado
  const selectedMemberName = useMemo(() => {
    if (selectedMemberId === 'all') return '';
    const member = projectMembers.find(m => m.id === selectedMemberId);
    return member ? (member.displayName || member.email) : '';
  }, [selectedMemberId, projectMembers]);

  if (loading || usersLoading) {
    // No usamos el overlay completo aquí para evitar un parpadeo al navegar entre rutas.
    return <PageLoader message="Cargando proyectos..." overlay={false} />;
  }
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <FolderKanban className="w-7 h-7 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Proyectos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Gestiona tus proyectos y tareas</p>
          </div>
        </div>
        <div className="sm:ml-auto">
          <Button size="lg" className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow" onClick={() => navigate('/projects/new')}>
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Proyecto
          </Button>
        </div>
      </div>

      {/* Filtros y controles de vista */}
      {projects.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            {/* Búsqueda por nombre */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filtro por persona con búsqueda */}
            <div className="w-full lg:w-80 relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por miembro..."
                value={selectedMemberId === 'all' ? memberSearchQuery : selectedMemberName}
                onChange={(e) => {
                  setMemberSearchQuery(e.target.value);
                  if (selectedMemberId !== 'all') {
                    setSelectedMemberId('all');
                  }
                }}
                onFocus={() => setShowMemberDropdown(true)}
                onBlur={() => setTimeout(() => setShowMemberDropdown(false), 200)}
                className="pl-10 pr-10 h-10"
              />
              {selectedMemberId !== 'all' && (
                <button
                  onClick={() => {
                    setSelectedMemberId('all');
                    setMemberSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              {/* Dropdown de sugerencias */}
              {showMemberDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-background border-2 border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {projectMembers.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                      <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No hay miembros en tus proyectos</p>
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No se encontraron miembros</p>
                      <p className="text-xs mt-1">Intenta con otro nombre</p>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedMemberId('all');
                          setMemberSearchQuery('');
                          setShowMemberDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm border-b"
                      >
                        <span className="font-medium">Todos los miembros</span>
                        <span className="text-muted-foreground ml-2">({projectMembers.length})</span>
                      </button>
                      {filteredMembers.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            setSelectedMemberId(member.id);
                            setMemberSearchQuery('');
                            setShowMemberDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm ${
                            selectedMemberId === member.id ? 'bg-primary/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {member.photoURL ? (
                              <img
                                src={member.photoURL}
                                alt={member.displayName || member.email}
                                className="h-6 w-6 rounded-full"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                                <User className="h-3 w-3 text-primary" />
                              </div>
                            )}
                            <span>{member.displayName || member.email}</span>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Selector de vista */}
            <div className="flex gap-1 border rounded-md p-1 bg-muted/50 w-full sm:w-auto h-10">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex-1 sm:flex-none px-3 rounded transition-all flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-background shadow-sm text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Vista de tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:flex-none px-3 rounded transition-all flex items-center justify-center ${
                  viewMode === 'list'
                    ? 'bg-background shadow-sm text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Vista de lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Indicador de filtros activos */}
          {(searchQuery || selectedMemberId !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Mostrando {userProjects.length} de {projects.filter(p => p.ownerId === user?.id || p.memberIds?.includes(user?.id || '') || p.owners?.includes(user?.id || '') || assignedProjectIds.has(p.id)).length} proyectos
              </span>
              {selectedMemberId !== 'all' && selectedMemberName && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  <User className="h-3 w-3" />
                  {selectedMemberName}
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMemberId('all');
                  setMemberSearchQuery('');
                }}
                className="ml-2 text-primary hover:underline font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
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
                setMemberSearchQuery('');
              }}
            >
              Limpiar filtros
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {userProjects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`}> 
              <Card className="hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 hover:border-primary/50 hover:scale-[1.02] group">
                <CardHeader className="pb-3 sm:pb-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div 
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl shadow-md flex-shrink-0 ring-2 ring-white dark:ring-gray-950"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-xl group-hover:text-primary transition-colors line-clamp-1">
                          {project.name}
                        </CardTitle>
                      </div>
                    </div>
                  </div>
                  {/* Status y botón editar en una segunda fila en móvil */}
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <span className={`text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-semibold shadow-sm flex-shrink-0 whitespace-nowrap ${
                      project.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                        : project.status === 'completed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}>
                      {project.status === 'active' ? (
                        <>
                          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 inline-block mr-1 sm:mr-2" />
                          Activo
                        </>
                      ) : project.status === 'completed' ? (
                        <>
                          <Trophy className="h-3 w-3 sm:h-4 sm:w-4 inline-block mr-1 sm:mr-2" />
                          Completado
                        </>
                      ) : (
                        <>
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 inline-block mr-1 sm:mr-2" />
                          Planeado
                        </>
                      )}
                    </span>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingProject(project); setModalOpen(true); }}
                      title="Editar proyecto"
                      className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm bg-muted/20 hover:bg-muted"
                    >
                      Editar
                    </button>
                  </div>
                  <CardDescription className="line-clamp-2 mt-2 sm:mt-3 text-sm sm:text-base leading-relaxed">
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
