import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";

export function RequireBusinessAuth({ children }: { children: ReactNode }) {
  const { session, loading, persona } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> Cargando sesión...
      </div>
    );
  }

  if (!session) return <Redirect to="/" />;
  if (persona === "client") return <Redirect to="/portal" />;
  if (persona === "none") return <Redirect to="/negocio/acceso" />;

  return <>{children}</>;
}
