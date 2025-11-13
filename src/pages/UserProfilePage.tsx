import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersService } from '@/services/firebase.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User as UserType } from '@/types';
import { Input } from '@/components/ui/input';
import Avatar, { AvatarFallback } from '@/components/ui/avatar';

export default function UserProfilePage() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        if (!authUser) return;
        const u = await usersService.get(authUser.id);
        if (!mounted) return;
        setUser(u);
        setDisplayName(u?.displayName || authUser.displayName || '');
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false };
  }, [authUser]);

  const save = async () => {
    if (!user) return;
    try {
      await usersService.update(user.id, { displayName });
      setUser((u) => u ? ({ ...u, displayName }) : u);
      setEditing(false);
    } catch (err) {
      console.error('Failed saving profile', err);
    }
  };

  const initials = (user?: UserType | null) => {
    const name = user?.displayName || authUser?.displayName || '';
    return name.split(' ').map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Mi perfil</h1>
          <p className="text-muted-foreground mt-2 text-lg">Información de tu cuenta y preferencias</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <p>Cargando perfil...</p>
          ) : !user ? (
            <p className="text-muted-foreground">No se encontró información del usuario.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <aside className="md:col-span-1 flex flex-col items-start gap-4">
                <div className="flex items-center gap-4 w-full">
                  <div className="h-28 w-28 rounded-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600">
                    <div className="h-24 w-24 rounded-full bg-white/10 dark:bg-white/5 flex items-center justify-center text-3xl font-semibold text-white">{initials(user)}</div>
                  </div>

                  <div className="flex-1">
                    <p className="text-xl font-semibold text-foreground">{user.displayName || authUser?.displayName}</p>
                    <p className="text-sm text-muted-foreground break-words">{user.email}</p>
                  </div>
                </div>

                <div className="w-full">
                  <p className="text-sm text-muted-foreground">Rol</p>
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">{user.role || '—'}</span>
                  </div>
                </div>
              </aside>

              <main className="md:col-span-2">
                <section className="mb-6">
                  <label className="block text-sm text-muted-foreground">Nombre para mostrar</label>
                  {editing ? (
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                      <Input value={displayName} onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)} className="flex-1" />
                      <div className="mt-3 sm:mt-0 flex gap-2">
                        <Button onClick={save}>Guardar</Button>
                        <Button variant="outline" onClick={() => { setEditing(false); setDisplayName(user.displayName || ''); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-lg">{user.displayName}</p>
                        <p className="text-sm text-muted-foreground">ID: {user.id}</p>
                      </div>
                      <div>
                        <Button onClick={() => setEditing(true)}>Editar</Button>
                      </div>
                    </div>
                  )}
                </section>

                <section>
                  <p className="text-sm text-muted-foreground">Información adicional</p>
                  <p className="mt-2 text-sm text-muted-foreground">Aquí puedes ver la información que la aplicación mantiene sobre tu cuenta. Para cambiar permisos o roles, contacta a un administrador en el módulo Administración {'>'} Roles.</p>
                </section>
              </main>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
