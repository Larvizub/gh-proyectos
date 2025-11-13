import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Project } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: Partial<Project> & { id: string }) => Promise<void> | void;
  initial?: Project | null;
};

export default function ProjectModal({ open, onClose, onSave, initial }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#000000');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
      setColor(initial.color || '#000000');
    } else {
      setName('');
      setDescription('');
      setColor('#000000');
    }
  }, [initial, open]);

  async function handleSave() {
    if (!initial) return;
    setSaving(true);
    try {
      await onSave({ id: initial.id!, name: name.trim(), description: description.trim(), color });
      onClose();
    } catch (err) {
      console.error('Failed to save project', err);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card rounded-md p-6 z-10 shadow-lg">
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
          <div>
            <label className="text-sm font-medium">Color</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-12 p-0 border-0 bg-transparent" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </CardContent>
      </div>
    </div>
  );
}
