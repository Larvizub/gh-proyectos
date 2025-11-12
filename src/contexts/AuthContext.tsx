import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { User as FirebaseUser, signInWithPopup, signInWithRedirect, OAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { Database } from "firebase/database";
import { auth, functions, getDatabaseForSite, SiteKey } from "@/config/firebase";
import { httpsCallable } from 'firebase/functions';
import { User } from "@/types";
import { usersService } from '@/services/firebase.service';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithMicrosoft: (site: SiteKey) => Promise<void>;
  selectedSite: SiteKey;
  database: Database;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<SiteKey>(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("selectedSite") : null;
    return (s as SiteKey) || "CORPORATIVO";
  });

  const database = useMemo(() => getDatabaseForSite(selectedSite), [selectedSite]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        console.log("Firebase user authenticated:", fbUser.uid);
        setFirebaseUser(fbUser);
        const userData: User = {
          id: fbUser.uid,
          email: fbUser.email || "",
          displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "Usuario",
          photoURL: fbUser.photoURL || undefined,
          role: "user",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setUser(userData);

        // Persistir/actualizar usuario en la base de datos para que esté disponible en la app
        (async () => {
          try {
            const existing = await usersService.get(userData.id);
            if (!existing) {
              await usersService.create(userData);
              console.log('Usuario creado en la base de datos:', userData.id);
            } else {
              await usersService.update(userData.id, { displayName: userData.displayName, photoURL: userData.photoURL, email: userData.email });
              console.log('Usuario actualizado en la base de datos:', userData.id);
            }
          } catch (err) {
            console.warn('No se pudo persistir usuario en la base de datos', err);
          }
        })();
      } else {
        console.log("No Firebase user authenticated");
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithMicrosoft = async (site: SiteKey) => {
    try {
      const allowedDomains: Record<SiteKey, string> = {
        CORPORATIVO: "grupoheroica.com",
        CCCR: "costaricacc.com",
        CCCI: "cccartagena.com",
        CEVP: "valledelpacifico.co",
      };
      
      console.log("🔐 Login attempt - Site selected:", site);
      console.log("📋 Available domains:", allowedDomains);
      
      const expectedDomain = allowedDomains[site];
      console.log("✅ Expected domain for", site, "is:", expectedDomain);
      
      if (!expectedDomain) {
        console.error("❌ Site not found in allowedDomains:", site);
        throw new Error("Sitio desconocido");
      }
      
      // Guardar selección de sitio ANTES del login
      setSelectedSite(site);
      if (typeof window !== "undefined") {
        localStorage.setItem("selectedSite", site);
        console.log("💾 Saved selected site to localStorage:", site);
      }
      
      const provider = new OAuthProvider("microsoft.com");
      // Hint to Azure AD to prefer the expected domain/account in the chooser
      provider.setCustomParameters({ 
        tenant: import.meta.env.VITE_MSAL_TENANT_ID, 
        prompt: "select_account",
        // domain_hint and login_hint can help the Microsoft account picker suggest the right account
        domain_hint: expectedDomain,
        login_hint: `@${expectedDomain}`,
      });
      
      console.log("🚀 Attempting Microsoft sign-in with Firebase Auth for site:", site);
      let result;
      try {
        result = await signInWithPopup(auth, provider);
        console.log("✅ Microsoft login successful (popup)");
        console.log("📧 User email:", result.user.email);
      } catch (popupErr: any) {
        console.warn("⚠️ loginPopup failed, falling back to redirect:", popupErr);
        await signInWithRedirect(auth, provider);
        return;
      }
      
      // Validate server-side via callable function to ensure consistent verification
      try {
        // Ensure ID token is available and refreshed before calling the callable
        if (result?.user) {
          try {
            await result.user.getIdToken(/* forceRefresh */ true);
          } catch (tokenErr) {
            console.warn('Failed to refresh ID token after sign-in, continuing anyway', tokenErr);
          }
        }

        const validate = httpsCallable(functions, 'validateSiteAccess');
        const resp: any = await validate({ site, loginEmail: result?.user?.email });
        if (!(resp?.data?.success || resp?.success)) {
          // Unexpected: treat as rejection
          try { await firebaseSignOut(auth); } catch {};
          throw new Error('Validación de dominio fallida en servidor');
        }
        console.log('Server validation ok:', resp?.data || resp);
      } catch (err: any) {
        console.warn('Server-side site validation failed', err);
        try { await firebaseSignOut(auth); } catch {};
        const msg = err?.message || (err?.details && JSON.stringify(err.details)) || 'Dominio no autorizado para el sitio seleccionado';
        throw new Error(msg);
      }
      
      console.log("✅ User authenticated successfully with correct domain");
      toast.success("Inicio de sesión exitoso");
    } catch (error: any) {
      console.error("❌ Error signing in with Microsoft:", error);
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("popup-closed-by-user")) {
        toast.error("Inicio de sesión cancelado");
      } else if (errorMessage.includes("Dominio no autorizado")) {
        toast.error(errorMessage);
      } else {
        toast.error("Error al iniciar sesión con Microsoft. Por favor intenta de nuevo.");
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFirebaseUser(null);
      toast.success("Sesión cerrada correctamente");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithMicrosoft, selectedSite, database, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
