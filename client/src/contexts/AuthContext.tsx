import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";

// "none" means the server positively answered that this account isn't linked
// to a business or a client yet — that's the signal to send someone into
// provisioning. It must never be inferred from a failed request: a server
// that didn't answer tells us nothing about who the user is, and treating
// that as "none" throws people with perfectly good accounts into the signup
// screen. That case is `personaError` instead.
type Persona = "business" | "client" | "none";

interface AuthState {
  session: Session | null;
  loading: boolean;
  persona: Persona | null;
  personaError: string | null;
  businessId: string | null;
  clientId: string | null;
  refreshPersona: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const loadPersona = async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (!res.ok) {
        // 401 is the one failure that really does mean "this session is no
        // longer valid" — everything else (5xx, a cold start, a proxy hiccup)
        // is the server's problem, not a statement about the account.
        const body = await res.json().catch(() => null);
        if (res.status === 401) {
          setPersona(null);
          setPersonaError(null);
          await supabase.auth.signOut();
          return;
        }
        setPersona(null);
        setPersonaError(body?.error || `HTTP ${res.status}`);
        return;
      }
      const body = await res.json();
      setPersona(body.persona);
      setPersonaError(null);
      setBusinessId(body.businessId ?? null);
      setClientId(body.clientId ?? null);
    } catch (err) {
      setPersona(null);
      setPersonaError(err instanceof Error ? err.message : "No se pudo contactar con el servidor");
    }
  };

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session) await loadPersona();
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadPersona();
      } else {
        setPersona(null);
        setPersonaError(null);
        setBusinessId(null);
        setClientId(null);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, loading, persona, personaError, businessId, clientId, refreshPersona: loadPersona, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
