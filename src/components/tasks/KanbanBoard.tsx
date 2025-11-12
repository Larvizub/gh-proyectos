import React, { useState } from 'react';
import { Task, TaskStatus } from '@/types';
import { TaskCard } from './TaskCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Clipboard, Zap, Eye, CheckCircle2 } from 'lucide-react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

const COLUMNS: { id: TaskStatus; label: string; color: string; bgColor: string; icon: React.ReactNode }[] = [
  // Make dark-mode column backgrounds very subtle: low-opacity dark tints so they don't look like bright pastel panels
  { id: 'todo', label: 'Por hacer', color: 'text-gray-700 dark:text-gray-300', bgColor: 'bg-gray-50 dark:bg-gray-900/6', icon: <Clipboard className="h-5 w-5" /> },
  { id: 'in-progress', label: 'En progreso', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-50 dark:bg-blue-900/6', icon: <Zap className="h-5 w-5" /> },
  { id: 'review', label: 'En revisión', color: 'text-yellow-700 dark:text-yellow-300', bgColor: 'bg-yellow-50 dark:bg-yellow-900/6', icon: <Eye className="h-5 w-5" /> },
  { id: 'completed', label: 'Completadas', color: 'text-green-700 dark:text-green-300', bgColor: 'bg-green-50 dark:bg-green-900/6', icon: <CheckCircle2 className="h-5 w-5" /> },
];

interface SortableTaskCardProps {
  task: Task;
  onTaskClick: (task: Task) => void;
}

function SortableTaskCard({ task, onTaskClick }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onClick={() => onTaskClick(task)} />
    </div>
  );
}

export function KanbanBoard({ tasks, onTaskClick, onTaskStatusChange }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveTask(null);
      return;
    }

    const taskId = active.id as string;

    // Determine newStatus in a robust way:
    // - If over.id is one of the known column ids (TaskStatus), use it.
    // - If over.id is another task id (dropped onto a card), use that task's status.
    // - Otherwise ignore the drop.
    const possibleStatuses: TaskStatus[] = ['todo', 'in-progress', 'review', 'completed'];
    let newStatus: TaskStatus | undefined;

    if (possibleStatuses.includes(over.id as TaskStatus)) {
      newStatus = over.id as TaskStatus;
    } else {
      // maybe over.id is a task id
      const targetTask = tasks.find(t => t.id === (over.id as string));
      if (targetTask) {
        newStatus = targetTask.status;
      }
    }

    if (!newStatus) {
      // couldn't resolve a valid column status — don't update
      setActiveTask(null);
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
      onTaskStatusChange(taskId, newStatus);
    }

    setActiveTask(null);
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
        {COLUMNS.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          
          return (
            <div
              key={column.id}
              className="flex flex-col h-full min-h-[600px]"
            >
              <Card className={`flex-1 flex flex-col ${column.bgColor} border-2 shadow-sm transition-shadow hover:shadow-md`}>
                <CardHeader className="pb-3 border-b-2 border-border/50">
                  <CardTitle className={`text-base font-bold flex items-center justify-between ${column.color}`}>
                    <span className="flex items-center gap-2">
                      <span className="text-xl text-current">{column.icon}</span>
                      {column.label}
                    </span>
                    <span className="text-sm bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 font-semibold shadow-sm">
                      {columnTasks.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                
                <SortableContext
                  id={column.id}
                  items={columnTasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {columnTasks.map((task) => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        onTaskClick={onTaskClick}
                      />
                    ))}
                    
                    {columnTasks.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-12 px-4">
                        <div className="mb-2 opacity-30">
                          {/* ícono grande */}
                          {React.cloneElement(column.icon as any, { className: 'h-12 w-12 mx-auto' })}
                        </div>
                        <p className="font-medium">No hay tareas</p>
                        <p className="text-xs mt-1">Arrastra tareas aquí</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </Card>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 scale-105 opacity-90">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
