import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, CheckCircle, Calendar, Trophy, Users, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { projectsService, tasksService } from '@/services/firebase.service';
import ProjectModal from '@/components/projects/ProjectModal';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import PageLoader from '@/components/PageLoader';

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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
          const assigned = t?.assignedTo;
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
          const assigneeIds = t?.assigneeIds || t?.assignedUserIds || null;
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
    return projects.filter(
      p => p.ownerId === user?.id || p.memberIds?.includes(user?.id || '') || assignedProjectIds.has(p.id)
    );
  }, [projects, user?.id, assignedProjectIds]);

  if (loading) {
    // No usamos el overlay completo aquí para evitar un parpadeo al navegar entre rutas.
    return <PageLoader message="Cargando proyectos..." overlay={false} />;
  }
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Proyectos
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Gestiona tus proyectos y tareas
          </p>
        </div>
        <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow" onClick={() => navigate('/projects/new')}>
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Proyecto
        </Button>
      </div>

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
      ) : (
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
      )}
      {editingProject && modalOpen && (
        <ProjectModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingProject(null); }}
          initial={editingProject}
          onSave={async (payload: Partial<Project> & { id?: string }) => {
            try {
              if (payload.id) {
                await projectsService.update(payload.id, { name: payload.name, description: payload.description, color: payload.color, status: payload.status, tags: payload.tags });
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
