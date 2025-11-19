import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from '@/components/ui/select';
import ColorPickerButton from '@/components/ui/ColorPickerButton';
import { CheckCircle, Calendar, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usersService } from '@/services/firebase.service';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
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
                  <button type="button" className="w-full rounded-md border border-input bg-input px-3 py-2 text-left text-sm text-foreground shadow-sm flex items-center justify-between" onClick={() => {
                    // toggle simple owner picker (show a browser prompt for quick add by email or id)
                    const emailOrId = prompt('Añadir propietario por correo o id de usuario');
                    if (!emailOrId) return;
                    // try to resolve by email
                    const found = users.find(u => u.email.toLowerCase() === emailOrId.toLowerCase());
                    if (found) {
                      setOwnerIds(prev => prev.includes(found.id) ? prev : [...prev, found.id]);
                    } else {
                      // fallback to adding raw value (expecting id)
                      setOwnerIds(prev => prev.includes(emailOrId) ? prev : [...prev, emailOrId]);
                    }
                  }}>
                    <span className="truncate">Añadir propietario…</span>
                    <svg className="h-4 w-4 text-muted-foreground ml-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                    </svg>
                  </button>
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
