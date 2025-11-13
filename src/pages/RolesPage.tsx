import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { rolesService, Role } from '@/services/firebase.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import RoleModal from '@/components/roles/RoleModal';

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
      <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor" />
    </svg>
  );
}

function IconDelete() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z" fill="currentColor" />
      <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor" />
    </svg>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await rolesService.getAll();
      setRoles(r);
    } catch (err) {
      console.error('Failed to load roles', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreateOrUpdate(payload: Omit<Role, 'createdAt' | 'updatedAt'>) {
    setLoading(true);
    try {
      if (!payload.id) {
        const created = await rolesService.create({ name: payload.name, modules: payload.modules });
        setRoles((s) => [created, ...s]);
      } else {
        await rolesService.update(payload.id, { name: payload.name, modules: payload.modules });
        const updated = await rolesService.get(payload.id);
        setRoles((s) => s.map((r) => (r.id === payload.id && updated ? updated : r)));
      }
    } catch (err) {
      console.error('Failed to save role', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar rol?')) return;
    setLoading(true);
    try {
      await rolesService.delete(id);
      setRoles((s) => s.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete role', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Roles</h1>
          <p className="text-muted-foreground mt-2 text-lg">Define y administra los roles y permisos de tu organización</p>
        </div>
        <Button asChild size="lg" className="shadow-lg">
          <button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="mr-2 h-5 w-5" />
            Crear rol
          </button>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full table-auto">
          <thead>
            <tr className="text-left">
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Permisos</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr><td colSpan={3} className="p-4 text-muted-foreground">No hay roles definidos.</td></tr>
            ) : (
              roles.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.modules ? Object.keys(r.modules).filter(k => r.modules && (r.modules[k].observe || r.modules[k].interact)).join(', ') : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button title="Editar" className="p-2 rounded hover:bg-muted" onClick={() => { setEditing(r); setModalOpen(true); }}>
                        <IconEdit />
                      </button>
                      <button title="Eliminar" className="p-2 rounded hover:bg-red-50 text-red-600" onClick={() => handleDelete(r.id)}>
                        <IconDelete />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </CardContent>
      </Card>

      <RoleModal open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} onSave={handleCreateOrUpdate} />
    </div>
  );
}
