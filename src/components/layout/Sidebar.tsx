import { Link, useLocation } from 'react-router-dom';
import { Home, FolderKanban, Settings, Users, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  className?: string;
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
];

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const allItems = user?.role === 'admin'
    ? [...navigationItems, ...adminNavigationItems]
    : navigationItems;

  return (
    // `group` permite usar utility `group-hover` en elementos hijos para
    // mostrar/ocultar los textos cuando la barra se expande al pasar el cursor.
    // Cambiamos de `fixed` a `sticky` para que la sidebar forme parte del
    // flujo y el contenido principal pueda adaptarse dinámicamente al ancho.
    <aside className={cn(
      'group sticky top-16 h-[calc(100vh-4rem)] w-16 hover:w-64 border-r bg-background transition-all duration-200 overflow-hidden flex-none',
      className
    )}>
      <nav className="flex h-full flex-col justify-between p-2">
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
                  // Centrar icono en estado colapsado; al hacer hover del padre
                  // (group) la clase group-hover:justify-start hará que el texto se muestre
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

        {/* Zona de usuario en la parte inferior */}
        <div className="mt-4 flex flex-col gap-2 p-2">
          {user ? (
            <>
              {/* Usar las mismas utilidades que los links de navegación para asegurar tamaño/alineación iguales */}
              <Link
                to="/profile"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all justify-center group-hover:justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Perfil"
              >
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 hidden opacity-0 transition-opacity duration-200 group-hover:inline-block group-hover:opacity-100 whitespace-nowrap">
                  {user.displayName}
                </span>
              </Link>

              <button
                type="button"
                onClick={signOut}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all justify-center group-hover:justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 hidden opacity-0 transition-opacity duration-200 group-hover:inline-block group-hover:opacity-100 whitespace-nowrap">
                  Cerrar sesión
                </span>
              </button>
            </>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}
