import { useMemo, useEffect, useState, useRef } from 'react';
import { Task } from '@/types';
import { format, differenceInCalendarDays, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
}

// Responsive Gantt that buckets timeline into days/weeks/months/quarters
export default function GanttChart({ tasks, onTaskClick, onTaskDelete }: GanttChartProps) {
  const [isCompact, setIsCompact] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

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

  // Ordenar tareas por fecha de vencimiento ascendente (las sin dueDate van al final).
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aDue = a.dueDate ?? Infinity;
      const bDue = b.dueDate ?? Infinity;
      if (aDue !== bDue) return aDue - bDue;
      const aStart = a.startDate ?? Infinity;
      const bStart = b.startDate ?? Infinity;
      if (aStart !== bStart) return aStart - bStart;
      return a.createdAt - b.createdAt;
    });
  }, [tasks]);

  const bucketOptions = [1, 7, 30, 90];
  const [bucketDays, setBucketDays] = useState<number>(1);

  const computeUnits = (bDays: number) => {
    if (bDays === 1) return days;
    const count = Math.ceil(totalDays / bDays);
    const units: Date[] = [];
    for (let i = 0; i < count; i++) units.push(addDays(startDate, i * bDays));
    return units;
  };

  const units = useMemo(() => computeUnits(bucketDays), [bucketDays, days, totalDays, startDate]);
  const unitCount = Math.max(1, units.length);

  useEffect(() => {
    function updateCompact() {
      setIsCompact(window.innerWidth < 768);
    }
    updateCompact();
    window.addEventListener('resize', updateCompact);
    return () => window.removeEventListener('resize', updateCompact);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(Math.max(0, entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!containerWidth) return;
    const minColPx = isCompact ? 48 : 64;
    const maxCols = Math.max(3, Math.floor(containerWidth / minColPx));

    let chosen = bucketOptions[bucketOptions.length - 1];
    for (const b of bucketOptions) {
      const cols = Math.ceil(Math.max(1, totalDays) / b);
      if (cols <= maxCols) {
        chosen = b;
        break;
      }
    }
    setBucketDays(chosen);
  }, [containerWidth, totalDays, isCompact]);

  return (
    <div className="w-full overflow-auto border rounded-lg" ref={containerRef}>
      <div className="min-w-0">
        {/* Header */}
        {!isCompact && (
          <div className="flex items-center bg-background border-b sticky top-0 z-10">
            <div className="w-64 p-3 font-semibold">Tarea</div>
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${unitCount}, minmax(0,1fr))` }}>
              {units.map((u, idx) => (
                <div key={u.toISOString()} className="text-xs text-muted-foreground p-2 border-l last:border-r">
                  {bucketDays >= 30 ? (
                    <>
                      <div className="whitespace-nowrap font-medium">{format(u, 'MMM yyyy', { locale: es })}</div>
                      <div className="text-[10px] text-muted-foreground/60">{idx + 1}</div>
                    </>
                  ) : bucketDays > 1 ? (
                    <>
                      <div className="whitespace-nowrap">{format(u, 'dd MMM', { locale: es })} - {format(addDays(u, bucketDays - 1), 'dd MMM', { locale: es })}</div>
                      <div className="text-[10px] text-muted-foreground/60">{bucketDays === 7 ? `Semana ${idx + 1}` : `Período ${idx + 1}`}</div>
                    </>
                  ) : (
                    <>
                      <div className="whitespace-nowrap">{format(u, 'dd MMM', { locale: es })}</div>
                      <div className="text-[10px] text-muted-foreground/60">{format(u, 'EEE', { locale: es })}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rows */}
        <div className="divide-y">
          {sortedTasks.map((task) => {
            const taskStart = startOfDay(new Date(task.startDate ?? task.createdAt ?? Date.now()));
            const taskEnd = startOfDay(new Date(task.dueDate ?? task.completedAt ?? (task.startDate ?? task.createdAt) + 24 * 60 * 60 * 1000));

            const offset = differenceInCalendarDays(taskStart, startDate);
            const span = Math.max(1, differenceInCalendarDays(taskEnd, taskStart) + 1);

            const left = Math.max(0, offset);
            const width = Math.min(totalDays - left, span);

            const leftUnits = Math.floor(left / bucketDays);
            const widthUnits = Math.max(1, Math.ceil(width / bucketDays));

            const leftPct = (leftUnits / unitCount) * 100;
            const widthPct = (widthUnits / unitCount) * 100;

            return isCompact ? (
              <div key={task.id} className="p-3 border-b bg-background/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground">{format(taskStart, 'dd/MM')} → {format(taskEnd, 'dd/MM')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onTaskDelete && onTaskDelete(task.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="w-full h-4 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.max(widthPct, 6)}%`,
                      marginLeft: `${Math.max(leftPct, 0)}%`,
                      background: 'linear-gradient(90deg, #124734, #273c2a)',
                      minWidth: '36px'
                    }}
                    title={`${task.title} — ${format(taskStart, 'dd/MM')} → ${format(taskEnd, 'dd/MM')}`}
                  />
                </div>
              </div>
            ) : (
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
                    <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${unitCount}, minmax(0,1fr))` }}>
                      {units.map((_, idx) => (
                        <div key={idx} className={`border-l ${idx === unitCount - 1 ? 'last:border-r' : ''}`} />
                      ))}
                    </div>
                  </div>

                  <div
                    onClick={() => onTaskClick && onTaskClick(task)}
                    className="absolute top-3 left-0 h-8 rounded-md shadow-md cursor-pointer"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: 'linear-gradient(90deg, #124734, #273c2a)',
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
