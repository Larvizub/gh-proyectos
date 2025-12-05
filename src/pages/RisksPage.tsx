import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { risksService, projectsService, usersService } from '@/services/firebase.service';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Risk, RiskProbability, RiskImpact, RiskStatus, RiskCategory, Project } from '@/types';
import { Plus, ArrowLeft, AlertTriangle, Edit3, Trash2, X, Save } from 'lucide-react';
import Select from '@/components/ui/select';
import PageLoader from '@/components/PageLoader';
import { createPortal } from 'react-dom';

const PROBABILITY_VALUES: Record<RiskProbability, number> = {
  'very-low': 1,
  'low': 2,
  'medium': 3,
  'high': 4,
  'very-high': 5,
};

const IMPACT_VALUES: Record<RiskImpact, number> = {
  'very-low': 1,
  'low': 2,
  'medium': 3,
  'high': 4,
  'very-high': 5,
};

const PROBABILITY_LABELS: Record<RiskProbability, string> = {
  'very-low': 'Muy Baja',
  'low': 'Baja',
  'medium': 'Media',
  'high': 'Alta',
  'very-high': 'Muy Alta',
};

const IMPACT_LABELS: Record<RiskImpact, string> = {
  'very-low': 'Muy Bajo',
  'low': 'Bajo',
  'medium': 'Medio',
  'high': 'Alto',
  'very-high': 'Muy Alto',
};

const STATUS_LABELS: Record<RiskStatus, string> = {
  'identified': 'Identificado',
  'analyzing': 'En Análisis',
  'planned': 'Planificado',
  'in-progress': 'En Progreso',
  'resolved': 'Resuelto',
  'closed': 'Cerrado',
};

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  'technical': 'Técnico',
  'external': 'Externo',
  'organizational': 'Organizacional',
  'project-management': 'Gestión de Proyecto',
};

const RESPONSE_LABELS: Record<string, string> = {
  'avoid': 'Evitar',
  'transfer': 'Transferir',
  'mitigate': 'Mitigar',
  'accept': 'Aceptar',
  'exploit': 'Explotar',
  'share': 'Compartir',
  'enhance': 'Mejorar',
};

function getRiskScoreColor(score: number): string {
  if (score <= 4) return 'bg-green-500/20 text-green-700 dark:text-green-400';
  if (score <= 9) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
  if (score <= 15) return 'bg-orange-500/20 text-orange-700 dark:text-orange-400';
  return 'bg-red-500/20 text-red-700 dark:text-red-400';
}

function getRiskScoreLabel(score: number): string {
  if (score <= 4) return 'Bajo';
  if (score <= 9) return 'Moderado';
  if (score <= 15) return 'Alto';
  return 'Crítico';
}

interface RiskModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  risk?: Risk | null;
  users: Array<{ id: string; displayName?: string; email?: string }>;
  isOwner: boolean;
}

