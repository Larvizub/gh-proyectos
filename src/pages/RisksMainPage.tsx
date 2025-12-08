import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { projectsService, risksService } from '@/services/firebase.service';
import { useAuth } from '@/contexts/AuthContext';
import { Project, Risk } from '@/types';
import { AlertTriangle, Search, FolderKanban, ChevronRight } from 'lucide-react';
import PageLoader from '@/components/PageLoader';

interface ProjectWithRisks extends Project {
  riskCount: number;
  highRiskCount: number;
  maxRiskScore: number;
}

function getRiskScoreColor(score: number): string {
  if (score <= 4) return 'bg-green-500/20 text-green-700 dark:text-green-400';
  if (score <= 9) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
  if (score <= 15) return 'bg-orange-500/20 text-orange-700 dark:text-orange-400';
  return 'bg-red-500/20 text-red-700 dark:text-red-400';
}

function getRiskLevel(score: number): string {
  if (score <= 4) return 'Bajo';
  if (score <= 9) return 'Moderado';
  if (score <= 15) return 'Alto';
  return 'Crítico';
}

export default function RisksMainPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithRisks[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    const unsubs: Array<() => void> = [];

    (async () => {
      try {
        // Obtener proyectos del usuario
        const allProjects = await projectsService.getAll();

        // Filtrar proyectos donde el usuario es miembro o propietario
        const userProjects = allProjects.filter((p: Project) => {
          const isOwner = p.ownerId === user.id || (p.owners && p.owners.includes(user.id));
          const isMember = p.memberIds && p.memberIds.includes(user.id);
          return isOwner || isMember;
        });

        // Inicializar proyectos con contadores en 0
        const baseProjects: ProjectWithRisks[] = userProjects.map((project: Project) => ({
          ...project,
          riskCount: 0,
          highRiskCount: 0,
          maxRiskScore: 0,
        }));

        if (mounted) {
          // Ordenar (aunque todos son 0) y mostrar inmediatamente
          baseProjects.sort((a, b) => b.maxRiskScore - a.maxRiskScore);
          setProjects(baseProjects);
          setLoading(false);
        }

        // Registrar listener por proyecto para mantener contadores en tiempo real
        userProjects.forEach((project: Project) => {
          const unsub = risksService.listenByProject(project.id, (risks: Risk[]) => {
            if (!mounted) return;
            try {
              const highRiskCount = risks.filter((r: Risk) => (r.riskScore || 0) >= 10).length;
              const maxRiskScore = risks.length > 0 ? Math.max(...risks.map((r: Risk) => r.riskScore || 0)) : 0;

              setProjects(prev => {
                const updated = prev.map(p => p.id === project.id ? ({
                  ...p,
                  riskCount: risks.length,
                  highRiskCount,
                  maxRiskScore,
                }) : p);
                // Mantener orden por maxRiskScore descendente
                updated.sort((a, b) => b.maxRiskScore - a.maxRiskScore);
                return updated;
              });
            } catch (err) {
              console.warn('Error processing risks for project', project.id, err);
            }
          });
          unsubs.push(unsub);
        });
      } catch (err) {
        console.error('Error loading projects:', err);
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; unsubs.forEach(u => { try { u(); } catch (e) {} }); };
  }, [user]);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <PageLoader message="Cargando proyectos..." overlay={false} />;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
          Gestión de Riesgos
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Selecciona un proyecto para ver su matriz de riesgos
        </p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar proyecto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:pt-4 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{projects.length}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Proyectos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-4 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">
              {projects.reduce((sum, p) => sum + p.riskCount, 0)}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Riesgos Totales</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-4 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold text-orange-500">
              {projects.reduce((sum, p) => sum + p.highRiskCount, 0)}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Altos/Críticos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-4 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">
              {projects.filter(p => p.riskCount === 0).length}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Sin Riesgos</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de proyectos */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchTerm ? (
              <>No se encontraron proyectos que coincidan con "{searchTerm}"</>
            ) : (
              <>No tienes proyectos asignados</>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {filteredProjects.map(project => (
            <Card 
              key={project.id} 
              className="hover:border-primary/50 transition-colors cursor-pointer overflow-hidden"
              onClick={() => navigate(`/risks/${project.id}`)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Icono del proyecto */}
                  <div 
                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: project.color || '#6366f1' }}
                  >
                    <FolderKanban className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  
                  {/* Info del proyecto */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate text-sm sm:text-base">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{project.description}</p>
                    )}
                  </div>

                  {/* Indicadores de riesgo - Desktop */}
                  <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{project.riskCount}</div>
                      <div className="text-xs text-muted-foreground">Riesgos</div>
                    </div>
                    
                    {project.maxRiskScore > 0 && (
                      <div className="text-center">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${getRiskScoreColor(project.maxRiskScore)}`}>
                          {getRiskLevel(project.maxRiskScore)}
                        </span>
                        <div className="text-xs text-muted-foreground mt-1">Máx. Nivel</div>
                      </div>
                    )}
                  </div>

                  {/* Indicadores de riesgo - Mobile */}
                  <div className="sm:hidden flex items-center gap-2 flex-shrink-0">
                    {project.riskCount > 0 ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRiskScoreColor(project.maxRiskScore)}`}>
                        {project.riskCount}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs pt-3 sm:pt-4 border-t">
        <span className="text-muted-foreground w-full sm:w-auto">Niveles:</span>
        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-green-500/20 text-green-700 dark:text-green-400">Bajo</span>
        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">Moderado</span>
        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-orange-500/20 text-orange-700 dark:text-orange-400">Alto</span>
        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-red-500/20 text-red-700 dark:text-red-400">Crítico</span>
      </div>
    </div>
  );
}
