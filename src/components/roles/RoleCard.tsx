import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { rolesService, Role } from '@/services/firebase.service';

type Props = {
  role: Role;
  onSaved?: (r: Role) => void;
  onDeleted?: (id: string) => void;
};

const MODULES: { key: string; label: string }[] = [
  { key: 'projects', label: 'Proyectos' },
  { key: 'tasks', label: 'Tareas' },
  { key: 'comments', label: 'Comentarios' },
  { key: 'users', label: 'Usuarios' },
  { key: 'settings', label: 'Configuración' },
  { key: 'admin', label: 'Administración' },
];

export default function RoleCard({ role, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(role.name || '');
  const [modules, setModules] = useState<Record<string, { observe?: boolean; interact?: boolean }>>(role.modules || {});
  const [loading, setLoading] = useState(false);

  function toggleModule(moduleKey: string, field: 'observe' | 'interact') {
    setModules((m) => ({
      ...m,
      [moduleKey]: {
        ...(m[moduleKey] || {}),
        [field]: !(m[moduleKey] && m[moduleKey][field])
      }
    }));
  }

  async function save() {
    setLoading(true);
    try {
      await rolesService.update(role.id, { name, modules });
      const updated = await rolesService.get(role.id);
      if (updated && onSaved) onSaved(updated);
    } catch (err) {
      console.error('Failed to save role', err);
      // TODO: show notification
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!confirm(`Eliminar rol "${name}"?`)) return;
    setLoading(true);
    try {
      await rolesService.delete(role.id);
      if (onDeleted) onDeleted(role.id);
    } catch (err) {
      console.error('Failed to delete role', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-md p-4 bg-card">
      <div className="flex items-center gap-3 mb-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del rol" />
        <Button onClick={save} disabled={loading} className="whitespace-nowrap">Guardar</Button>
        <Button variant="outline" onClick={remove} disabled={loading}>Eliminar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MODULES.map((m) => {
          const state = modules[m.key] || {};
          return (
            <div key={m.key} className="flex items-center justify-between gap-4 p-2 border rounded">
              <div className="font-medium">{m.label}</div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2"><Checkbox checked={!!state.observe} onCheckedChange={() => toggleModule(m.key, 'observe')} /> <span className="text-sm">Ver</span></label>
                <label className="flex items-center gap-2"><Checkbox checked={!!state.interact} onCheckedChange={() => toggleModule(m.key, 'interact')} /> <span className="text-sm">Editar</span></label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
