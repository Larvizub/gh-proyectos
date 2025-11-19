import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { User as FirebaseUser, signInWithPopup, signInWithRedirect, OAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { Database } from "firebase/database";
import { auth, functions, getDatabaseForSite, SiteKey, DATABASE_URLS } from "@/config/firebase";
import { httpsCallable } from 'firebase/functions';
import { User } from "@/types";
import { rolesService, Role } from '@/services/firebase.service';
import { ref, get, set, update as dbUpdate, onValue, off } from 'firebase/database';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithMicrosoft: (site: SiteKey) => Promise<void>;
  selectedSite: SiteKey;
  database: Database;
  signOut: () => Promise<void>;
  hasModulePermission: (moduleKey: string, action: 'observe' | 'interact') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [roleDoc, setRoleDoc] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<SiteKey>(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("selectedSite") : null;
    return (s as SiteKey) || "CORPORATIVO";
  });

  const database = useMemo(() => getDatabaseForSite(selectedSite), [selectedSite]);

  useEffect(() => {
    let userListenerUnsub: (() => void) | null = null;
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        console.log("Firebase user authenticated:", fbUser.uid);
        if (!mounted) return;
        setFirebaseUser(fbUser);
        
        // ESTRATEGIA: Primero intentar leer el email correcto desde la base de datos
        // Si el usuario ya inició sesión antes, su email normalizado está guardado
        let normalizedEmail = fbUser.email || "";
        const currentSite = (typeof window !== 'undefined' && localStorage.getItem('selectedSite')) as SiteKey | null || selectedSite;
        
        try {
          const dbToRead = getDatabaseForSite(currentSite);
          const userRef = ref(dbToRead, `users/${fbUser.uid}`);
          const userSnap = await get(userRef);
          
          if (userSnap.exists()) {
            const existingUser = userSnap.val();
            // Si ya existe el usuario con email válido (no UPN), usarlo
            if (existingUser?.email && !existingUser.email.includes('#ext#')) {
              normalizedEmail = existingUser.email;
              console.log('[onAuthStateChanged] Using existing email from DB:', normalizedEmail);
            } else {
              console.log('[onAuthStateChanged] Existing user has UPN email, will normalize');
            }
          } else {
            console.log('[onAuthStateChanged] User does not exist in DB yet');
          }
        } catch (err) {
          console.warn('[onAuthStateChanged] Failed to read user from DB:', err);
        }
        
        // Si el email sigue siendo un UPN, normalizarlo
        if (normalizedEmail.includes('#ext#')) {
          console.log('[onAuthStateChanged] Detected guest UPN, normalizing:', normalizedEmail);
          // Reconstruir desde el UPN: luis.arvizu_costaricacc.com#ext#@... -> luis.arvizu@costaricacc.com
          const marker = '#ext#';
          const upnLower = normalizedEmail.toLowerCase();
          const prefix = upnLower.split(marker)[0];
          const lastUnderscore = prefix.lastIndexOf('_');
          if (lastUnderscore > 0) {
            const local = prefix.slice(0, lastUnderscore);
            const domain = prefix.slice(lastUnderscore + 1);
            if (domain.includes('.')) {
              normalizedEmail = `${local}@${domain}`;
              console.log('[onAuthStateChanged] Reconstructed from UPN:', normalizedEmail);
            }
          }
        }
        
        const userData: User = {
          id: fbUser.uid,
          email: normalizedEmail,
          displayName: fbUser.displayName || normalizedEmail.split("@")[0] || "Usuario",
          photoURL: fbUser.photoURL || undefined,
          // Default local role (UI only) — persisted payloads must exclude this
          // field so we do not overwrite an existing server-side assignment.
          role: 'user',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        if (!mounted) return;
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
            if (mounted) setUser(merged);
          }

          // subscribe to changes so role updates propagate to the UI
          onValue(userRef, (s) => {
            if (!mounted || !s.exists()) return;
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
        if (mounted) {
          setFirebaseUser(null);
          setUser(null);
        }
      }
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
      try { unsubscribe(); } catch (e) {}
      try { if (userListenerUnsub) userListenerUnsub(); } catch (e) {}
    };
  }, [selectedSite]);

  // Load role document for current user if role is a roleId (not 'admin'|'user')
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const roleKey = user?.role as string | undefined;
        if (!roleKey || roleKey === 'admin' || roleKey === 'user') {
          if (mounted) setRoleDoc(null);
          return;
        }
        const r = await rolesService.get(roleKey);
        if (mounted) setRoleDoc(r);
      } catch (err) {
        if (mounted) setRoleDoc(null);
      }
    })();
    return () => { mounted = false; };
  }, [user?.role, selectedSite]);

  function hasModulePermission(moduleKey: string, action: 'observe' | 'interact') {
    if (user?.role === 'admin') return true;
    if (roleDoc) {
      const mods = roleDoc.modules || {};
      if (!mods[moduleKey]) return false;
      return Boolean(mods[moduleKey][action]);
    }
    // Legacy behavior: if no role doc, allow (preserve current app behavior)
    return true;
  }

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
          console.log('[normalizeEmailFromGraph] Input:', {
            mail: profile?.mail,
            userPrincipalName: profile?.userPrincipalName,
            otherMails: profile?.otherMails,
            firebaseEmail,
          });

          // 1. Prefer the `mail` property (standard email)
          if (profile?.mail && !profile.mail.includes('#ext#')) {
            console.log('[normalizeEmailFromGraph] Using mail property:', profile.mail);
            return profile.mail;
          }

          // 2. otherMails may contain the original external email for guest users
          if (Array.isArray(profile?.otherMails) && profile.otherMails.length > 0) {
            const otherMail = profile.otherMails[0];
            if (otherMail && !otherMail.includes('#ext#')) {
              console.log('[normalizeEmailFromGraph] Using otherMails[0]:', otherMail);
              return otherMail;
            }
          }

          const upn: string | undefined = profile?.userPrincipalName || firebaseEmail;
          if (!upn) {
            console.warn('[normalizeEmailFromGraph] No UPN found, returning empty');
            return '';
          }

          // 3. Handle guest UPNs like: local_domain#ext#@tenant.onmicrosoft.com
          const marker = '#ext#';
          const upnLower = upn.toLowerCase();
          if (upnLower.includes(marker)) {
            console.log('[normalizeEmailFromGraph] Processing guest UPN:', upnLower);
            // prefix is before '#ext#'
            const prefix = upnLower.split(marker)[0];
            // Attempt to split last '_' to recover local and domain: local_domain
            const lastUnderscore = prefix.lastIndexOf('_');
            if (lastUnderscore > 0) {
              const local = prefix.slice(0, lastUnderscore);
              const domain = prefix.slice(lastUnderscore + 1);
              if (domain.includes('.')) {
                const reconstructed = `${local}@${domain}`;
                console.log('[normalizeEmailFromGraph] Reconstructed from UPN:', reconstructed);
                return reconstructed;
              }
            }
          }

          // 4. Fallbacks: prefer firebaseEmail if present and valid
          if (firebaseEmail && !firebaseEmail.includes('#ext#')) {
            console.log('[normalizeEmailFromGraph] Using firebaseEmail fallback:', firebaseEmail);
            return firebaseEmail;
          }

          // 5. Last resort: return the UPN as-is (may not be valid email)
          console.warn('[normalizeEmailFromGraph] Returning UPN as-is (may be invalid):', upn);
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
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithMicrosoft, selectedSite, database, signOut, hasModulePermission }}>
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
