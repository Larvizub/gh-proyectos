import { useMemo, useState, useCallback } from 'react';
import { Task } from '@/types';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameDay, isWithinInterval, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
}

export default function CalendarView({ tasks, onTaskClick, onTaskDelete }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    const weeksArr: Date[][] = [];
    let cursor = start;
    while (cursor <= end) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(cursor);
        cursor = addDays(cursor, 1);
      }
      weeksArr.push(week);
    }
    return weeksArr;
  }, [currentMonth]);

  const startOfDay = useCallback((d: Date) => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const tasksForDay = useCallback((day: Date) => {
    return tasks.filter(t => {
      if (!t.startDate && !t.dueDate) return isSameDay(new Date(t.createdAt), day);
      const start = t.startDate ? new Date(t.startDate) : new Date(t.createdAt);
      const end = t.dueDate ? new Date(t.dueDate) : start;
      return isWithinInterval(day, { start: startOfDay(start), end: startOfDay(end) });
    });
  }, [tasks, startOfDay]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button className="p-2 rounded hover:bg-muted" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} title="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
          <div className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy', { locale: es })}</div>
          <button className="p-2 rounded hover:bg-muted" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} title="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 bg-background/60 border-b">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div className="p-3">
          <div className="space-y-3">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-2">
                {week.map((day) => {
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const dayTasks = tasksForDay(day);
                  return (
                    <div key={day.toISOString()} className={`p-2 min-h-[96px] border rounded-md ${isCurrentMonth ? '' : 'opacity-60'}`}>
                      <div className="flex items-start justify-between">
                        <div className="text-sm font-medium">{format(day, 'd')}</div>
                        <div className="text-xs text-muted-foreground">{format(day, 'MMM', { locale: es })}</div>
                      </div>

                      <div className="mt-2 space-y-1">
                        {dayTasks.slice(0, 3).map((task) => (
                          <div key={task.id} className="relative rounded-md px-2 py-1 text-sm text-white shadow-sm" style={{ background: 'linear-gradient(90deg, #124734, #273c2a)' }}>
                            <div className="truncate" onClick={() => onTaskClick && onTaskClick(task)}>{task.title}</div>
                            <button onClick={(e) => { e.stopPropagation(); onTaskDelete && onTaskDelete(task.id); }} className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded ml-2">
                              <Trash2 className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        ))}

                        {dayTasks.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{dayTasks.length - 3} más</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
