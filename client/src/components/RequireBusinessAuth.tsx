import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { Spinner } from "@/components/ui/spinner";

export function RequireBusinessAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session, loading, persona, personaError } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("auth.loadingSession")}
      </div>
    );
  }

  if (!session) return <Redirect to="/" />;
  // A server that didn't answer says nothing about this account — never let
  // that fall through to the provisioning redirect below.
  if (personaError) return <ServerUnreachable message={personaError} />;
  if (persona === "client") return <Redirect to="/portal" />;
  if (persona === "none") return <Redirect to="/negocio/acceso" />;

  return <>{children}</>;
}
