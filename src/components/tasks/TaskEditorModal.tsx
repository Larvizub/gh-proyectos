import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Task, TaskStatus, User, SubTask } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Calendar } from 'lucide-react';
import Select from '@/components/ui/select';
import { tasksService, usersService, projectsService } from '@/services/firebase.service';
import { toast } from 'sonner';
import DatePicker from '@/components/ui/DatePicker';
import { useAuth } from '@/contexts/AuthContext';
import { TaskComments } from './TaskComments';
import { SubTasks } from './SubTasks';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

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
  const [projectTags, setProjectTags] = useState<string[]>([]);
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [projectOwners, setProjectOwners] = useState<string[] | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [assigneeInput, setAssigneeInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const { user } = useAuth();
  
  // Estado inicial para detectar cambios
  const [initialState, setInitialState] = useState<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueInput: string;
    selectedAssignees: string[];
    selectedTags: string[];
    subTasks: SubTask[];
  } | null>(null);

  useEffect(() => {
    if (!task) return;
    const newTitle = task.title ?? '';
    const newDescription = task.description ?? '';
    const newStatus = task.status ?? 'todo';
    const newPriority = task.priority ?? 'medium';
    const newDueInput = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
    const newAssignees = task.assigneeIds || [];
    const newTags = task.tags || [];
    const newSubTasks = task.subTasks || [];
    
    setTitle(newTitle);
    setDescription(newDescription);
    setStatus(newStatus);
    setPriority(newPriority);
    setDueInput(newDueInput);
    setSelectedAssignees(newAssignees);
    setSelectedTags(newTags);
    setSubTasks(newSubTasks);
    
    // Guardar estado inicial
    setInitialState({
      title: newTitle,
      description: newDescription,
      status: newStatus,
      priority: newPriority,
      dueInput: newDueInput,
      selectedAssignees: newAssignees,
      selectedTags: newTags,
      subTasks: newSubTasks,
    });
  }, [task]);
  
  // Detectar si hay cambios
  const hasChanges = initialState ? (
    title !== initialState.title ||
    description !== initialState.description ||
    status !== initialState.status ||
    priority !== initialState.priority ||
    dueInput !== initialState.dueInput ||
    JSON.stringify(selectedAssignees.sort()) !== JSON.stringify(initialState.selectedAssignees.sort()) ||
    JSON.stringify(selectedTags.sort()) !== JSON.stringify(initialState.selectedTags.sort()) ||
    JSON.stringify(subTasks) !== JSON.stringify(initialState.subTasks)
  ) : false;

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

  useEffect(() => {
    if (!task) return;
    let mounted = true;
    (async () => {
      try {
        const p = await projectsService.get(task.projectId);
        if (mounted) {
          setProjectTags(p?.tags || []);
          setProjectOwnerId(p?.ownerId || null);
          setProjectOwners(p?.owners || null);
        }
      } catch (err) {
        console.warn('No se pudieron cargar tags del proyecto', err);
        if (mounted) setProjectTags([]);
      }
    })();
    return () => { mounted = false; };
  }, [task]);

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

    // include tags selected from project
    updates.tags = selectedTags || [];

    const dueTs = dateInputToTimestamp(dueInput);
    if (dueTs) updates.dueDate = dueTs;
    // Assignee handling: multiple assignees
    updates.assigneeIds = selectedAssignees || [];
    
    // Subtareas
    updates.subTasks = subTasks;

    await toast.promise(
      tasksService.update(task.id, updates),
      {
        loading: 'Guardando cambios...',
        success: 'Tarea actualizada (notificaciones automáticas)',
        error: 'Error al guardar',
      }
    );

    // Las notificaciones ahora se envían automáticamente mediante triggers de base de datos
    // No es necesario llamar a funciones manualmente

    if (onSaved) onSaved();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!task) return;
    // proteger si no tiene permisos
    if (!canEdit) { toast.error('No tienes permisos para adjuntar archivos a esta tarea'); return; }
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
    if (!canEdit) { toast.error('No tienes permisos para eliminar este adjunto'); return; }
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

  // determinar si el usuario puede editar: propietario del proyecto o asignado a la tarea
  const currentUserId = user?.id;
  const isAssigned = (() => {
    // Preferir assigneeIds (tipo canonical). También soportar formatos legacy en runtime.
    if (Array.isArray(task.assigneeIds) && currentUserId && task.assigneeIds.includes(currentUserId)) return true;
    const a = (task as any).assignedTo;
    if (!a) return false;
    if (typeof a === 'string') {
      return a === currentUserId || String(a).toLowerCase() === String(user?.email).toLowerCase();
    }
    if (typeof a === 'object') {
      return a.userId === currentUserId || String(a.email || '').toLowerCase() === String(user?.email).toLowerCase();
    }
    return false;
  })();

  const { hasModulePermission } = useAuth();
  const isProjectOwner = projectOwnerId === currentUserId || (projectOwners && projectOwners.includes(currentUserId || ''));
  const roleAllowsEdit = hasModulePermission ? hasModulePermission('tasks', 'interact') : true;
  const canEdit = Boolean(isProjectOwner || isAssigned) && roleAllowsEdit;

  // Calculate due date status
  const rawDue = task?.dueDate;
  const dueDateNum = rawDue == null ? NaN : Number(rawDue);
  const hasValidDueDate = !isNaN(dueDateNum) && dueDateNum > 0;
  const dueDateObj = hasValidDueDate ? new Date(dueDateNum) : null;
  const isOverdue = hasValidDueDate && dueDateNum < Date.now() && task?.status !== 'completed';
  let dueLabel: string | null = null;
  if (hasValidDueDate && dueDateObj) {
    try {
      dueLabel = formatDistanceToNow(dueDateObj, { addSuffix: true, locale: es });
    } catch (e) {
      dueLabel = null;
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <Card className="relative z-50 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between">
          <CardTitle>Detalle de tarea</CardTitle>
          {isOverdue && dueLabel && (
            <Badge variant="destructive" className="flex items-center gap-1.5 px-2 py-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Vencida {dueLabel}</span>
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="text-sm font-medium">Título</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border-2 border-border bg-input px-3 py-2" disabled={!canEdit} />
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <textarea value={description} onChange={e => setDescription((e.target as HTMLTextAreaElement).value)} className="w-full rounded-lg border-2 border-border bg-input px-3 py-2" rows={4} disabled={!canEdit} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Estado</label>
                <Select value={status} onChange={v => canEdit && setStatus(v as TaskStatus)}>
                  <option value="todo">Por hacer</option>
                  <option value="in-progress">En progreso</option>
                  <option value="review">En revisión</option>
                  <option value="completed">Completada</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={priority} onChange={v => canEdit && setPriority(v as any)}>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Fecha de vencimiento</label>
                <DatePicker value={dueInput} onChange={v => canEdit && setDueInput(v)} placeholder="dd/mm/aaaa" ariaLabel="Fecha de vencimiento" />
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

                  <div className="flex gap-2">
                    <input list="assignees-list" value={assigneeInput} onChange={e => setAssigneeInput(e.target.value)} placeholder={selectedAssignees.length === 0 ? 'Añadir asignado por nombre o email' : 'Añadir más...'} className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" />
                    <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground" onClick={() => {
                      if (!canEdit) return;
                      const val = (assigneeInput || '').trim();
                      if (!val) return;
                      const found = users.find(u => (u.email || '').toLowerCase() === val.toLowerCase() || (u.displayName || '').toLowerCase() === val.toLowerCase());
                      if (found) {
                        setSelectedAssignees(prev => prev.includes(found.id) ? prev : [...prev, found.id]);
                        setAssigneeInput('');
                      } else {
                        const partial = users.find(u => (u.displayName || '').toLowerCase().includes(val.toLowerCase()) || (u.email || '').toLowerCase().includes(val.toLowerCase()));
                        if (partial) {
                          setSelectedAssignees(prev => prev.includes(partial.id) ? prev : [...prev, partial.id]);
                          setAssigneeInput('');
                        }
                      }
                    }}>Añadir</button>
                  </div>
                  <datalist id="assignees-list">
                    {users.map(u => <option key={u.id} value={u.email || u.id}>{u.displayName || u.email}</option>)}
                  </datalist>
                </div>
              </div>

            <div>
              <label className="text-sm font-medium">Tags del proyecto</label>
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedTags.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Sin tags seleccionados</span>
                      ) : (
                        selectedTags.map(t => (
                          <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/70 text-sm">
                            <span className="truncate max-w-[14rem] font-medium">{t}</span>
                            <button type="button" title={`Remover ${t}`} className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/10 hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => setSelectedTags(prev => prev.filter(x => x !== t))}>×</button>
                          </span>
                        ))
                      )}
                    </div>

                    <div className="relative">
                      <div className="flex gap-2">
                        <input list="project-tags-list" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder={selectedTags.length === 0 ? 'Añadir tag del proyecto' : 'Añadir más tags...'} className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" />
                        <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground" onClick={() => {
                          if (!canEdit) return;
                          const raw = (tagInput || '').trim();
                          if (!raw) return;
                          // buscar coincidencia case-insensitive en projectTags
                          const match = projectTags.find(pt => pt.toLowerCase() === raw.toLowerCase());
                          if (!match) {
                            toast.error('Tag no válido. Selecciona uno de la lista del proyecto');
                            return;
                          }
                          if (!selectedTags.includes(match)) setSelectedTags(prev => [...prev, match]);
                          setTagInput('');
                        }}>Añadir</button>
                      </div>
                      <datalist id="project-tags-list">
                        {projectTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                      </datalist>
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
                        {canEdit && (
                          <button type="button" onClick={() => handleRemoveAttachment((att as any).id)} className="p-2 rounded hover:bg-destructive/10 text-destructive" title="Eliminar adjunto">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <input key={fileInputKey} type="file" onChange={handleFileChange} className="hidden" id="task-file-input" />
                    <label htmlFor="task-file-input" className={`inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''} ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12v9m0-9l3.5 3.5M12 12L8.5 15.5M16 5l-4-4-4 4"/></svg>
                      <span className="text-sm">Subir archivo</span>
                    </label>
                  </div>
                </div>

              {/* Subtareas */}
              <div className="mt-6">
                <SubTasks subTasks={subTasks} onChange={setSubTasks} />
              </div>

              <div className="mt-6">
                <TaskComments taskId={task.id} inputIdSuffix="inline" />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
              {canEdit ? (
                <Button type="submit" disabled={!hasChanges}>
                  {hasChanges ? 'Guardar cambios' : 'Sin cambios'}
                </Button>
              ) : (
                <div className="flex items-center text-sm text-muted-foreground">No puedes editar esta tarea</div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}
