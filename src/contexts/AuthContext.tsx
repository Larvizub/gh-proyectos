import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { User as FirebaseUser, signInWithPopup, signInWithRedirect, OAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { Database } from "firebase/database";
import { auth, functions, getDatabaseForSite, SiteKey, DATABASE_URLS } from "@/config/firebase";
import { httpsCallable } from 'firebase/functions';
import { User } from "@/types";
import { ref, get, set, update as dbUpdate, onValue, off } from 'firebase/database';

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
    let userListenerUnsub: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        console.log("Firebase user authenticated:", fbUser.uid);
        setFirebaseUser(fbUser);
        const userData: User = {
          id: fbUser.uid,
          email: fbUser.email || "",
          displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "Usuario",
          photoURL: fbUser.photoURL || undefined,
          // Default local role (UI only) — persisted payloads must exclude this
          // field so we do not overwrite an existing server-side assignment.
          role: 'user',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setUser(userData);

        // Persistir/actualizar usuario en la base de datos para que esté disponible en la app
        (async () => {
          try {
            // Resolve current site (read localStorage to avoid stale closures)
            const currentSite = (typeof window !== 'undefined' && localStorage.getItem('selectedSite')) as SiteKey | null || selectedSite;
            const dbUrl = DATABASE_URLS[currentSite];
            const upsertUserFn = httpsCallable(functions, 'upsertUser');

            // sanitize userData: replace undefined photoURL with null
            const payloadUser: any = { ...userData };
            if (payloadUser.photoURL === undefined) payloadUser.photoURL = null;
            // Ensure we do NOT send the local default role to the server so existing
            // server-side assignments are preserved.
            if (payloadUser.hasOwnProperty('role')) delete payloadUser.role;

            await upsertUserFn({ site: currentSite, dbUrl, user: payloadUser });
            console.log('Usuario enviado a upsertUser callable:', userData.id);
          } catch (err) {
            console.warn('No se pudo persistir usuario en la base de datos via callable, intentando fallback cliente', err);
            // Fallback: attempt client-side write but ensure no undefined values
            try {
              const currentSite = (typeof window !== 'undefined' && localStorage.getItem('selectedSite')) as SiteKey | null || selectedSite;
              const dbToUse = getDatabaseForSite(currentSite);
              const userRef = ref(dbToUse, `users/${userData.id}`);
              const payload: any = { ...userData };
              if (payload.photoURL === undefined) payload.photoURL = null;
              if (payload.hasOwnProperty('role')) delete payload.role;
              const snap = await get(userRef);
              if (!snap.exists()) {
                await set(userRef, payload);
                console.log('Usuario creado (fallback cliente):', userData.id);
              } else {
                await dbUpdate(userRef, { displayName: payload.displayName, photoURL: payload.photoURL, email: payload.email, updatedAt: Date.now() });
                console.log('Usuario actualizado (fallback cliente):', userData.id);
              }
            } catch (clientErr) {
              console.warn('Fallback cliente falló al persistir usuario', clientErr);
            }
          }
        })();

        // After attempting to persist, read the canonical user record from the selected site's DB
        try {
          // cleanup previous listener if any
          if (userListenerUnsub) {
            try { userListenerUnsub(); } catch (e) {}
            userListenerUnsub = null;
          }

          const currentSiteForListener = (typeof window !== 'undefined' && localStorage.getItem('selectedSite')) as SiteKey | null || selectedSite;
          const dbForSite = getDatabaseForSite(currentSiteForListener);
          const userRef = ref(dbForSite, `users/${fbUser.uid}`);
          // one-time fetch to update role/displayName/photoURL if present
          const snap = await get(userRef);
          if (snap.exists()) {
            const remote = snap.val();
            const merged: User = {
              ...userData,
              displayName: remote.displayName || userData.displayName,
              email: remote.email || userData.email,
              photoURL: remote.photoURL === undefined ? userData.photoURL : remote.photoURL,
              role: remote.role || userData.role,
              createdAt: remote.createdAt || userData.createdAt,
              updatedAt: remote.updatedAt || userData.updatedAt,
            };
            setUser(merged);
          }

          // subscribe to changes so role updates propagate to the UI
          onValue(userRef, (s) => {
            if (!s.exists()) return;
            const remote = s.val();
            setUser((prev) => ({
              ...(prev || userData),
              displayName: remote.displayName || (prev?.displayName || userData.displayName),
              email: remote.email || (prev?.email || userData.email),
              photoURL: remote.photoURL === undefined ? (prev?.photoURL || userData.photoURL) : remote.photoURL,
              role: remote.role || (prev?.role || userData.role),
              createdAt: remote.createdAt || (prev?.createdAt || userData.createdAt),
              updatedAt: remote.updatedAt || Date.now(),
            }));
          });
          // store unsubscriber
          userListenerUnsub = () => off(userRef);
        } catch (listenErr) {
          console.warn('AuthContext: could not read/subscribe to user record', listenErr);
        }
      } else {
        console.log("No Firebase user authenticated");
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });
    return () => {
      try { unsubscribe(); } catch (e) {}
      try { if (userListenerUnsub) userListenerUnsub(); } catch (e) {}
    };
  }, [selectedSite]);

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
      // Request Graph scopes so we can fetch richer profile info after sign-in
      try {
        provider.addScope('User.Read');
      } catch (e) {}
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

      // Attempt to fetch richer profile info from Microsoft Graph if we have an access token
      try {
        const accessToken = (result as any)?.credential?.accessToken || null;
        let graphProfile: any = null;
        if (accessToken) {
          const gRes = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (gRes.ok) graphProfile = await gRes.json();
        }

        // Build the user object with Graph data preferred
        function normalizeEmailFromGraph(profile: any, firebaseEmail?: string) {
          // Prefer the `mail` property
          if (profile?.mail) return profile.mail;
          // otherMails may contain the original external email for guest users
          if (Array.isArray(profile?.otherMails) && profile.otherMails.length > 0) return profile.otherMails[0];

          const upn: string | undefined = profile?.userPrincipalName || firebaseEmail;
          if (!upn) return '';

          // Handle guest UPNs like: local_domain#ext#@tenant.onmicrosoft.com
          const marker = '#ext#';
          const upnLower = upn.toLowerCase();
          if (upnLower.includes(marker)) {
            // prefix is before '#ext#'
            const prefix = upnLower.split(marker)[0];
            // Attempt to split last '_' to recover local and domain: local_domain
            const lastUnderscore = prefix.lastIndexOf('_');
            if (lastUnderscore > 0) {
              const local = prefix.slice(0, lastUnderscore);
              const domain = prefix.slice(lastUnderscore + 1);
              if (domain.includes('.')) {
                return `${local}@${domain}`;
              }
            }
          }

          // Fallbacks: prefer firebaseEmail if present, otherwise return the UPN as-is
          if (firebaseEmail) return firebaseEmail;
          return upn;
        }

        const finalEmail = normalizeEmailFromGraph(graphProfile, result?.user?.email || undefined) || '';
        const finalDisplayName = graphProfile?.displayName || result?.user?.displayName || (finalEmail ? finalEmail.split('@')[0] : 'Usuario');
        const finalPhoto = undefined; // could fetch /photo/$value if needed

        // Persist user record server-side via callable to ensure writes go to the correct DB and avoid client
        // Realtime DB rules or undefined-value issues.
        try {
          const uid = result.user.uid;
          const dbUrl = DATABASE_URLS[site];
          const upsertUserFn = httpsCallable(functions, 'upsertUser');
          const now = Date.now();
          const payloadUser: any = {
            id: uid,
            email: finalEmail,
            displayName: finalDisplayName,
            photoURL: finalPhoto ?? null,
            // role will be preserved by server if exists
            createdAt: now,
            updatedAt: now,
          };

          await upsertUserFn({ site, dbUrl, user: payloadUser });
          console.log('Usuario creado/actualizado via upsertUser:', uid);
        } catch (writeErr) {
          console.warn('No se pudo crear/actualizar usuario con Graph data via callable', writeErr);
          // Fallback: attempt client-side write sanitized
          try {
            const uid = result.user.uid;
            const dbForSite = getDatabaseForSite(site);
            const userRef = ref(dbForSite, `users/${uid}`);
            const now = Date.now();
            const payloadUser: any = {
              id: uid,
              email: finalEmail,
              displayName: finalDisplayName,
              photoURL: finalPhoto ?? null,
              createdAt: now,
              updatedAt: now,
            };
            const snap = await get(userRef);
            if (!snap.exists()) {
              await set(userRef, payloadUser);
              console.log('Usuario creado (fallback cliente):', uid);
            } else {
              await dbUpdate(userRef, { displayName: payloadUser.displayName, photoURL: payloadUser.photoURL, email: payloadUser.email, updatedAt: now });
              console.log('Usuario actualizado (fallback cliente):', uid);
            }
          } catch (clientErr) {
            console.warn('Fallback cliente falló al persistir usuario', clientErr);
          }
        }
      } catch (graphErr) {
        console.warn('Error fetching Microsoft Graph profile, continuing without it', graphErr);
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
