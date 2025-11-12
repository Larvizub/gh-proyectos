import React, { useEffect, useState } from 'react';
import { Task, TaskStatus, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { tasksService, usersService } from '@/services/firebase.service';
import { toast } from 'sonner';
import DatePicker from '@/components/ui/DatePicker';

interface Props {
  task: Task | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function TaskEditorModal({ task, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueInput, setDueInput] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? '');
    setDescription(task.description ?? '');
    setStatus(task.status ?? 'todo');
    setPriority(task.priority ?? 'medium');
    setDueInput(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
    setSelectedAssignee((task.assigneeIds && task.assigneeIds[0]) || '');
  }, [task]);

  useEffect(() => {
    // load users to allow assigning
    let mounted = true;
    (async () => {
      try {
        const all = await usersService.getAll();
        if (mounted) setUsers(all || []);
      } catch (e) {
        console.warn('No se pudieron cargar usuarios', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function dateInputToTimestamp(value: string) {
    if (!value) return undefined;
    const parts = value.split('-');
    if (parts.length !== 3) return undefined;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    return new Date(y, m, d).getTime();
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!task) return;

    const updates: Partial<Task> = {
      title,
      description,
      status,
      priority,
      updatedAt: Date.now(),
    };

    const dueTs = dateInputToTimestamp(dueInput);
    if (dueTs) updates.dueDate = dueTs;
    // Assignee handling: single-assignee for now
    if (selectedAssignee) {
      updates.assigneeIds = [selectedAssignee];
    } else {
      updates.assigneeIds = [];
    }

    await toast.promise(
      tasksService.update(task.id, updates),
      {
        loading: 'Guardando cambios...',
        success: 'Tarea actualizada',
        error: 'Error al guardar',
      }
    );

    if (onSaved) onSaved();
    onClose();
  }

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-2xl mx-4">
        <CardHeader>
          <CardTitle>Detalle de tarea</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border-2 border-border bg-input px-3 py-2" />
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-lg border-2 border-border bg-input px-3 py-2" rows={4} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Estado</label>
                <Select value={status} onChange={v => setStatus(v as TaskStatus)}>
                  <option value="todo">Por hacer</option>
                  <option value="in-progress">En progreso</option>
                  <option value="review">En revisión</option>
                  <option value="completed">Completada</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={priority} onChange={v => setPriority(v as any)}>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Fecha de vencimiento</label>
                <DatePicker value={dueInput} onChange={v => setDueInput(v)} placeholder="dd/mm/aaaa" ariaLabel="Fecha de vencimiento" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Asignar a</label>
              <Select value={selectedAssignee} onChange={v => setSelectedAssignee(v as string)}>
                <option value="">Sin asignar</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                ))}
              </Select>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
