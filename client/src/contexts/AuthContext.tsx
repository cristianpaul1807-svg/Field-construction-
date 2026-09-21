import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch, readJson } from "@/lib/api";
import { anuncioDeFallo } from "@/lib/fallos";
import type { Area } from "@shared/permisos";
import { accesoDe, planDe, type Plan } from "@shared/planes";

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
  /** Las áreas que esta persona ve, o `null` si las ve todas. */
  areas: Area[] | null;
  /** El plan del negocio. Decide qué partes existen, no quién las ve. */
  plan: Plan;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  subscriptionPeriodEnd: string | null;
  /** Compatibilidad con la pantalla de suscripción existente en main. */
  acceso: "activo" | "prueba" | "bloqueado";
  pruebaHasta: string | null;
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
  const [areas, setAreas] = useState<Area[] | null>(null);
  // Nace en `pilot`, que lo abre todo. Mientras `/auth/me` no conteste, esconder
  // el menú a medias sería peor que enseñarlo entero un segundo.
  const [plan, setPlan] = useState<Plan>("pilot");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [subscriptionPeriodEnd, setSubscriptionPeriodEnd] = useState<string | null>(null);
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
        setPersonaError(anuncioDeFallo(res.status, body).mensaje);
        return;
      }
      const body = await readJson(res);
      setPersona(body.persona);
      setAreas(Array.isArray(body.areas) ? body.areas : null);
      setPlan(planDe(body.plan));
      setSubscriptionStatus(body.subscriptionStatus ?? null);
      setTrialEndsAt(body.trialEndsAt ?? null);
      setSubscriptionPeriodEnd(body.subscriptionPeriodEnd ?? null);
      setPersonaError(null);
      setBusinessId(body.businessId ?? null);
      setClientId(body.clientId ?? null);
    } catch (err) {
      setPersona(null);
      setPersonaError(anuncioDeFallo(0, null).mensaje);
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
        setSubscriptionStatus(null);
        setTrialEndsAt(null);
        setSubscriptionPeriodEnd(null);
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

  // La misma función que usa el servidor para bloquear. Esto era un ternario
  // aparte que no miraba `trial_ends_at` ni el plan `pilot`: enseñaba «activo»
  // a una prueba vencida y «bloqueado» a un impago que Stripe todavía estaba
  // reintentando. Dos reglas para lo mismo siempre acaban discrepando, y la
  // forma de discrepar aquí es la peor: el panel abre lo que la API niega.
  const acceso: AuthState["acceso"] = accesoDe({
    plan,
    estadoSuscripcion: subscriptionStatus,
    pruebaHasta: trialEndsAt,
  });

  return (
    <AuthContext.Provider
      value={{ session, loading, persona, personaError, areas, plan, subscriptionStatus, trialEndsAt, subscriptionPeriodEnd, acceso, pruebaHasta: trialEndsAt, businessId, clientId, refreshPersona: loadPersona, signOut }}
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
