import { Link, useLocation } from 'react-router-dom';
import { Home, FolderKanban, Settings, Users } from 'lucide-react';
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
  const { user } = useAuth();

  const allItems = user?.role === 'admin' 
    ? [...navigationItems, ...adminNavigationItems]
    : navigationItems;

  return (
    <aside className={cn(
      'fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-background',
      className
    )}>
      <nav className="flex flex-col gap-2 p-4">
        {allItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
