import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Role } from '@/services/firebase.service';

const MODULES: { key: string; label: string }[] = [
  { key: 'projects', label: 'Proyectos' },
  { key: 'tasks', label: 'Tareas' },
  { key: 'comments', label: 'Comentarios' },
  { key: 'users', label: 'Usuarios' },
  { key: 'settings', label: 'Configuración' },
  { key: 'admin', label: 'Administración' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (role: Omit<Role, 'createdAt' | 'updatedAt'>) => Promise<void> | void;
  initial?: Role | null;
};

export default function RoleModal({ open, onClose, onSave, initial }: Props) {
  const [name, setName] = useState('');
  const [modules, setModules] = useState<Record<string, { observe?: boolean; interact?: boolean }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setModules(initial.modules || {});
    } else {
      setName('');
      setModules({});
    }
  }, [initial, open]);

  function toggleModule(moduleKey: string, field: 'observe' | 'interact') {
    setModules((m) => ({
      ...m,
      [moduleKey]: { ...(m[moduleKey] || {}), [field]: !(m[moduleKey] && m[moduleKey][field]) }
    }));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: initial?.id || '', name: name.trim(), modules });
      onClose();
    } catch (err) {
      console.error('Failed saving role', err);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card rounded-md p-6 z-10 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Editar rol' : 'Crear rol'}</h2>
        <div className="mb-4">
          <Input value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Nombre del rol" />
        </div>
        <div className="space-y-3 mb-4 max-h-96 overflow-auto">
          {MODULES.map((m) => {
            const state = modules[m.key] || {};
            return (
              <div key={m.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded">
                <div className="font-medium text-sm sm:text-base">{m.label}</div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 whitespace-nowrap"><Checkbox checked={!!state.observe} onCheckedChange={() => toggleModule(m.key, 'observe')} /> <span className="text-sm">Ver</span></label>
                  <label className="flex items-center gap-2 whitespace-nowrap"><Checkbox checked={!!state.interact} onCheckedChange={() => toggleModule(m.key, 'interact')} /> <span className="text-sm">Editar</span></label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
