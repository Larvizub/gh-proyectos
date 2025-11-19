import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersService, projectsService, tasksService } from '@/services/firebase.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { User as UserType } from '@/types';
import { Input } from '@/components/ui/input';

export default function UserProfilePage() {
  const { user: authUser, signOut } = useAuth();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [projectsCount, setProjectsCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        if (!authUser) { setLoading(false); return; }
        const u = await usersService.get(authUser.id);
        // load quick stats
        try {
          const [allProjects, allTasks] = await Promise.all([projectsService.getAll(), tasksService.getAll()]);
          setProjectsCount(allProjects.filter(p => p.ownerId === authUser.id || p.memberIds?.includes(authUser.id)).length);
          setTasksCount(allTasks.filter(t => (t.assigneeIds || []).includes(authUser.id)).length);
        } catch (e) {
          // ignore stats errors
        }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold">Mi perfil</h1>
          <p className="text-muted-foreground mt-2 text-lg">Información de tu cuenta y preferencias</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil de usuario</CardTitle>
          <CardDescription>Detalles de la cuenta y acciones rápidas</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <p>Cargando perfil...</p>
          ) : !user ? (
            <p className="text-muted-foreground">No se encontró información del usuario.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <aside className="md:col-span-1">
                <div className="p-4 rounded-lg bg-card border flex flex-col items-center gap-4">
                  <Avatar className="h-28 w-28">
                    {user.photoURL ? (
                      <AvatarImage src={user.photoURL} alt={user.displayName || 'Avatar'} />
                    ) : (
                      <AvatarFallback className="text-2xl text-foreground">{initials(user)}</AvatarFallback>
                    )}
                  </Avatar>

                  <div className="text-center">
                    <p className="text-xl font-semibold">{user.displayName || authUser?.displayName}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>

                  <div className="w-full flex flex-col sm:flex-row sm:justify-center gap-2">
                    <Button onClick={() => { navigator.clipboard?.writeText(user.id || ''); }} variant="ghost" className="flex-1">Copiar ID</Button>
                    <Button onClick={() => setEditing(true)} variant="outline" className="flex-1">Editar</Button>
                    <Button onClick={() => signOut()} variant="destructive" className="flex-1">Cerrar sesión</Button>
                  </div>

                  <div className="w-full text-sm text-muted-foreground text-center mt-2">ID: {user.id}</div>
                </div>
              </aside>

              <main className="md:col-span-2">
                <div className="flex gap-4 mb-6 overflow-x-auto pb-1">
                  <div className="min-w-[160px] p-4 rounded-lg bg-card border text-card-foreground text-center">
                    <div className="text-sm text-muted-foreground">Proyectos</div>
                    <div className="text-xl font-semibold text-foreground">{projectsCount}</div>
                  </div>
                  <div className="min-w-[160px] p-4 rounded-lg bg-card border text-card-foreground text-center">
                    <div className="text-sm text-muted-foreground">Tareas asignadas</div>
                    <div className="text-xl font-semibold text-foreground">{tasksCount}</div>
                  </div>
                  <div className="min-w-[160px] p-4 rounded-lg bg-card border text-card-foreground text-center">
                    <div className="text-sm text-muted-foreground">Rol</div>
                    <div className="text-xl font-semibold text-foreground">{user.role || '—'}</div>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Editar perfil</CardTitle>
                    <CardDescription>Cambia tu nombre público</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Label>Nombre para mostrar</Label>
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
                          </div>
                          <div>
                            <Button onClick={() => setEditing(true)}>Editar</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <section className="mt-6">
                  <Label>Información adicional</Label>
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
