import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { projectsService } from '@/services/firebase.service';
import { Button } from '@/components/ui/button';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [status, setStatus] = useState<'active' | 'planned' | 'completed'>('active');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name,
      description,
      color,
      status,
      ownerId: '',
      memberIds: [],
      createdAt: Date.now(),
    } as any;

    // Use sonner promise toast to show progress
    await toast.promise(
      projectsService.create(payload),
      {
        loading: 'Creando proyecto...',
        success: 'Proyecto creado correctamente',
        error: (err) => `Error: ${err?.message || 'No se pudo crear'}`,
      }
    );

    navigate('/projects');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo Proyecto</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            placeholder="Nombre del proyecto"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            rows={4}
            placeholder="Breve descripción"
          />
        </div>

        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="rounded-md border px-2 py-1">
              <option value="active">Activo</option>
              <option value="planned">Planeado</option>
              <option value="completed">Completado</option>
            </select>
          </div>
        </div>

        <div>
          <Button type="submit">Crear Proyecto</Button>
        </div>
      </form>
    </div>
  );
}
