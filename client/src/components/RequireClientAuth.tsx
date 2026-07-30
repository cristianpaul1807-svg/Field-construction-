import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";

export function RequireClientAuth({ children }: { children: ReactNode }) {
  const { session, loading, persona } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> Cargando sesión...
      </div>
    );
  }

  if (!session) return <Redirect to="/" />;
  if (persona === "business") return <Redirect to="/" />;
  if (persona === "none") return <Redirect to="/cliente/acceso" />;

  return <>{children}</>;
}
