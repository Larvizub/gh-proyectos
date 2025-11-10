import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { projectsService } from '@/services/firebase.service';
import { Project, Task } from '@/types';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [projectsData, tasksData] = await Promise.all([
          projectsService.getAll(),
          // Aquí deberías cargar solo las tareas del usuario actual
          Promise.resolve([]) as Promise<Task[]>,
        ]);
        
        setProjects(projectsData);
        setTasks(tasksData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const myProjects = projects.filter(
    p => p.ownerId === user?.id || p.memberIds.includes(user?.id || '')
  );

  const myTasks = tasks.filter(t => 
    t.assigneeIds.includes(user?.id || '')
  );

  const completedTasks = myTasks.filter(t => t.status === 'completed');
  const inProgressTasks = myTasks.filter(t => t.status === 'in-progress');
  const overdueTasks = myTasks.filter(t => 
    t.dueDate && t.dueDate < Date.now() && t.status !== 'completed'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Bienvenido, {user?.displayName}
        </h1>
        <p className="text-muted-foreground mt-2">
          Aquí está un resumen de tu actividad
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tareas Completadas
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks.length}</div>
            <p className="text-xs text-muted-foreground">
              de {myTasks.length} tareas totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              En Progreso
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks.length}</div>
            <p className="text-xs text-muted-foreground">
              tareas activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vencidas
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueTasks.length}</div>
            <p className="text-xs text-muted-foreground">
              requieren atención
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mis Proyectos</CardTitle>
            <CardDescription>
              {myProjects.length} proyectos activos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes proyectos asignados
              </p>
            ) : (
              <div className="space-y-2">
                {myProjects.slice(0, 5).map(project => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="text-sm font-medium">{project.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tareas Recientes</CardTitle>
            <CardDescription>
              Últimas tareas asignadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes tareas asignadas
              </p>
            ) : (
              <div className="space-y-2">
                {myTasks.slice(0, 5).map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-accent"
                  >
                    <span className="text-sm">{task.title}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      task.status === 'completed' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                        : task.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
