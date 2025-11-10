import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      className
    )}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src="https://costaricacc.com/cccr/Logoheroica.png" 
            alt="Logo" 
            className={cn(
              "h-10 w-auto transition-all",
              theme === 'dark' && "brightness-0 invert"
            )}
          />
          <h1 className="text-xl font-bold text-primary">
            Gestión de Proyectos
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {user.displayName}
              </span>
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName} 
                  className="h-8 w-8 rounded-full"
                />
              )}
            </div>
          )}

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

          {user && (
            <Button
              variant="outline"
              onClick={signOut}
            >
              Cerrar sesión
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
