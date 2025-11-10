import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { msalInstance, loginRequest, ensureMsalInitialized } from '@/config/msal';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithMicrosoft: (site: SiteKey) => Promise<void>;
  selectedSite: SiteKey;
  signOut: () => Promise<void>;
}

type SiteKey = 'CORPORATIVO' | 'CCCR' | 'CCCI' | 'CEVP';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<SiteKey>(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem('selectedSite') : null;
    return (s as SiteKey) || 'CORPORATIVO';
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        // Aquí cargarías los datos adicionales del usuario desde Firebase Realtime Database
        const userData: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || undefined,
          role: 'user', // Por defecto, luego se carga desde la base de datos
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setUser(userData);
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithMicrosoft = async (site: SiteKey) => {
    try {
      // Ensure msal is initialized (some msal-browser versions require initialize())
      await ensureMsalInitialized();
      // Implementar autenticación con Microsoft Graph
      const loginResponse = await msalInstance.loginPopup(loginRequest);
      console.log('Microsoft login successful:', loginResponse);

      // Obtener correo del usuario desde la respuesta
      const email = (loginResponse.account && (loginResponse.account.username as string)) ||
        // @ts-ignore
        (loginResponse.idTokenClaims && (loginResponse.idTokenClaims.email as string));

      if (!email) {
        throw new Error('No se pudo obtener el correo del usuario desde Microsoft.');
      }

      // Validar dominio según el sitio seleccionado
      const domain = email.split('@')[1] || '';
      const allowedDomains: Record<SiteKey, string> = {
        CORPORATIVO: 'grupoheroica.com',
        CCCR: 'costaricacc.com',
        CCCI: 'cccartagena.com',
        CEVP: 'valledelpacifico.co',
      };

      const expected = allowedDomains[site];
      if (!expected) {
        throw new Error('Sitio desconocido');
      }

      if (!domain.toLowerCase().endsWith(expected.toLowerCase())) {
        throw new Error(`Dominio no autorizado para ${site}. Debes usar una cuenta @${expected}`);
      }

      // Guardar selección de sitio para que otros servicios la usen
      setSelectedSite(site);
      if (typeof window !== 'undefined') localStorage.setItem('selectedSite', site);

      // Nota: aquí sería el lugar para intercambiar tokens y autenticar en Firebase
      // actualmente dejamos la autenticación de Firebase tal cual y dependemos del listener auth.onAuthStateChanged
    } catch (error) {
      console.error('Error signing in with Microsoft:', error);
      // Improve UX for common AAD errors
      try {
        const msg = (error && (error as any).errorMessage) || (error && (error as any).message) || String(error);
        if (String(msg).includes('AADSTS900971') || String(msg).includes('No reply')) {
          // Friendly toast with actionable steps
          toast.error(
            'No reply address configured en la aplicación Azure AD. Añade la URL de respuesta (redirect URI) en Azure Portal.\n\n' +
              'Pasos rápidos:\n' +
              '1) Ve a Azure Portal > Azure Active Directory > App registrations > Tu aplicación.\n' +
              "2) En 'Authentication' añade una 'Single-page application (SPA)' redirect URI igual a: " +
              (import.meta.env.VITE_MSAL_REDIRECT_URI || window.location.origin) +
              "\n3) Guarda los cambios y vuelve a intentar iniciar sesión."
          );
        }
      } catch (e) {
        // ignore
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      try {
        await ensureMsalInitialized();
        await msalInstance.logoutPopup();
      } catch (err) {
        // If logoutPopup is not available or fails, just continue
        console.warn('MSAL logout failed or not available:', err);
      }
      setUser(null);
      setFirebaseUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithMicrosoft, signOut, selectedSite }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
