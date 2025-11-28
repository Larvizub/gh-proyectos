import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from '@/components/ui/select';
import ColorPickerButton from '@/components/ui/ColorPickerButton';
import { CheckCircle, Calendar, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usersService, notificationsService } from '@/services/firebase.service';
import { toast } from 'sonner';
import { functions as cloudFunctions, DATABASE_URLS } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Project } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: Partial<Project> & { id?: string }) => Promise<void> | void;
  initial?: Project | null;
};

export default function ProjectModal({ open, onClose, onSave, initial }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#000000');
  const [status, setStatus] = useState<'active' | 'archived' | 'completed'>('active');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [userPickerValue, setUserPickerValue] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
      setColor(initial.color || '#000000');
      setStatus((initial.status as any) || 'active');
      setTags(initial.tags || []);
      setOwnerIds(initial.owners || (initial.ownerId ? [initial.ownerId] : []));
    } else {
      setName('');
      setDescription('');
      setColor('#000000');
      setStatus('active');
      setTags([]);
      setOwnerIds([]);
    }
  }, [initial, open]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await usersService.getAll();
        if (mounted) setUsers(all || []);
      } catch (err) {
        console.warn('No se pudieron cargar usuarios para seleccionar propietarios', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl z-10">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{initial ? 'Editar proyecto' : 'Nuevo proyecto'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <input value={name} onChange={e => setName((e.target as HTMLInputElement).value)} className="w-full rounded-lg border-2 border-border bg-input px-3 py-2" />
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <textarea value={description} onChange={e => setDescription((e.target as HTMLTextAreaElement).value)} className="w-full rounded-lg border-2 border-border bg-input px-3 py-2" rows={4} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Color</label>
                <ColorPickerButton color={color} onChange={setColor} presetColors={[
                  '#111827','#374151','#64748b','#0f172a','#0ea5e9','#06b6d4','#06b6d4','#38bdf8','#6366f1','#7c3aed','#8b5cf6','#a78bfa','#ef4444','#f97316','#f59e0b','#10b981','#34d399','#ec4899'
                ]} />
              </div>

              <div>
                <label className="text-sm font-medium">Estado</label>
                <Select value={status} onChange={(v) => setStatus(v as any)} className="w-full">
                  <option value="active">
                    <CheckCircle className="h-4 w-4 inline-block mr-2" /> Activo
                  </option>
                  <option value="archived">
                    <Calendar className="h-4 w-4 inline-block mr-2" /> Archivado
                  </option>
                  <option value="completed">
                    <Trophy className="h-4 w-4 inline-block mr-2" /> Completado
                  </option>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Tags del proyecto (opcional)</label>
              <div className="flex gap-2 items-center mt-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Añadir tag" className="rounded-lg border-2 border-border bg-input px-3 py-2 w-full" />
                <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground" onClick={() => {
                  const t = tagInput.trim();
                  if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
                  setTagInput('');
                }}>+</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/70 text-sm">
                    <span className="truncate max-w-[12rem]">{t}</span>
                    <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="h-5 w-5 rounded-full inline-flex items-center justify-center text-sm">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Propietarios (compartir acceso)</label>
              <div className="mt-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {ownerIds.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Sin propietarios compartidos (será visible solo para el propietario)</span>
                  ) : (
                    ownerIds.map(id => {
                      const u = users.find(x => x.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/70 text-sm">
                          <span className="truncate max-w-[12rem]">{u ? (u.displayName || u.email) : id}</span>
                          <button type="button" onClick={() => setOwnerIds(prev => prev.filter(x => x !== id))} className="h-5 w-5 rounded-full inline-flex items-center justify-center text-sm">×</button>
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="relative">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input list="users-list" value={userPickerValue} onChange={(e) => setUserPickerValue(e.target.value)} placeholder="Buscar usuario por nombre o email" className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" />
                      <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground" onClick={() => {
                        if (!userPickerValue) return;
                        const found = users.find(u => (u.email || '').toLowerCase() === userPickerValue.toLowerCase() || (u.displayName || '').toLowerCase().includes(userPickerValue.toLowerCase()));
                        if (found) {
                          setOwnerIds(prev => prev.includes(found.id) ? prev : [...prev, found.id]);
                          setUserPickerValue('');
                        } else {
                          toast.error('Usuario no encontrado. Usa el campo de invitación si quieres invitar por email.');
                        }
                      }}>Añadir</button>
                    </div>
                    <datalist id="users-list">
                      {users.map(u => <option key={u.id} value={u.email || u.id}>{u.displayName || u.email}</option>)}
                    </datalist>

                    <div className="flex gap-2">
                      <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Invitar por email (usuario no registrado)" className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" />
                      <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white" onClick={async () => {
                        const email = String(inviteEmail || '').trim();
                        if (!email) return toast.error('Introduce un email válido');
                        try {
                          // Call backend callable to create invitation and send email
                          const rawKey = (typeof window !== 'undefined' ? localStorage.getItem('selectedSite') : null);
                          let siteDbUrl: string | undefined;
                          if (rawKey && (rawKey in DATABASE_URLS)) {
                            siteDbUrl = DATABASE_URLS[rawKey as keyof typeof DATABASE_URLS as any as import('@/config/firebase').SiteKey];
                          } else {
                            siteDbUrl = undefined;
                          }
                          const fn = httpsCallable(cloudFunctions as any, 'inviteOrNotifyOwners');
                          await fn({ dbUrl: siteDbUrl, inviteEmails: [email], projectId: initial?.id || null, projectName: name.trim(), inviterId: user?.id || null });
                          toast.success('Invitación creada y (si está configurado) enviada por correo');
                          setInviteEmail('');
                        } catch (err) {
                          console.error('Invite failed', err);
                          // fallback: create invite record locally
                          try { await usersService.invite(email); toast.success('Invitación creada (fallback)'); setInviteEmail(''); } catch (e) { toast.error('No se pudo crear la invitación'); }
                        }
                      }}>Invitar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button onClick={async () => {
                // include status, tags and owners in payload when saving
                setSaving(true);
                try {
                  const payload: any = { name: name.trim(), description: description.trim(), color, status, tags, owners: ownerIds };
                  
                  // Calculate diffs for notifications
                  const initialTags = initial?.tags || [];
                  const initialOwners = initial?.owners || (initial?.ownerId ? [initial.ownerId] : []);
                  
                  const addedTags = tags.filter(t => !initialTags.includes(t));
                  const removedTags = initialTags.filter(t => !tags.includes(t));
                  const addedOwners = ownerIds.filter(o => !initialOwners.includes(o));
                  // const removedOwners = initialOwners.filter(o => !ownerIds.includes(o));

                  if (initial && initial.id) {
                    payload.id = initial.id;
                    // preserve legacy ownerId if present, otherwise set from owners
                    if (initial.ownerId) payload.ownerId = initial.ownerId;
                    else if (ownerIds.length > 0) payload.ownerId = ownerIds[0];
                    await onSave(payload);
                  } else {
                    if (ownerIds.length > 0) payload.ownerId = ownerIds[0];
                    await onSave(payload);
                  }
                  
                  // Notify owners via notificationsService and try sending email via Graph when possible
                  try {
                    const rawDbKey = (typeof window !== 'undefined') ? localStorage.getItem('selectedSite') : null;
                    let dbUrl: string | undefined;
                    if (rawDbKey && (rawDbKey in DATABASE_URLS)) {
                      dbUrl = DATABASE_URLS[rawDbKey as keyof typeof DATABASE_URLS as any as import('@/config/firebase').SiteKey];
                    } else {
                      dbUrl = undefined;
                    }
                    const fn = httpsCallable(cloudFunctions as any, 'inviteOrNotifyOwners');

                    // 1. Notify NEW owners (Assignment)
                    if (addedOwners.length > 0) {
                      // Create DB notifications for new owners
                      await notificationsService.createForUsers(addedOwners, { type: 'project-owner-assigned', title: `Has sido asignado como propietario del proyecto ${name.trim()}`, message: `Has sido agregado como propietario del proyecto '${name.trim()}'`, relatedId: payload.id || null });

                      // Email new owners
                      try {
                        await fn({ 
                          dbUrl, 
                          ownerIds: addedOwners, 
                          projectId: payload.id || initial?.id || null, 
                          projectName: name.trim(), 
                          inviterId: user?.id || null,
                          notificationType: 'owner-assignment'
                        });
                      } catch (err) {
                        console.warn('Backend callable inviteOrNotifyOwners (assignment) failed', err);
                      }
                    }

                    // 2. Notify ALL owners about TAG changes
                    if ((addedTags.length > 0 || removedTags.length > 0) && ownerIds.length > 0) {
                       try {
                        await fn({ 
                          dbUrl, 
                          ownerIds: ownerIds, // Notify all current owners
                          projectId: payload.id || initial?.id || null, 
                          projectName: name.trim(), 
                          inviterId: user?.id || null,
                          notificationType: 'tags-update',
                          changes: { addedTags, removedTags }
                        });
                      } catch (err) {
                        console.warn('Backend callable inviteOrNotifyOwners (tags) failed', err);
                      }
                    }

                  } catch (err) {
                    console.warn('Failed to notify owners', err);
                  }

                  onClose();
                } catch (err) {
                  console.error('Failed to save project', err);
                  throw err;
                } finally {
                  setSaving(false);
                }
              }} disabled={saving || !name.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
