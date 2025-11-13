import { Link, useLocation } from 'react-router-dom';
import { Home, FolderKanban, Settings, Users, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const navigationItems = [
  {
    title: 'Inicio',
    href: '/',
    icon: Home,
  },
  {
    title: 'Proyectos',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    title: 'Configuración',
    href: '/settings',
    icon: Settings,
  },
];

const adminNavigationItems = [
  {
    title: 'Administración',
    href: '/admin',
    icon: Users,
  },
  {
    title: 'Usuarios',
    href: '/admin/users',
    icon: User,
  },
];

export function Sidebar({ className, isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme } = useTheme();

  const allItems = user?.role === 'admin'
    ? [...navigationItems, ...adminNavigationItems]
    : navigationItems;

  return (
    <>
      {/* Mobile drawer */}
      <div className={cn('md:hidden', isOpen ? 'fixed inset-0 z-50' : 'hidden')}>
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <aside className={cn('absolute left-0 top-0 h-full w-64 border-r bg-background p-3') }>
          <nav className="flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="https://costaricacc.com/cccr/Logoheroica.png"
                  alt="Heroica Logo"
                  className="h-14 md:h-16 w-auto"
                  style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : undefined }}
                />
              </div>
              <div className="flex flex-col gap-2">
              {allItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} to={item.href} title={item.title} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground') } onClick={onClose}>
                    <Icon className="h-4 w-4" />
                    <span className="ml-2 whitespace-nowrap">{item.title}</span>
                  </Link>
                );
              })}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 p-2">
              {user ? (
                <>
                  <Link to="/profile" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-accent hover:text-accent-foreground" title="Perfil" onClick={onClose}>
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span className="ml-2 whitespace-nowrap">{user.displayName}</span>
                  </Link>
                  <button type="button" onClick={() => { signOut(); onClose && onClose(); }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-accent hover:text-accent-foreground" title="Cerrar sesión">
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <span className="ml-2 whitespace-nowrap">Cerrar sesión</span>
                  </button>
                </>
              ) : null}
            </div>
          </nav>
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden md:block group sticky top-16 h-[calc(100vh-4rem)] w-16 hover:w-64 border-r bg-background transition-all duration-200 overflow-hidden flex-none',
        className
      )}>
      <nav className="flex h-full flex-col justify-between p-2">
        <div>
          <div className="flex items-center gap-3 px-2 mb-3">
            {/* logo removed from desktop sidebar (header displays it) */}
          </div>
          <div className="flex flex-col gap-2">
            {allItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  title={item.title}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    'justify-center group-hover:justify-start overflow-hidden',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="ml-2 hidden opacity-0 transition-opacity duration-200 group-hover:inline-block group-hover:opacity-100 whitespace-nowrap">
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        {/* Zona de usuario en la parte inferior */}
        <div className="mt-4 flex flex-col gap-2 p-2">
          {user ? (
            <>
              {/* Desktop: show text only on expand */}
              <Link
                to="/profile"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all justify-center group-hover:justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Perfil"
              >
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 hidden group-hover:inline-block whitespace-nowrap">{user.displayName}</span>
              </Link>

              <button
                type="button"
                onClick={signOut}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all justify-center group-hover:justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 hidden group-hover:inline-block whitespace-nowrap">Cerrar sesión</span>
              </button>
            </>
          ) : null}
        </div>
      </nav>
      </aside>
    </>
  );
}
