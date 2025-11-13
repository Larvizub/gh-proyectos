import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import Select from '@/components/ui/select';
import { CheckCircle, Calendar, Trophy } from 'lucide-react';
import ColorPickerButton from '@/components/ui/ColorPickerButton';
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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<'active' | 'planned' | 'completed'>('active');

  const presetColors = [
    '#111827', // gray-900
    '#374151', // gray-700
    '#64748b', // slate
    '#0f172a', // slate-900
    '#0ea5e9', // sky
    '#06b6d4', // cyan
    '#06b6d4',
    '#38bdf8',
    '#6366f1', // indigo
    '#7c3aed',
    '#8b5cf6', // violet
    '#a78bfa',
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#10b981', // emerald
    '#34d399',
    '#ec4899', // pink
  ];

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
      tags,
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
                className="w-full rounded-lg border-2 border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-3 transition-all outline-none text-base"
                placeholder="Ej: Desarrollo de App Móvil"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border-2 border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 px-4 py-3 transition-all outline-none resize-none text-base"
                rows={5}
                placeholder="Describe brevemente el objetivo y alcance del proyecto..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Color del proyecto</label>
                <ColorPickerButton
                  color={color}
                  onChange={setColor}
                  presetColors={presetColors}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Estado inicial</label>
                <Select value={status} onChange={(v) => setStatus(v as any)} className="w-full">
                  <option value="active">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Activo
                    </div>
                  </option>
                  <option value="planned">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Planeado
                    </div>
                  </option>
                  <option value="completed">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      Completado
                    </div>
                  </option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Tags del proyecto (opcional)</label>
              <div className="flex gap-2 items-center">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Añadir tag" className="rounded-lg border-2 border-border bg-input px-3 py-2 w-full" />
                <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground" onClick={() => {
                  const t = tagInput.trim();
                  if (t && !tags.includes(t)) {
                    setTags(prev => [...prev, t]);
                  }
                  setTagInput('');
                }}>+</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/70 text-sm">
                    <span className="truncate max-w-[12rem]">{t}</span>
                    <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="h-5 w-5 rounded-full inline-flex items-center justify-center text-sm">×</button>
                  </span>
                ))}
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
