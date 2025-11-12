import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Guardar si el usuario ha seleccionado manualmente un tema
  const [manual, setManual] = useState(false);

  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored) return stored;
    } catch (e) {}

    // Si no hay preferencia almacenada, usar la preferencia del sistema
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Aplicar la clase al root cada vez que cambie el tema
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    // Guardar la preferencia solo si el usuario la cambió manualmente
    try {
      if (manual) localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore
    }
  }, [theme, manual]);

  // Escuchar cambios en la preferencia del sistema solo si no hay elección manual
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function handler(e: MediaQueryListEvent) {
      if (!manual) setTheme(e.matches ? 'dark' : 'light');
    }
    // Safari usa addListener
    if ((mq as any).addEventListener) {
      mq.addEventListener('change', handler as any);
    } else {
      // @ts-ignore
      mq.addListener(handler);
    }
    return () => {
      if ((mq as any).removeEventListener) {
        mq.removeEventListener('change', handler as any);
      } else {
        // @ts-ignore
        mq.removeListener(handler);
      }
    };
  }, [manual]);

  const toggleTheme = () => {
    setManual(true);
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
