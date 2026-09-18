import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { Spinner } from "@/components/ui/spinner";
import { recordarDestino } from "@/lib/destino";
import { areaDeLaPantalla, puede, primeraPantalla } from "@shared/permisos";
import { capacidadDeLaPantalla, tiene } from "@shared/planes";
import { SinPlan } from "@/components/SinPlan";
import { useLocation } from "wouter";

export function RequireBusinessAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session, loading, persona, personaError, areas, plan, subscriptionStatus } = useAuth();
  const [ruta] = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("auth.loadingSession")}
      </div>
    );
  }

  if (!session) {
    // Guardarlo antes de saltar: después del inicio de sesión ya no queda
    // rastro de a qué pantalla venía esta persona.
    recordarDestino(window.location.pathname);
    return <Redirect to="/" />;
  }
  // A server that didn't answer says nothing about this account — never let
  // that fall through to the provisioning redirect below.
  if (personaError) return <ServerUnreachable message={personaError} />;
  if (persona === "client") return <Redirect to="/portal" />;
  if (persona === "none") return <Redirect to="/negocio/acceso" />;

  // Una cuenta suspendida conserva únicamente la puerta de suscripción. Los
  // clientes y trabajadores tienen sus propios accesos y no pasan por aquí.
  if (subscriptionStatus && !["trialing", "active"].includes(subscriptionStatus) && ruta !== "/settings/subscription") {
    return <Redirect to="/settings/subscription" />;
  }

  // Escribir la dirección a mano tampoco entra. Se manda a la primera pantalla
  // que sí es suya en vez de a un cartel de «sin permiso»: un jefe de obra que
  // aterriza en una pantalla en blanco el primer día cree que el sistema está
  // roto, no que esa parte no es para él.
  const area = areaDeLaPantalla(ruta);
  if (area && !puede(areas, area)) return <Redirect to={primeraPantalla(areas)} />;

  // El plan no se resuelve mandando a otro sitio. A quien no tiene permiso se
  // le lleva a su pantalla porque hay otra que sí es suya; aquí la pantalla es
  // suya y lo que falta es haberla contratado, así que se le cuenta.
  const capacidad = capacidadDeLaPantalla(ruta);
  if (capacidad && !tiene(plan, capacidad)) return <SinPlan capacidad={capacidad} />;

  return <>{children}</>;
}
