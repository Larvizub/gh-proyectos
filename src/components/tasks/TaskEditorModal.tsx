import React, { useEffect, useState } from 'react';
import { Task, TaskStatus, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import Select from '@/components/ui/select';
import { tasksService, usersService } from '@/services/firebase.service';
import { toast } from 'sonner';
import DatePicker from '@/components/ui/DatePicker';
import { useAuth } from '@/contexts/AuthContext';
import { TaskComments } from './TaskComments';

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
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const { user } = useAuth();
  const [openAssignees, setOpenAssignees] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? '');
    setDescription(task.description ?? '');
    setStatus(task.status ?? 'todo');
    setPriority(task.priority ?? 'medium');
    setDueInput(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
    setSelectedAssignees(task.assigneeIds || []);
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
    // Assignee handling: multiple assignees
    updates.assigneeIds = selectedAssignees || [];

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!task) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await tasksService.uploadAttachment(task.id, file, user?.id);
      toast.success('Archivo subido');
      // refresh: parent listener will update the task list; we still reset the file input
      setFileInputKey(Date.now());
    } catch (err: any) {
      console.error(err);
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveAttachment(attId: string) {
    if (!task) return;
    if (!confirm('¿Eliminar este archivo de la tarea? (no borra el archivo en Storage)')) return;
    try {
      await tasksService.removeAttachment(task.id, attId);
      toast.success('Adjunto eliminado');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar el adjunto');
    }
  }

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <Card className="relative z-50 w-full max-w-[96vw] md:max-w-3xl mx-4 max-h-[90vh] overflow-hidden">
        <CardHeader>
          <CardTitle>Detalle de tarea</CardTitle>
        </CardHeader>
        <CardContent className="p-4 overflow-auto max-h-[75vh]">
          <div className="grid grid-cols-1 gap-6">
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
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedAssignees.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Sin asignar</span>
                    ) : (
                      users.filter(u => selectedAssignees.includes(u.id)).map(u => (
                        <span key={u.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/70 text-sm text-foreground border border-muted shadow-sm">
                          <span className="truncate max-w-[14rem] font-medium">{u.displayName || u.email}</span>
                          <button
                            type="button"
                            title={`Desasignar ${u.displayName || u.email}`}
                            className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/10 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            onClick={() => setSelectedAssignees(prev => prev.filter(id => id !== u.id))}
                            aria-label={`Desasignar ${u.displayName || u.email}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="relative">
                    <button type="button" className="w-full rounded-md border border-input bg-input px-3 py-2 text-left text-sm text-foreground shadow-sm flex items-center justify-between" onClick={() => setOpenAssignees(prev => !prev)}>
                      <span className="truncate">{selectedAssignees.length === 0 ? 'Añadir asignados…' : 'Añadir más'}</span>
                      <svg className="h-4 w-4 text-muted-foreground ml-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                      </svg>
                    </button>
                    {openAssignees && (
                      <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md bg-popover shadow-lg ring-1 ring-black/10 p-2">
                        <div className="flex flex-col gap-1">
                          {users.map(u => (
                            <label key={u.id} className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-muted text-sm">
                              <input type="checkbox" checked={selectedAssignees.includes(u.id)} onChange={(e) => {
                                setSelectedAssignees(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id));
                              }} />
                              <span>{u.displayName || u.email}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* File attachments */}
              <div>
                <label className="text-sm font-medium">Documentos de referencia / Adjuntos</label>
                <div className="mt-2 space-y-2">
                  {(task.attachments || []).map((att) => (
                    <div key={(att as any).id} className="flex items-center justify-between bg-muted/5 rounded px-3 py-2">
                      <a href={(att as any).url} target="_blank" rel="noreferrer" className="truncate mr-3">{(att as any).name}</a>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date((att as any).createdAt).toLocaleDateString()}</span>
                        <button type="button" onClick={() => handleRemoveAttachment((att as any).id)} className="p-2 rounded hover:bg-destructive/10 text-destructive" title="Eliminar adjunto">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <input key={fileInputKey} type="file" onChange={handleFileChange} className="hidden" id="task-file-input" />
                    <label htmlFor="task-file-input" className={`inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12v9m0-9l3.5 3.5M12 12L8.5 15.5M16 5l-4-4-4 4"/></svg>
                      <span className="text-sm">Subir archivo</span>
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  {/* Comentarios: siempre debajo del botón de subir archivo */}
                  <TaskComments taskId={task.id} inputIdSuffix="inline" />
                </div>
                
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
