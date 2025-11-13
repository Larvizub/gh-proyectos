import React, { useState } from 'react';
import { User } from '@/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';

type Props = {
  user: User;
  onUpdate: (id: string, updates: Partial<User>) => void;
};

export default function UserCard({ user, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(user.role);

  const save = async () => {
    await onUpdate(user.id, { role });
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-md border bg-card">
      <div className="flex items-center gap-3">
        <Avatar>
          {user.photoURL ? (
            <AvatarImage src={user.photoURL} alt={user.displayName} />
          ) : (
            <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
          )}
        </Avatar>
        <div>
          <div className="font-medium">{user.displayName}</div>
          <div className="text-sm text-slate-500">{user.email}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {editing ? (
          <div className="w-48">
            <Select value={role} onChange={(v) => setRole(v)}>
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </Select>
          </div>
        ) : (
          <div className="text-sm px-2 py-1 rounded-md bg-muted">{user.role}</div>
        )}

        {editing ? (
          <>
            <Button variant="primary" onClick={save}>Guardar</Button>
            <Button onClick={() => { setRole(user.role); setEditing(false); }}>Cancelar</Button>
          </>
        ) : (
          <Button onClick={() => setEditing(true)}>Editar</Button>
        )}
      </div>
    </div>
  );
}
