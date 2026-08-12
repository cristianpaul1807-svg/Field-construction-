import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "react-i18next";
import { getClientSession } from "@/lib/clientSession";

export function RequireClientAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session, loading, persona } = useAuth();

  // A client who entered with an access code has no Supabase session at all,
  // so that check comes first — waiting on Supabase's loading state would
  // otherwise stall a portal that doesn't depend on it.
  if (getClientSession()) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("auth.loadingSession")}
      </div>
    );
  }

  if (!session) return <Redirect to="/cliente/acceso" />;
  if (persona === "business") return <Redirect to="/" />;
  if (persona === "none") return <Redirect to="/cliente/acceso" />;

  return <>{children}</>;
}
