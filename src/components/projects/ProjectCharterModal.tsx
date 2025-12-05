import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { charterService, risksService } from '@/services/firebase.service';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ProjectCharter, Project, Risk } from '@/types';
import { FileText, Save, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function getRiskScoreColor(score: number): string {
  if (score <= 4) return 'bg-green-500/20 text-green-700 dark:text-green-400';
  if (score <= 9) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
  if (score <= 15) return 'bg-orange-500/20 text-orange-700 dark:text-orange-400';
  return 'bg-red-500/20 text-red-700 dark:text-red-400';
}

interface Props {
  project: Project;
  open: boolean;
  onClose: () => void;
}

const CHARTER_FIELDS: { key: keyof ProjectCharter; label: string; multiline?: boolean }[] = [
  { key: 'projectName', label: 'Nombre del Proyecto' },
  { key: 'projectDescription', label: 'Descripción del Proyecto', multiline: true },
  { key: 'businessCase', label: 'Caso de Negocio / Justificación', multiline: true },
  { key: 'objectives', label: 'Objetivos Medibles del Proyecto', multiline: true },
  { key: 'highLevelRequirements', label: 'Requisitos de Alto Nivel', multiline: true },
  { key: 'milestoneSummary', label: 'Resumen de Hitos del Cronograma', multiline: true },
  { key: 'budgetSummary', label: 'Resumen del Presupuesto' },
  { key: 'successCriteria', label: 'Criterios de Éxito del Proyecto', multiline: true },
  { key: 'projectManager', label: 'Gerente del Proyecto Asignado' },
  { key: 'projectManagerAuthority', label: 'Nivel de Autoridad del Gerente', multiline: true },
  { key: 'projectSponsor', label: 'Patrocinador del Proyecto' },
  { key: 'assumptions', label: 'Supuestos', multiline: true },
  { key: 'constraints', label: 'Restricciones', multiline: true },
  { key: 'keyStakeholders', label: 'Stakeholders Clave', multiline: true },
];

export default function ProjectCharterModal({ project, open, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [charter, setCharter] = useState<Partial<ProjectCharter>>({});
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Verificar si el usuario es propietario del proyecto
  const isOwner = user && (project.ownerId === user.id || (project.owners && project.owners.includes(user.id)));

  useEffect(() => {
    if (!open || !project.id) return;

    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const [existingCharter, projectRisks] = await Promise.all([
          charterService.get(project.id),
          risksService.getByProject(project.id),
        ]);
        if (mounted) {
          if (existingCharter) {
            setCharter(existingCharter);
          } else {
            // Inicializar con datos del proyecto
            setCharter({
              projectName: project.name,
              projectDescription: project.description,
            });
          }
          // Ordenar riesgos por score descendente
          setRisks(projectRisks.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)));
        }
      } catch (err) {
        console.error('Error cargando acta:', err);
        if (mounted) {
          setCharter({
            projectName: project.name,
            projectDescription: project.description,
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [open, project.id, project.name, project.description]);

  const handleChange = (key: keyof ProjectCharter, value: string) => {
    setCharter(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!isOwner) {
      toast.error('Solo los propietarios pueden modificar el acta');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<ProjectCharter> = {
        ...charter,
        projectId: project.id,
        updatedBy: user?.id,
        updatedAt: Date.now(),
      };

      if (!charter.createdAt) {
        payload.createdAt = Date.now();
        payload.createdBy = user?.id;
      }

      await charterService.save(project.id, payload);
      toast.success('Acta de constitución guardada');
      onClose();
    } catch (err) {
      console.error('Error guardando acta:', err);
      toast.error('Error al guardar el acta');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Acta de Constitución del Proyecto</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {!isOwner && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
                  Solo los propietarios del proyecto pueden editar el acta de constitución.
                </div>
              )}

              {CHARTER_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="text-sm font-medium mb-1.5 block">{field.label}</label>
                  {field.multiline ? (
                    <textarea
                      value={(charter[field.key] as string) || ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      disabled={!isOwner}
                      rows={3}
                      className="w-full rounded-lg border-2 border-border bg-input px-3 py-2 text-sm disabled:opacity-60"
                      placeholder={`Ingrese ${field.label.toLowerCase()}...`}
                    />
                  ) : (
                    <Input
                      value={(charter[field.key] as string) || ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      disabled={!isOwner}
                      placeholder={`Ingrese ${field.label.toLowerCase()}...`}
                    />
                  )}
                </div>
              ))}

              {/* Sección de Riesgos de Alto Nivel */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Riesgos de Alto Nivel
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onClose(); navigate(`/risks/${project.id}`); }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Matriz Completa
                  </Button>
                </div>
                
                {risks.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-center">
                    No hay riesgos identificados para este proyecto.
                    <br />
                    <span className="text-xs">Haz clic en "Ver Matriz Completa" para agregar riesgos.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left px-3 py-2 font-medium">Riesgo</th>
                          <th className="text-center px-3 py-2 font-medium">Score</th>
                          <th className="text-left px-3 py-2 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {risks.slice(0, 5).map(risk => (
                          <tr key={risk.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2">
                              <div className="font-medium">{risk.title}</div>
                              {risk.description && (
                                <div className="text-xs text-muted-foreground line-clamp-1">{risk.description}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskScoreColor(risk.riskScore)}`}>
                                {risk.riskScore}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">
                              {risk.status === 'identified' && 'Identificado'}
                              {risk.status === 'analyzing' && 'En Análisis'}
                              {risk.status === 'planned' && 'Planificado'}
                              {risk.status === 'in-progress' && 'En Progreso'}
                              {risk.status === 'resolved' && 'Resuelto'}
                              {risk.status === 'closed' && 'Cerrado'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {risks.length > 5 && (
                      <div className="text-xs text-center py-2 text-muted-foreground bg-muted/30">
                        +{risks.length - 5} riesgos más. Ver matriz completa para detalles.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {charter.createdAt && (
                <div className="text-xs text-muted-foreground pt-4 border-t">
                  Creado: {new Date(charter.createdAt).toLocaleDateString('es-MX', { dateStyle: 'long' })}
                  {charter.updatedAt && charter.updatedAt !== charter.createdAt && (
                    <> · Última modificación: {new Date(charter.updatedAt).toLocaleDateString('es-MX', { dateStyle: 'long' })}</>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>

        <div className="flex-shrink-0 flex justify-end gap-3 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {isOwner && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Acta'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );

  return createPortal(modal, document.body);
}
