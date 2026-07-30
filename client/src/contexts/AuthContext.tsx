import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";

type Persona = "business" | "client" | "none";

interface AuthState {
  session: Session | null;
  loading: boolean;
  persona: Persona | null;
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
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const loadPersona = async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (!res.ok) {
        setPersona("none");
        return;
      }
      const body = await res.json();
      setPersona(body.persona);
      setBusinessId(body.businessId ?? null);
      setClientId(body.clientId ?? null);
    } catch {
      setPersona("none");
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
      value={{ session, loading, persona, businessId, clientId, refreshPersona: loadPersona, signOut }}
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
