import { useEffect, useState } from 'react';
import { Task } from '@/types';
import { tasksService } from '@/services/firebase.service';

export function useTasksCache(projectId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    // Pequeño delay para evitar llamadas múltiples inmediatas
    const timeoutId = setTimeout(() => {
      if (!mounted) return;
      
      unsubscribe = tasksService.listen(projectId, (newTasks) => {
        if (mounted) {
          setTasks(newTasks);
          setLoading(false);
        }
      });
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [projectId]);

  return { tasks, loading };
}
