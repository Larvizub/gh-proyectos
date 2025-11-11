import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { projectsService } from '@/services/firebase.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [status, setStatus] = useState<'active' | 'planned' | 'completed'>('active');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      toast.error('Debes iniciar sesión para crear proyectos');
      return;
    }

    const payload = {
      name,
      description,
      color,
      status,
      ownerId: user.id,
      memberIds: [user.id], // El creador es automáticamente miembro
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Nuevo Proyecto
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Crea un nuevo proyecto y comienza a organizar tus tareas
        </p>
      </div>
      
      <Card className="border-2 shadow-lg">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-1">
                Nombre del proyecto <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-3 transition-all outline-none text-base"
                placeholder="Ej: Desarrollo de App Móvil"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-3 transition-all outline-none resize-none text-base"
                rows={5}
                placeholder="Describe brevemente el objetivo y alcance del proyecto..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Color del proyecto</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)}
                    className="h-12 w-20 rounded-lg border-2 border-border cursor-pointer"
                  />
                  <div className="flex-1">
                    <div 
                      className="h-12 rounded-lg shadow-sm border-2 transition-all"
                      style={{ backgroundColor: color, borderColor: color }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Estado inicial</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value as any)} 
                  className="w-full h-12 rounded-lg border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 transition-all outline-none bg-background text-base"
                >
                  <option value="active">✅ Activo</option>
                  <option value="planned">📅 Planeado</option>
                  <option value="completed">🎉 Completado</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" size="lg" className="flex-1 h-12 shadow-lg">
                <Plus className="mr-2 h-5 w-5" />
                Crear Proyecto
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/projects')}
                className="h-12"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
