import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, readJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Billing = "month" | "year";

type Plan = {
  key: "chantier" | "entreprise";
  label: string;
  description: string;
  monthly: { priceId: string; amount: string; detail: string };
  yearly: { priceId: string; amount: string; detail: string };
  features: string[];
};

const plans: Plan[] = [
  {
    key: "chantier",
    label: "Chantier",
    description: "Para gestionar tu actividad y tu equipo de obra desde un solo lugar.",
    monthly: { priceId: "price_1UGhMxCoxo1rqCJcc3GAVUcV", amount: "99 CAD", detail: "por mes" },
    yearly: { priceId: "price_1UGhMxCoxo1rqCJcN60TxdoV", amount: "990 CAD", detail: "por año · 2 meses gratis" },
    features: ["Cuenta principal del negocio", "Proyectos, presupuestos y facturas", "Acceso para trabajadores y clientes"],
  },
  {
    key: "entreprise",
    label: "Entreprise",
    description: "Para empresas que necesitan roles, usuarios de oficina y más control operativo.",
    monthly: { priceId: "price_1UGhMoCoxo1rqCJcwQwwJPvw", amount: "249 CAD", detail: "por mes" },
    yearly: { priceId: "price_1UGhMoCoxo1rqCJcmVnHAMMn", amount: "2.490 CAD", detail: "por año · 2 meses gratis" },
    features: ["Todo lo incluido en Chantier", "Usuarios de oficina y roles", "Gestión avanzada del equipo"],
  },
];

export default function Subscription() {
  const { subscriptionStatus, trialEndsAt, subscriptionPeriodEnd } = useAuth();
  const [, navigate] = useLocation();
  const [billing, setBilling] = useState<Billing>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (priceId: string) => {
    setBusy(priceId);
    setError(null);
    try {
      const response = await apiFetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const body = await readJson<{ url?: string; error?: string }>(response);
      if (!response.ok || !body.url) throw new Error(body.error ?? "No se pudo abrir el pago");
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el pago");
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl">Elige tu suscripción</CardTitle>
            <p className="text-sm text-muted-foreground">Activa el plan que corresponde a la forma en que trabajas.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>Estado actual: <strong>{subscriptionStatus ?? "sin suscripción"}</strong></p>
            {trialEndsAt && <p className="text-sm text-muted-foreground">La prueba termina el {new Date(trialEndsAt).toLocaleDateString()}.</p>}
            {subscriptionPeriodEnd && <p className="text-sm text-muted-foreground">Próxima renovación: {new Date(subscriptionPeriodEnd).toLocaleDateString()}.</p>}
            <p className="text-sm text-muted-foreground">El acceso se activa únicamente cuando Stripe confirma el pago.</p>
            {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <div className="mx-auto flex w-fit rounded-full border bg-background p-1 shadow-sm" role="tablist" aria-label="Periodicidad de pago">
          <button type="button" role="tab" aria-selected={billing === "month"} onClick={() => setBilling("month")} className={`rounded-full px-5 py-2 text-sm font-medium transition ${billing === "month" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
            Mensual
          </button>
          <button type="button" role="tab" aria-selected={billing === "year"} onClick={() => setBilling("year")} className={`rounded-full px-5 py-2 text-sm font-medium transition ${billing === "year" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
            Anual <span className="ml-1 text-xs opacity-80">2 meses gratis</span>
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const option = billing === "month" ? plan.monthly : plan.yearly;
            return (
              <Card key={plan.key} className={plan.key === "entreprise" ? "border-primary/50 shadow-md" : ""}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{plan.label}</CardTitle>
                    {plan.key === "entreprise" && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Más completo</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-3xl font-semibold tracking-tight">{option.amount}</p>
                    <p className="text-sm text-muted-foreground">{option.detail}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-primary">✓</span><span>{feature}</span></li>)}
                  </ul>
                  <Button className="w-full" disabled={busy !== null} onClick={() => checkout(option.priceId)}>
                    {busy === option.priceId ? "Abriendo pago…" : `Elegir ${plan.label}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Button variant="ghost" onClick={() => navigate("/")}>Volver</Button>
      </div>
    </main>
  );
}
