import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from '@/components/ui/select';
import ColorPickerButton from '@/components/ui/ColorPickerButton';
import { CheckCircle, Calendar, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
      setColor(initial.color || '#000000');
      setStatus((initial.status as any) || 'active');
      setTags(initial.tags || []);
    } else {
      setName('');
      setDescription('');
      setColor('#000000');
      setStatus('active');
      setTags([]);
    }
  }, [initial, open]);

  

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

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button onClick={async () => {
                // include status and tags in payload when saving
                setSaving(true);
                try {
                  if (initial && initial.id) {
                    await onSave({ id: initial.id, name: name.trim(), description: description.trim(), color, status, tags });
                  } else {
                    await onSave({ name: name.trim(), description: description.trim(), color, status, tags });
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
