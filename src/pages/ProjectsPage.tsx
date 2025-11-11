import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { projectsService } from '@/services/firebase.service';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import PageLoader from '@/components/PageLoader';

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = projectsService.listen((projectsData) => {
      // Filtrar proyectos donde el usuario es miembro o dueño
      const userProjects = projectsData.filter(
        p => p.ownerId === user?.id || p.memberIds.includes(user?.id || '')
      );
      setProjects(userProjects);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  if (loading) {
    return <PageLoader message="Cargando proyectos..." />;
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
        <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
          <Link to="/projects/new">
            <Plus className="mr-2 h-5 w-5" />
            Nuevo Proyecto
          </Link>
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
            <Button asChild size="lg" className="shadow-lg">
              <Link to="/projects/new">
                <Plus className="mr-2 h-5 w-5" />
                Crear Proyecto
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
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
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold shadow-sm flex-shrink-0 ${
                      project.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                        : project.status === 'completed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}>
                      {project.status === 'active' ? '✅ Activo' : project.status === 'completed' ? '🎉 Completado' : '📅 Planeado'}
                    </span>
                  </div>
                  <CardDescription className="line-clamp-2 mt-3 text-base leading-relaxed">
                    {project.description || 'Sin descripción'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="text-lg">👥</span>
                      {project.memberIds.length} miembros
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      project.ownerId === user?.id 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {project.ownerId === user?.id ? '👑 Propietario' : '🤝 Miembro'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