function RiskModal({ open, onClose, projectId, risk, users, isOwner }: RiskModalProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Risk>>({
    title: '',
    description: '',
    category: 'technical',
    probability: 'medium',
    impact: 'medium',
    responseStrategy: 'mitigate',
    responsePlan: '',
    contingencyPlan: '',
    ownerId: '',
    status: 'identified',
    triggerConditions: '',
  });

  useEffect(() => {
    if (risk) {
      setForm(risk);
    } else {
      setForm({
        title: '',
        description: '',
        category: 'technical',
        probability: 'medium',
        impact: 'medium',
        responseStrategy: 'mitigate',
        responsePlan: '',
        contingencyPlan: '',
        ownerId: '',
        status: 'identified',
        triggerConditions: '',
      });
    }
  }, [risk, open]);

  const handleSave = async () => {
    if (!form.title?.trim()) {
      toast.error('El título es requerido');
      return;
    }

    setSaving(true);
    try {
      const prob = PROBABILITY_VALUES[form.probability as RiskProbability] || 3;
      const imp = IMPACT_VALUES[form.impact as RiskImpact] || 3;
      const riskScore = prob * imp;

      const payload: Partial<Risk> = {
        ...form,
        projectId,
        riskScore,
        updatedBy: user?.id,
      };

      if (risk?.id) {
        await risksService.update(risk.id, payload);
        toast.success('Riesgo actualizado');
      } else {
        payload.createdBy = user?.id;
        payload.identifiedDate = Date.now();
        await risksService.create(payload);
        toast.success('Riesgo creado');
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el riesgo');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between border-b">
          <CardTitle>{risk ? 'Editar Riesgo' : 'Nuevo Riesgo'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título *</label>
            <Input
              value={form.title || ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              disabled={!isOwner}
              placeholder="Nombre del riesgo"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Descripción</label>
            <textarea
              value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              disabled={!isOwner}
              rows={2}
              className="w-full rounded-lg border-2 border-border bg-input px-3 py-2 text-sm disabled:opacity-60"
              placeholder="Descripción detallada del riesgo"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Categoría</label>
              <Select value={form.category || 'technical'} onChange={v => setForm(f => ({ ...f, category: v as RiskCategory }))}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Estado</label>
              <Select value={form.status || 'identified'} onChange={v => setForm(f => ({ ...f, status: v as RiskStatus }))}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Probabilidad</label>
              <Select value={form.probability || 'medium'} onChange={v => setForm(f => ({ ...f, probability: v as RiskProbability }))}>
                {Object.entries(PROBABILITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Impacto</label>
              <Select value={form.impact || 'medium'} onChange={v => setForm(f => ({ ...f, impact: v as RiskImpact }))}>
                {Object.entries(IMPACT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="text-sm font-medium">Puntuación de Riesgo</div>
            <div className="flex items-center gap-2 mt-1">
              {(() => {
                const prob = PROBABILITY_VALUES[form.probability as RiskProbability] || 3;
                const imp = IMPACT_VALUES[form.impact as RiskImpact] || 3;
                const score = prob * imp;
                return (
                  <>
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${getRiskScoreColor(score)}`}>
                      {score}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({getRiskScoreLabel(score)})
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Estrategia de Respuesta</label>
            <Select value={form.responseStrategy || 'mitigate'} onChange={v => setForm(f => ({ ...f, responseStrategy: v as any }))}>
              {Object.entries(RESPONSE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Plan de Respuesta</label>
            <textarea
              value={form.responsePlan || ''}
              onChange={e => setForm(f => ({ ...f, responsePlan: e.target.value }))}
              disabled={!isOwner}
              rows={2}
              className="w-full rounded-lg border-2 border-border bg-input px-3 py-2 text-sm disabled:opacity-60"
              placeholder="Acciones para responder al riesgo"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Plan de Contingencia</label>
            <textarea
              value={form.contingencyPlan || ''}
              onChange={e => setForm(f => ({ ...f, contingencyPlan: e.target.value }))}
              disabled={!isOwner}
              rows={2}
              className="w-full rounded-lg border-2 border-border bg-input px-3 py-2 text-sm disabled:opacity-60"
              placeholder="Acciones si el riesgo se materializa"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Condiciones de Activación</label>
            <Input
              value={form.triggerConditions || ''}
              onChange={e => setForm(f => ({ ...f, triggerConditions: e.target.value }))}
              disabled={!isOwner}
              placeholder="Indicadores que activan el riesgo"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Responsable</label>
            <Select value={form.ownerId || ''} onChange={v => setForm(f => ({ ...f, ownerId: v }))}>
              <option value="">Sin asignar</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
              ))}
            </Select>
          </div>
        </CardContent>

        <div className="flex-shrink-0 flex justify-end gap-3 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {isOwner && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );

  return createPortal(modal, document.body);
}

export default function RisksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; displayName?: string; email?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);

  const isOwner = user && project && (project.ownerId === user.id || (project.owners && project.owners.includes(user.id)));

  useEffect(() => {
    if (!projectId) return;

    let mounted = true;

    (async () => {
      try {
        const p = await projectsService.get(projectId);
        if (mounted) setProject(p);
      } catch (err) {
        console.error(err);
      }
    })();

    const off = risksService.listenByProject(projectId, (list) => {
      if (mounted) {
        setRisks(list.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)));
        setLoading(false);
      }
    });

    (async () => {
      try {
        const all = await usersService.getAll();
        if (mounted) setUsers(all || []);
      } catch (e) {
        console.warn(e);
      }
    })();

    return () => { mounted = false; off(); };
  }, [projectId]);

  const handleDelete = async () => {
    if (!riskToDelete) return;
    try {
      await risksService.delete(riskToDelete.id);
      toast.success('Riesgo eliminado');
      setDeleteModalOpen(false);
      setRiskToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar');
    }
  };

  if (loading) return <PageLoader message="Cargando matriz de riesgos..." overlay={false} />;
  if (!project) return <div>Proyecto no encontrado</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/risks')} className="h-8 px-2 sm:h-9 sm:px-3">
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Volver</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 flex-shrink-0" />
              <span className="truncate">Matriz de Riesgos</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{project.name}</p>
          </div>
        </div>

        {isOwner && (
          <Button onClick={() => { setEditingRisk(null); setModalOpen(true); }} className="w-full sm:w-auto h-9">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Riesgo
          </Button>
        )}
      </div>

      {/* Vista móvil: tarjetas */}
      <div className="sm:hidden space-y-3">
        {risks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No hay riesgos identificados.{isOwner && ' Toca "Nuevo Riesgo" para agregar uno.'}
            </CardContent>
          </Card>
        ) : (
          risks.map(risk => {
            const owner = users.find(u => u.id === risk.ownerId);
            return (
              <Card key={risk.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${getRiskScoreColor(risk.riskScore)}`}>
                          {risk.riskScore}
                        </span>
                        <h3 className="font-medium text-sm truncate">{risk.title}</h3>
                      </div>
                      {risk.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{risk.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingRisk(risk); setModalOpen(true); }}
                        className="p-1.5 rounded hover:bg-muted"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => { setRiskToDelete(risk); setDeleteModalOpen(true); }}
                          className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-muted">{CATEGORY_LABELS[risk.category]}</span>
                    <span className="px-1.5 py-0.5 rounded bg-muted">{STATUS_LABELS[risk.status]}</span>
                    <span className="px-1.5 py-0.5 rounded bg-muted">{RESPONSE_LABELS[risk.responseStrategy]}</span>
                    {owner && <span className="text-muted-foreground">• {owner.displayName || owner.email}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Vista desktop: tabla */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Riesgo</th>
                  <th className="text-left px-4 py-3 font-medium">Categoría</th>
                  <th className="text-center px-4 py-3 font-medium">P</th>
                  <th className="text-center px-4 py-3 font-medium">I</th>
                  <th className="text-center px-4 py-3 font-medium">Score</th>
                  <th className="text-left px-4 py-3 font-medium">Respuesta</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {risks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      No hay riesgos identificados. {isOwner && 'Haz clic en "Nuevo Riesgo" para agregar uno.'}
                    </td>
                  </tr>
                ) : (
                  risks.map(risk => {
                    const owner = users.find(u => u.id === risk.ownerId);
                    return (
                      <tr key={risk.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{risk.title}</div>
                          {risk.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{risk.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {CATEGORY_LABELS[risk.category] || risk.category}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs">{PROBABILITY_VALUES[risk.probability]}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs">{IMPACT_VALUES[risk.impact]}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskScoreColor(risk.riskScore)}`}>
                            {risk.riskScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {RESPONSE_LABELS[risk.responseStrategy] || risk.responseStrategy}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded bg-muted text-xs">
                            {STATUS_LABELS[risk.status] || risk.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {owner ? (owner.displayName || owner.email) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditingRisk(risk); setModalOpen(true); }}
                              className="p-2 rounded hover:bg-muted"
                              title="Editar"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            {isOwner && (
                              <button
                                onClick={() => { setRiskToDelete(risk); setDeleteModalOpen(true); }}
                                className="p-2 rounded hover:bg-destructive/10 text-destructive"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs">
        <span className="text-muted-foreground">Score:</span>
        <div className="flex items-center gap-1">
          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-green-500/20 text-green-700 dark:text-green-400">1-4</span>
          <span>Bajo</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">5-9</span>
          <span>Mod.</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-orange-500/20 text-orange-700 dark:text-orange-400">10-15</span>
          <span>Alto</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-red-500/20 text-red-700 dark:text-red-400">16+</span>
          <span>Crít.</span>
        </div>
      </div>

      <RiskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRisk(null); }}
        projectId={projectId || ''}
        risk={editingRisk}
        users={users}
        isOwner={!!isOwner}
      />

      {/* Modal de confirmación de eliminación */}
      {deleteModalOpen && riskToDelete && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteModalOpen(false)} />
          <Card className="relative z-10 w-full max-w-md">
            <CardHeader>
              <CardTitle>Eliminar Riesgo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de eliminar el riesgo <strong>{riskToDelete.title}</strong>?
              </p>
            </CardContent>
            <div className="flex justify-end gap-3 p-4 border-t">
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
            </div>
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}
