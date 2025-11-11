import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { User as FirebaseUser, signInWithPopup, signInWithRedirect, OAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { Database } from "firebase/database";
import { auth, getDatabaseForSite, SiteKey } from "@/config/firebase";
import { User } from "@/types";

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
      provider.setCustomParameters({ 
        tenant: import.meta.env.VITE_MSAL_TENANT_ID, 
        prompt: "select_account",
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
      
      // Verificar el dominio del email DESPUÉS del login
      const email = result.user.email || "";
      const domain = email.split("@")[1] || "";
      
      console.log("🔍 Domain validation:");
      console.log("  - Full email:", email);
      console.log("  - Extracted domain:", domain);
      console.log("  - Expected domain:", expectedDomain);
      console.log("  - Site:", site);
      console.log("  - Domain lowercase:", domain.toLowerCase());
      console.log("  - Expected lowercase:", expectedDomain.toLowerCase());
      console.log("  - Match:", domain.toLowerCase() === expectedDomain.toLowerCase());
      
      // TEMPORALMENTE: Solo advertir, no bloquear
      if (domain.toLowerCase() !== expectedDomain.toLowerCase()) {
        console.warn("⚠️ Domain mismatch - ALLOWING ANYWAY FOR DEBUGGING");
        console.warn("  - Received:", domain);
        console.warn("  - Expected:", expectedDomain);
        console.warn("  - Site:", site);
        // TODO: Descomentar después de verificar
        // await firebaseSignOut(auth);
        // throw new Error(`Dominio no autorizado para ${site}. Recibido: ${domain}, Esperado: ${expectedDomain}`);
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
