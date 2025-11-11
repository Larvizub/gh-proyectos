import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { projectsService, tasksService } from '@/services/firebase.service';
import { Task, Project } from '@/types';
import PageLoader from '@/components/PageLoader';

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);

  // Task form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

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

    if (!project) return;

    const payload = {
      title,
      description: desc,
      projectId: project.id,
      status: 'open',
      assigneeId: project.ownerId,
      createdAt: Date.now(),
    } as any;

    await toast.promise(
      tasksService.create(payload),
      {
        loading: 'Creando tarea...',
        success: 'Tarea creada',
        error: (err) => `Error: ${err?.message || 'No se pudo crear la tarea'}`,
      }
    );

    setTitle('');
    setDesc('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.description}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-2">Tareas</h2>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground">Aún no hay tareas</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map(t => (
                <li key={t.id} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <strong>{t.title}</strong>
                    <span className="text-sm text-muted-foreground">{t.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Crear tarea</h2>
          <form onSubmit={handleCreateTask} className="space-y-3">
            <div>
              <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-md border px-3 py-2" placeholder="Título" />
            </div>
            <div>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full rounded-md border px-3 py-2" rows={4} placeholder="Descripción" />
            </div>
            <div>
              <button type="submit" className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-white">Crear tarea</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
