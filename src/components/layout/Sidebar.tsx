import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, FolderKanban, Users, User, LogOut, Key, Globe } from 'lucide-react';
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
];

// adminNavigationItems intentionally removed; admin submenu rendered dynamically when user is admin

export function Sidebar({ className, isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme } = useTheme();
  const isAdmin = !!(user && typeof user.role === 'string' && user.role.toLowerCase() === 'admin');
  const [adminOpen, setAdminOpen] = useState(isAdmin);

  useEffect(() => {
    if (isAdmin) setAdminOpen(true);
  }, [isAdmin]);

  const allItems = navigationItems;

  return (
    <>
      {/* Mobile drawer */}
      <div className={cn(
        'md:hidden fixed inset-0 z-50 transition-opacity duration-200',
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )} aria-hidden={!isOpen}>
        <div className={cn('absolute inset-0 bg-black/40 transition-opacity duration-200', isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')} onClick={onClose} />
        <aside className={cn('absolute left-0 top-0 h-full w-64 border-r bg-background p-3 transition-transform duration-200', isOpen ? 'translate-x-0' : '-translate-x-full')}> 
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

                {isAdmin ? (
                  <div>
                    <button type="button" onClick={() => setAdminOpen((s) => !s)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full">
                      <Users className="h-4 w-4" />
                      <span className="ml-2 whitespace-nowrap">Administración</span>
                    </button>
                    {adminOpen ? (
                      <div className="mt-2 ml-4 flex flex-col gap-1">
                        <Link to="/admin/users" className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', location.pathname === '/admin/users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
                          <User className="h-4 w-4" />
                          <span className="ml-2 whitespace-nowrap">Usuarios</span>
                        </Link>
                        <Link to="/admin/roles" className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', location.pathname === '/admin/roles' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
                          <Key className="h-4 w-4" />
                          <span className="ml-2 whitespace-nowrap">Roles</span>
                        </Link>
                          <Link to="/admin/externos" className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', location.pathname === '/admin/externos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
                            <Globe className="h-4 w-4" />
                            <span className="ml-2 whitespace-nowrap">Externos</span>
                          </Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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

            {isAdmin ? (
              <div className="mt-2">
                <button type="button" onClick={() => setAdminOpen((s: boolean) => !s)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all justify-center group-hover:justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full">
                  <Users className="h-4 w-4" />
                  <span className="ml-2 hidden group-hover:inline-block whitespace-nowrap">Administración</span>
                </button>
                {adminOpen ? (
                  <div className="mt-2 ml-2 flex flex-col gap-1">
                    <Link to="/admin/users" className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all justify-center group-hover:justify-start overflow-hidden', location.pathname === '/admin/users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
                      <User className="h-4 w-4" />
                      <span className="ml-2 hidden group-hover:inline-block whitespace-nowrap">Usuarios</span>
                    </Link>
                    <Link to="/admin/roles" className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all justify-center group-hover:justify-start overflow-hidden', location.pathname === '/admin/roles' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
                      <Key className="h-4 w-4" />
                      <span className="ml-2 hidden group-hover:inline-block whitespace-nowrap">Roles</span>
                    </Link>
                    <Link to="/admin/externos" className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all justify-center group-hover:justify-start overflow-hidden', location.pathname === '/admin/externos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
                      <Globe className="h-4 w-4" />
                      <span className="ml-2 hidden group-hover:inline-block whitespace-nowrap">Externos</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
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
