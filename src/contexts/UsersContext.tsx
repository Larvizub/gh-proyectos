import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';
import { usersService } from '@/services/firebase.service';

interface UsersContextType {
  users: User[];
  usersMap: Record<string, User>;
  loading: boolean;
}

const UsersContext = createContext<UsersContextType>({
  users: [],
  usersMap: {},
  loading: true,
});

export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        const allUsers = await usersService.getAll();
        if (!mounted) return;
        
        setUsers(allUsers || []);
        
        const map: Record<string, User> = {};
        (allUsers || []).forEach((u) => {
          map[u.id] = u;
        });
        setUsersMap(map);
        setLoading(false);
      } catch (error) {
        console.warn('Failed to load users:', error);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <UsersContext.Provider value={{ users, usersMap, loading }}>
      {children}
    </UsersContext.Provider>
  );
}

export function useUsers() {
  return useContext(UsersContext);
}
