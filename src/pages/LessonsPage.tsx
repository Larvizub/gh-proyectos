import { useState, useEffect } from 'react';
import { projectsService, lessonsService } from '@/services/firebase.service';
import { Project, Lesson, LessonCategory } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Trash2, BookOpen, ArrowLeft } from 'lucide-react';
import PageLoader from '@/components/PageLoader';

const CATEGORIES: LessonCategory[] = [
  'Scope', 'Schedule', 'Cost', 'Quality', 'Resources', 
  'Communication', 'Risk', 'Procurement', 'Stakeholder', 'Other'
];

export default function LessonsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [category, setCategory] = useState<LessonCategory>('Other');
  const [issue, setIssue] = useState('');
  const [impact, setImpact] = useState('');
  const [recommendation, setRecommendation] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      const unsubscribe = lessonsService.listenByProject(selectedProject.id, (data) => {
        setLessons(data);
      });
      return () => unsubscribe();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const all = await projectsService.getAll();
      const completed = all.filter(p => p.status === 'completed');
      setProjects(completed);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !user) return;

    try {
      await lessonsService.create({
        projectId: selectedProject.id,
        category,
        issue,
        impact,
        recommendation,
        createdBy: user.id,
        createdAt: Date.now()
      });
      toast.success('Lección aprendida registrada');
      setIsAdding(false);
      resetForm();
    } catch (error) {
      console.error('Error adding lesson:', error);
      toast.error('Error al guardar la lección');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta lección?')) return;
    try {
      await lessonsService.delete(id);
      toast.success('Lección eliminada');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Error al eliminar');
    }
  };

  const resetForm = () => {
    setCategory('Other');
    setIssue('');
    setImpact('');
    setRecommendation('');
  };

  if (loading) return <PageLoader overlay={false} />;

  if (selectedProject) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedProject(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Proyectos
          </Button>
          <h1 className="text-2xl font-bold">{selectedProject.name} - Lecciones Aprendidas</h1>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? 'Cancelar' : 'Nueva Lección'}
          </Button>
        </div>

        {isAdding && (
          <Card>
            <CardHeader>
              <CardTitle>Registrar Lección Aprendida</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddLesson} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoría (PMI)</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as LessonCategory)}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Problema / Observación</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={issue} 
                    onChange={(e) => setIssue(e.target.value)} 
                    placeholder="¿Qué sucedió?"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Impacto</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={impact} 
                    onChange={(e) => setImpact(e.target.value)} 
                    placeholder="¿Cuál fue el efecto en el proyecto?"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Recomendación / Acción Tomada</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={recommendation} 
                    onChange={(e) => setRecommendation(e.target.value)} 
                    placeholder="¿Qué se debe hacer en el futuro?"
                    required
                  />
                </div>

                <Button type="submit">Guardar Lección</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {lessons.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No hay lecciones registradas para este proyecto.
            </div>
          ) : (
            lessons.map(lesson => (
              <Card key={lesson.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {lesson.category}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteLesson(lesson.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div>
                      <span className="font-semibold text-xs uppercase text-muted-foreground">Problema</span>
                      <p className="text-sm mt-1">{lesson.issue}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-xs uppercase text-muted-foreground">Impacto</span>
                      <p className="text-sm mt-1">{lesson.impact}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-xs uppercase text-muted-foreground">Recomendación</span>
                      <p className="text-sm mt-1">{lesson.recommendation}</p>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    Registrado el {new Date(lesson.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <BookOpen className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Lecciones Aprendidas</h1>
          <p className="text-muted-foreground">Repositorio de conocimiento de proyectos finalizados</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No hay proyectos finalizados</p>
            <p className="text-muted-foreground">Complete un proyecto para registrar sus lecciones aprendidas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <Card 
              key={project.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedProject(project)}
            >
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {project.description || 'Sin descripción'}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Finalizado: {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'N/A'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

