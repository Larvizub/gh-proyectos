import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import Select from '@/components/ui/select';
import { PageLoader } from '@/components/PageLoader';

export function LoginPage() {
  const { signInWithMicrosoft, loading, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [site, setSite] = useState<'CORPORATIVO' | 'CCCR' | 'CCCI' | 'CEVP'>(() => {
    try {
      const s = localStorage.getItem('selectedSite');
      return (s as any) || 'CORPORATIVO';
    } catch {
      return 'CORPORATIVO';
    }
  });

  // Redirigir si el usuario ya está autenticado
  useEffect(() => {
    if (user) {
      console.log('User detected, redirecting to dashboard...');
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithMicrosoft(site);
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      toast.error(error?.message || 'Error al iniciar sesión');
      setIsLoggingIn(false);
    }
  };

  if (loading || isLoggingIn) {
    return <PageLoader message="Iniciando sesión..." />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Fondo decorativo */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden" style={{ background: 'linear-gradient(135deg, #273c2a 0%, #124734 100%)' }}>
  {/* Capas de círculos: menos blur y solapamientos. Ajuste: esquinas superiores más sutiles (no 'huevos fritos') */}
  {/* Esquina superior izquierda: tonos verdes sutiles, menos halo */}
  <div className="absolute -left-20 -top-12 w-56 h-56 rounded-full bg-[#86A78A] opacity-30 blur-sm transform -rotate-6 z-10" />
  {/* removed sharp small circle to soften corner */}

  {/* Esquina superior derecha: tamaño moderado y tonos verdosos, baja opacidad */}
  <div className="absolute right-6 -top-20 w-52 h-52 rounded-full bg-[#9FBF9B] opacity-25 blur-sm transform rotate-6 z-5" />
  {/* removed sharp small circle to soften corner */}

        <div className="absolute left-1/2 bottom-20 w-96 h-96 -translate-x-1/2 rounded-full bg-[#0F5132] opacity-60 blur-sm z-0" />
        <div className="absolute left-1/3 bottom-6 w-48 h-48 rounded-full bg-[#124734] opacity-75 blur-none transform rotate-6 mix-blend-overlay z-15" />

        <div className="absolute -right-12 bottom-12 w-48 h-48 rounded-full bg-[#B0B3B2] opacity-30 blur-sm z-0" />
        <div className="absolute right-1/4 top-28 w-28 h-28 rounded-full bg-[#C9D6C1] opacity-70 blur-none transform rotate-12 mix-blend-multiply z-25" />
      </div>

      <Card className="w-full max-w-md">
          <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="https://costaricacc.com/cccr/Logoheroica.png"
              alt="Logo"
              className={`h-20 w-auto transition-all ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
            />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-extrabold">
            Gestión de Proyectos
          </CardTitle>
          <CardDescription>
            Inicia sesión con tu cuenta de Microsoft para continuar
          </CardDescription>

          <div className="mt-4">
            <Select
              id="site"
              value={site}
              onChange={(v) => setSite(v as any)}
              label="Recinto"
              helper="Selecciona el recinto para usar la base de datos y el dominio autorizados."
            >
              <option value="CORPORATIVO">CORPORATIVO</option>
              <option value="CCCR">CCCR</option>
              <option value="CCCI">CCCI</option>
              <option value="CEVP">CEVP</option>
            </Select>
            <p className="mt-2 text-sm text-muted-foreground">
              Dominio esperado para este recinto: {
                site === 'CORPORATIVO' ? 'grupoheroica.com' :
                site === 'CCCR' ? 'costaricacc.com' :
                site === 'CCCI' ? 'cccartagena.com' :
                site === 'CEVP' ? 'valledelpacifico.co' :
                ''
              }
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión con Microsoft'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
