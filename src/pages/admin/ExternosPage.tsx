import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { externalsService } from '@/services/firebase.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ExternosPage() {
  const { user } = useAuth();
  const isAdmin = !!(user && typeof user.role === 'string' && user.role.toLowerCase() === 'admin');
  const [items, setItems] = useState<Array<{ id: string; email: string }>>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const list = await externalsService.getAll();
        if (!mounted) return;
        setItems(list.map(i => ({ id: i.id, email: i.email })));
      } catch (err) {
        console.error('Failed to load externals', err);
      } finally {
        setLoading(false);
      }
    }
    load();

    const off = externalsService.listen((list) => {
      if (!mounted) return;
      setItems(list.map(i => ({ id: i.id, email: i.email })));
    });

    return () => { mounted = false; off(); };
  }, []);

  const add = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Correo inválido');
      return;
    }
    try {
      setAdding(true);
      await externalsService.add(email.trim().toLowerCase());
      toast.success('Externo agregado');
      setEmail('');
      // Do not optimistic-update the list: the realtime listener will update the UI
    } catch (err) {
      console.error(err);
      toast.error('Error agregando externo');
    }
    finally {
      setAdding(false);
    }
  };

  const remove = (id: string, email: string) => {
    setToDelete({ id, email });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await externalsService.remove(toDelete.id);
      toast.success('Externo eliminado');
      // listener will update the list
    } catch (err) {
      console.error(err);
      toast.error('Error eliminando');
    } finally {
      setShowDeleteModal(false);
      setToDelete(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acceso denegado. Solo administradores pueden ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Externos</h1>
        <p className="text-sm text-muted-foreground">Lista de correos permitidos sin restricción por dominio</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Administrar correos externos</CardTitle>
          <CardDescription>Añade direcciones que podrán crear cuentas/ingresar sin comprobación de dominio.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail((e.target as HTMLInputElement).value)} disabled={adding} />
            <Button onClick={add} disabled={adding}>{adding ? 'Agregando...' : 'Agregar'}</Button>
          </div>

          {loading ? (
            <p>Cargando...</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.length === 0 ? <li className="text-muted-foreground">No hay correos registrados.</li> : null}
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between p-3 rounded bg-card border">
                  <div className="text-sm">{it.email}</div>
                      <div>
                        <Button variant="destructive" onClick={() => remove(it.id, it.email)}>Eliminar</Button>
                      </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {/* Delete confirmation modal */}
      {showDeleteModal && toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setShowDeleteModal(false); setToDelete(null); }} />
          <div className="relative w-full max-w-md z-10">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Confirmar eliminación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Estás a punto de eliminar el correo <strong>{toDelete.email}</strong> de la lista de externos. Esta acción no se puede deshacer. ¿Deseas continuar?
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowDeleteModal(false); setToDelete(null); }}>Cancelar</Button>
                  <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
