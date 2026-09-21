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

/**
 * Las dos direcciones de la pantalla de suscripción.
 *
 * Son dos porque el menú lleva a `/settings/subscription` y el bloqueo manda a
 * `/suscripcion`. Si el bloqueo no reconociera las dos, quien llega por el
 * menú rebotaría a la otra en bucle — que es la forma de que la única puerta
 * que le queda a alguien sea la que no se abre.
 */
const PUERTAS_DE_SUSCRIPCION = ["/suscripcion", "/settings/subscription"];

export function RequireBusinessAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session, loading, persona, personaError, areas, plan, acceso } = useAuth();
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
  //
  // Quién está suspendido lo dice `accesoDe` y no una lista de estados escrita
  // aquí: la que había no miraba la fecha de la prueba, así que los 30 días no
  // vencían nunca —`trialing` se queda escrito para siempre porque esa prueba
  // no es de Stripe y nadie viene a cerrarla—, y de paso echaba a un `pilot`
  // y a un impago que Stripe aún estaba reintentando.
  if (acceso === "bloqueado" && !PUERTAS_DE_SUSCRIPCION.includes(ruta)) {
    return <Redirect to="/suscripcion" />;
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
