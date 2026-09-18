import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, readJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  { id: "chantier_month", label: "Chantier", price: "99 CAD / mes", priceId: "price_1UGhMxCoxo1rqCJcc3GAVUcV" },
  { id: "chantier_year", label: "Chantier", price: "99 CAD / mes, facturado anualmente", priceId: "price_1UGhMxCoxo1rqCJcN60TxdoV" },
  { id: "entreprise_month", label: "Entreprise", price: "249 CAD / mes", priceId: "price_1UGhMoCoxo1rqCJcwQwwJPvw" },
  { id: "entreprise_year", label: "Entreprise", price: "249 CAD / mes, facturado anualmente", priceId: "price_1UGhMoCoxo1rqCJcmVnHAMMn" },
];

export default function Subscription() {
  const { subscriptionStatus, trialEndsAt, subscriptionPeriodEnd } = useAuth();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (priceId: string) => {
    setBusy(priceId);
    setError(null);
    try {
      const response = await apiFetch("/api/subscription/checkout", { method: "POST", body: JSON.stringify({ priceId }) });
      const body = await readJson(response);
      if (!response.ok || !body.url) throw new Error(body.error ?? "No se pudo abrir el pago");
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el pago");
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Suscripción de logiciel-construction</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p>Estado actual: <strong>{subscriptionStatus ?? "prueba"}</strong></p>
            {trialEndsAt && <p className="text-sm text-muted-foreground">La prueba termina el {new Date(trialEndsAt).toLocaleDateString()}.</p>}
            {subscriptionPeriodEnd && <p className="text-sm text-muted-foreground">Próxima renovación: {new Date(subscriptionPeriodEnd).toLocaleDateString()}.</p>}
            <p className="text-sm text-muted-foreground">El acceso se activa únicamente cuando Stripe confirma el pago.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader><CardTitle>{plan.label}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl font-semibold">{plan.price}</p>
                <Button className="w-full" disabled={busy !== null} onClick={() => checkout(plan.priceId)}>
                  {busy === plan.priceId ? "Abriendo pago…" : "Suscribirme"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button variant="ghost" onClick={() => navigate("/")}>Volver</Button>
      </div>
    </main>
  );
}
