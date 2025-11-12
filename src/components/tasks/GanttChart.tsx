import { useMemo } from 'react';
import { Task } from '@/types';
import { format, differenceInCalendarDays, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
// Card component not required here; keep layout simple
import { Trash2 } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
}

// small helpers

export default function GanttChart({ tasks, onTaskClick, onTaskDelete }: GanttChartProps) {
  const { days, startDate } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const today = startOfDay(new Date());
      return { startDate: today, endDate: addDays(today, 14), days: Array.from({ length: 15 }).map((_, i) => addDays(today, i)) };
    }

    const starts = tasks.map(t => t.startDate ?? t.createdAt ?? Date.now());
    const ends = tasks.map(t => t.dueDate ?? t.completedAt ?? (t.startDate ?? t.createdAt) + 24 * 60 * 60 * 1000);

    const min = startOfDay(new Date(Math.min(...starts)));
    const max = startOfDay(new Date(Math.max(...ends)));

  const totalDays = differenceInCalendarDays(max, min) + 1;
  const daysArr = Array.from({ length: totalDays }).map((_, i) => addDays(min, i));

    return { startDate: min, endDate: max, days: daysArr };
  }, [tasks]);

  const totalDays = days.length;

  return (
    <div className="w-full overflow-auto border rounded-lg">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="flex items-center bg-background border-b sticky top-0 z-10">
          <div className="w-64 p-3 font-semibold">Tarea</div>
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}>
            {days.map((d) => (
              <div key={d.toISOString()} className="text-xs text-muted-foreground p-2 border-l last:border-r">
                <div className="whitespace-nowrap">{format(d, 'dd MMM', { locale: es })}</div>
                <div className="text-[10px] text-muted-foreground/60">{format(d, 'EEE', { locale: es })}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y">
          {tasks.map((task) => {
            const taskStart = startOfDay(new Date(task.startDate ?? task.createdAt ?? Date.now()));
            const taskEnd = startOfDay(new Date(task.dueDate ?? task.completedAt ?? (task.startDate ?? task.createdAt) + 24 * 60 * 60 * 1000));

            const offset = differenceInCalendarDays(taskStart, startDate);
            const span = Math.max(1, differenceInCalendarDays(taskEnd, taskStart) + 1);

            const left = Math.max(0, offset);
            const width = Math.min(totalDays - left, span);

            const leftPct = (left / totalDays) * 100;
            const widthPct = (width / totalDays) * 100;

            return (
              <div key={task.id} className="flex items-center group hover:bg-muted/5 p-2">
                <div className="w-64 pr-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{task.title}</div>
                      <div className="text-xs text-muted-foreground">{(task.assigneeIds || []).length} asignado(s) • {task.tags?.slice(0,3).join(', ') || 'sin tags'}</div>
                    </div>
                    <div className="ml-2 hidden group-hover:flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onTaskDelete && onTaskDelete(task.id); }}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        title="Eliminar tarea"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 relative h-14">
                  <div className="absolute inset-0 flex">
                    <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}>
                      {days.map((_, idx) => (
                        <div key={idx} className={`border-l ${idx === totalDays - 1 ? 'last:border-r' : ''}`} />
                      ))}
                    </div>
                  </div>

                  {/* Task bar */}
                  <div
                    onClick={() => onTaskClick && onTaskClick(task)}
                    className="absolute top-3 left-0 h-8 rounded-md shadow-md cursor-pointer"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: 'linear-gradient(90deg, rgba(99,102,241,0.95), rgba(79,70,229,0.9))',
                    }}
                    title={`${task.title} — ${taskStart.toLocaleDateString()} → ${taskEnd.toLocaleDateString()}`}
                  >
                    <div className="h-full flex items-center justify-between px-3 text-sm text-white">
                      <div className="truncate font-medium">{task.title}</div>
                      <div className="text-xs opacity-90">{format(taskStart, 'dd/MM', { locale: es })} → {format(taskEnd, 'dd/MM', { locale: es })}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
