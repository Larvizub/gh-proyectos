import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
  onToggleSidebar?: () => void;
}

export function Header({ className, onToggleSidebar }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={cn(
      // `sticky` es suficiente para ser un ancestro posicionado para el botón
      'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      className
    )}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4 pl-2 md:pl-6">
          <button onClick={onToggleSidebar} className="md:hidden p-2 rounded hover:bg-muted mr-2" aria-label="Abrir menú">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          {/* Logo + title on desktop */}
          <img
            src="https://costaricacc.com/cccr/Logoheroica.png"
            alt="Heroica Logo"
            className="hidden md:inline-block h-8 w-auto mr-2"
            style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : undefined }}
          />
          <h1 className="text-xl font-bold text-primary pl-1 md:pl-0">
            Gestión de Proyectos
          </h1>
        </div>

        {/* Mantener espacio a la derecha en la barra, el botón real se posiciona
            de forma absoluta en la esquina superior derecha para cumplir el
            requerimiento. */}
        <div className="flex items-center gap-4" />

        {/* Botón de tema en la esquina superior derecha */}
        <div className="absolute right-4 top-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
