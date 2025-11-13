import { useEffect, useState } from 'react';
import { usersService } from '@/services/firebase.service';
import { User } from '@/types';
import UserCard from '@/components/users/UserCard';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    usersService.getAll().then((res) => {
      if (!mounted) return;
      setUsers(res);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { mounted = false };
  }, []);

  const onUpdate = async (id: string, updates: Partial<User>) => {
    await usersService.update(id, updates);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Usuarios</h1>

      {loading ? (
        <p>Cargando usuarios...</p>
      ) : users.length === 0 ? (
        <p>No hay usuarios registrados.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {users.map((u) => (
            <UserCard key={u.id} user={u} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
