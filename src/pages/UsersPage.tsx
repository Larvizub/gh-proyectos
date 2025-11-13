import { useEffect, useState } from 'react';
import { usersService, rolesService } from '@/services/firebase.service';
import Select from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { User } from '@/types';

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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');

  useEffect(() => {
    let mounted = true;
    usersService.getAll().then((res) => {
      if (!mounted) return;
      setUsers(res);
      setLoading(false);
    }).catch(() => setLoading(false));
    // load roles
    rolesService.getAll().then((rs) => {
      if (!mounted) return;
      setRoles(rs.map((r) => ({ id: r.id, name: r.name })));
    }).catch(() => {});
    return () => { mounted = false };
  }, []);

  // NOTE: inline update implemented via saveEdit; keep generic updater if needed in future

  const onDelete = async (id: string) => {
    const ok = window.confirm('¿Eliminar usuario? Esta acción no se puede deshacer.');
    if (!ok) return;
    try {
      await usersService.delete(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error('Failed deleting user', err);
    }
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditRole(u.role || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRole('');
  };

  const saveEdit = async (id: string) => {
    setUpdatingId(id);
    try {
      // Ensure role saved is normalized (lowercase) to match server checks like 'admin'
      const roleValue: any = editRole ? String(editRole).toLowerCase() : '';
      await usersService.update(id, { role: roleValue } as any);
      setUsers((prev) => prev.map((u) => (u.id === id ? ({ ...u, role: roleValue } as any) : u)));
      cancelEdit();
    } catch (err) {
      console.error('Failed saving user', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Usuarios</h1>
          <p className="text-muted-foreground mt-2 text-lg">Gestiona los usuarios registrados y asigna roles</p>
        </div>
      </div>

      {loading ? (
        <p>Cargando usuarios...</p>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">No hay usuarios registrados.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full table-auto">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3">{u.displayName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-72">
                          <Select value={editRole} onChange={(v) => setEditRole(v)} className="w-full">
                            <option value="">-- Seleccionar rol --</option>
                            {roles.map((r) => (
                              <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{u.role || '—'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      {editingId === u.id ? (
                        <>
                          <button className="px-2 py-1 bg-muted rounded text-sm" onClick={() => saveEdit(u.id)} disabled={updatingId === u.id}>Guardar</button>
                          <button className="px-2 py-1 border rounded text-sm" onClick={cancelEdit} disabled={updatingId === u.id}>Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button title="Editar" className="p-1 rounded hover:bg-muted" onClick={() => startEdit(u)}>
                            <IconEdit />
                          </button>
                          <button title="Eliminar" className="p-1 rounded hover:bg-red-50 text-red-600" onClick={() => onDelete(u.id)}>
                            <IconDelete />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
