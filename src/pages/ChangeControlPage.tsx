import { useState, useEffect, useMemo } from 'react';
import { projectsService, changeRequestsService, tasksService } from '@/services/firebase.service';
import { Project, ChangeRequest, ChangeRequestStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { GitPullRequest, ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import PageLoader from '@/components/PageLoader';
import { Badge } from '@/components/ui/badge';

export default function ChangeControlPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState<Set<string>>(new Set());
  
  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [proposedAction, setProposedAction] = useState('');
  
  // Impact Analysis
  const [impactScope, setImpactScope] = useState('');
  const [impactSchedule, setImpactSchedule] = useState('');
  const [impactCost, setImpactCost] = useState('');
  const [impactQuality, setImpactQuality] = useState('');
  const [impactResources, setImpactResources] = useState('');
  const [impactRisks, setImpactRisks] = useState('');

  const IMPACT_OPTIONS = {
    scope: [
      "Sin cambios en el alcance",
      "Cambio menor (ajuste de requisitos)",
      "Cambio significativo (nueva funcionalidad)",
      "Reducción de alcance",
      "Cambio crítico (redefinición del proyecto)"
    ],
    schedule: [
      "Sin impacto en el cronograma",
      "Retraso menor (< 1 semana)",
      "Retraso moderado (1-4 semanas)",
      "Retraso mayor (> 1 mes)",
      "Adelanto en la entrega"
    ],
    cost: [
      "Sin costo adicional",
      "Incremento marginal (< 5% del presupuesto)",
      "Incremento moderado (5-15% del presupuesto)",
      "Incremento significativo (> 15% del presupuesto)",
      "Reducción de costos"
    ],
    quality: [
      "Sin impacto en la calidad",
      "Mejora en la calidad del entregable",
      "Riesgo de defectos menores",
      "Posible degradación de rendimiento",
      "Compromete estándares de calidad"
    ],
    resources: [
      "Sin cambios en recursos",
      "Requiere horas extra del equipo actual",
      "Requiere reasignación de tareas",
      "Requiere personal adicional especializado",
      "Requiere nuevas herramientas/licencias"
    ],
    risks: [
      "Sin nuevos riesgos identificados",
      "Riesgo bajo (monitoreo)",
      "Riesgo medio (requiere plan de mitigación)",
      "Riesgo alto (posible bloqueo)",
      "Introduce dependencia crítica"
    ]
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        const tasks = await tasksService.getAll();
        const ids = new Set<string>();
        tasks.forEach((t: any) => {
          // detectar asignaciones en varios formatos
          const assigned = t?.assignedTo;
          if (assigned) {
            if (typeof assigned === 'string') {
              if (assigned === user.id || String(assigned).toLowerCase() === String(user.email).toLowerCase()) {
                if (t.projectId) ids.add(t.projectId);
              }
            } else if (typeof assigned === 'object') {
              if (assigned.userId === user.id || String(assigned.email || '').toLowerCase() === String(user.email).toLowerCase()) {
                if (t.projectId) ids.add(t.projectId);
              }
            }
          }
          const assigneeIds = t?.assigneeIds || t?.assignedUserIds || null;
          if (Array.isArray(assigneeIds) && assigneeIds.includes(user.id)) {
            if (t.projectId) ids.add(t.projectId);
          }
        });
        if (mounted) setAssignedProjectIds(ids);
      } catch (err) {
        console.warn('Failed to load tasks to compute assigned projects', err);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (selectedProject) {
      const unsubscribe = changeRequestsService.listenByProject(selectedProject.id, (data) => {
        setRequests(data.sort((a, b) => b.createdAt - a.createdAt));
      });
      return () => unsubscribe();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const all = await projectsService.getAll();
      // Filter active projects or all projects? Usually change control is for active projects.
      // But let's show all except archived maybe? Or just all.
      // Let's show active and completed (in case of post-mortem changes? unlikely).
      // Let's show active projects primarily.
      setProjects(all.filter(p => p.status !== 'archived'));
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  const userProjects = useMemo(() => {
    return projects.filter(
      p => p.ownerId === user?.id || p.memberIds?.includes(user?.id || '') || p.owners?.includes(user?.id || '') || assignedProjectIds.has(p.id)
    );
  }, [projects, user?.id, assignedProjectIds]);

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !user) return;

    try {
      await changeRequestsService.create({
        projectId: selectedProject.id,
        title,
        description,
        justification,
        priority,
        impactScope,
        impactSchedule,
        impactCost,
        impactQuality,
        impactResources,
        impactRisks,
        proposedAction,
        status: 'pending',
        requesterId: user.id,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      toast.success('Solicitud de cambio creada');
      setIsAdding(false);
      resetForm();
    } catch (error) {
      console.error('Error adding request:', error);
      toast.error('Error al crear la solicitud');
    }
  };

  const handleStatusChange = async (id: string, newStatus: ChangeRequestStatus) => {
    if (!user) return;
    try {
      await changeRequestsService.update(id, {
        status: newStatus,
        approverId: user.id,
        approvalDate: Date.now()
      });
      toast.success(`Estado actualizado a: ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar estado');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setJustification('');
    setPriority('medium');
    setProposedAction('');
    setImpactScope('');
    setImpactSchedule('');
    setImpactCost('');
    setImpactQuality('');
    setImpactResources('');
    setImpactRisks('');
  };

  const getStatusBadge = (status: ChangeRequestStatus) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500">Aprobado</Badge>;
      case 'rejected': return <Badge variant="destructive">Rechazado</Badge>;
      case 'deferred': return <Badge variant="secondary">Diferido</Badge>;
      default: return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente</Badge>;
    }
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
          <h1 className="text-2xl font-bold">{selectedProject.name} - Control de Cambios</h1>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? 'Cancelar' : 'Nueva Solicitud de Cambio'}
          </Button>
        </div>

        {isAdding && (
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle>Registrar Solicitud de Cambio (Change Request)</CardTitle>
              <CardDescription>Complete la información requerida para evaluar el impacto del cambio.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddRequest} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Título del Cambio</Label>
                    <input 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select 
                      value={priority}
                      onChange={(val) => setPriority(val as any)}
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descripción del Cambio</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalle en qué consiste el cambio..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Justificación (Razón del cambio)</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="¿Por qué es necesario este cambio?"
                    required
                  />
                </div>

                <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Análisis de Impacto
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Impacto en Alcance</Label>
                      <Select 
                        value={impactScope} 
                        onChange={setImpactScope}
                      >
                        <option value="">Seleccionar impacto...</option>
                        {IMPACT_OPTIONS.scope.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impacto en Cronograma</Label>
                      <Select 
                        value={impactSchedule} 
                        onChange={setImpactSchedule}
                      >
                        <option value="">Seleccionar impacto...</option>
                        {IMPACT_OPTIONS.schedule.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impacto en Costo</Label>
                      <Select 
                        value={impactCost} 
                        onChange={setImpactCost}
                      >
                        <option value="">Seleccionar impacto...</option>
                        {IMPACT_OPTIONS.cost.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impacto en Calidad</Label>
                      <Select 
                        value={impactQuality} 
                        onChange={setImpactQuality}
                      >
                        <option value="">Seleccionar impacto...</option>
                        {IMPACT_OPTIONS.quality.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impacto en Recursos</Label>
                      <Select 
                        value={impactResources} 
                        onChange={setImpactResources}
                      >
                        <option value="">Seleccionar impacto...</option>
                        {IMPACT_OPTIONS.resources.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impacto en Riesgos</Label>
                      <Select 
                        value={impactRisks} 
                        onChange={setImpactRisks}
                      >
                        <option value="">Seleccionar impacto...</option>
                        {IMPACT_OPTIONS.risks.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Acción Propuesta</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={proposedAction}
                    onChange={(e) => setProposedAction(e.target.value)}
                    placeholder="Pasos a seguir para implementar el cambio..."
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>Cancelar</Button>
                  <Button type="submit">Crear Solicitud</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No hay solicitudes de cambio registradas.
            </div>
          ) : (
            requests.map(req => (
              <Card key={req.id} className="overflow-hidden">
                <div className={`h-1 w-full ${
                  req.priority === 'urgent' ? 'bg-red-500' : 
                  req.priority === 'high' ? 'bg-orange-500' : 
                  req.priority === 'medium' ? 'bg-blue-500' : 'bg-green-500'
                }`} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{req.title}</CardTitle>
                      <CardDescription className="mt-1">
                        Solicitado el {new Date(req.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{req.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-3 rounded-md text-sm">
                      <div>
                        <span className="font-semibold">Justificación:</span>
                        <p className="mt-1">{req.justification}</p>
                      </div>
                      <div>
                        <span className="font-semibold">Acción Propuesta:</span>
                        <p className="mt-1">{req.proposedAction}</p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold mb-2">Análisis de Impacto</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {req.impactScope && <div className="bg-background border p-2 rounded"><strong>Alcance:</strong> {req.impactScope}</div>}
                        {req.impactSchedule && <div className="bg-background border p-2 rounded"><strong>Cronograma:</strong> {req.impactSchedule}</div>}
                        {req.impactCost && <div className="bg-background border p-2 rounded"><strong>Costo:</strong> {req.impactCost}</div>}
                        {req.impactQuality && <div className="bg-background border p-2 rounded"><strong>Calidad:</strong> {req.impactQuality}</div>}
                        {req.impactResources && <div className="bg-background border p-2 rounded"><strong>Recursos:</strong> {req.impactResources}</div>}
                        {req.impactRisks && <div className="bg-background border p-2 rounded"><strong>Riesgos:</strong> {req.impactRisks}</div>}
                      </div>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex justify-end gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(req.id, 'deferred')}>
                          <Clock className="w-4 h-4 mr-1" /> Diferir
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleStatusChange(req.id, 'rejected')}>
                          <XCircle className="w-4 h-4 mr-1" /> Rechazar
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange(req.id, 'approved')}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Aprobar
                        </Button>
                      </div>
                    )}
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
        <GitPullRequest className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Control de Cambios</h1>
          <p className="text-muted-foreground">Gestión de solicitudes de cambio y análisis de impacto</p>
        </div>
      </div>

      {userProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <GitPullRequest className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No hay proyectos activos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userProjects.map(project => (
            <Card 
              key={project.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedProject(project)}
            >
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>{project.status === 'active' ? 'En Progreso' : 'Completado'}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {project.description || 'Sin descripción'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
