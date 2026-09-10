import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * El mes de un vistazo, para saber qué días hay algo.
 *
 * Hasta ahora sólo se podía mirar un día y avanzar de uno en uno: para
 * responder "¿tengo algo el jueves que viene?" había que pulsar la flecha ocho
 * veces. Aquí el mes entero se ve de golpe, los días con trabajo llevan su
 * marca, y al pulsar uno se entra en él.
 *
 * La semana empieza en domingo porque así lo hace el resto del producto y así
 * es la convención en Canadá, que es el mercado.
 */

export interface DiaMarcado {
  /** Cuántas cosas hay ese día. Cero no se marca. */
  cuantas: number;
}

/** La clave de un día, en su huso horario local y no en UTC: un evento a las
 *  22:00 de Montreal es del día 30, no del 31. */
export function claveDia(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function inicioDeSemana(fecha: Date) {
  const d = new Date(fecha);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function mismoDia(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function MonthGrid({
  mes,
  seleccionado,
  marcas,
  onElegir,
}: {
  /** Cualquier fecha dentro del mes que se quiere pintar. */
  mes: Date;
  seleccionado: Date;
  marcas: Map<string, DiaMarcado>;
  onElegir: (fecha: Date) => void;
}) {
  const { t, i18n } = useTranslation();
  const hoy = new Date();

  // Seis semanas fijas para que la rejilla no cambie de alto al pasar de mes,
  // que es lo que hace saltar el contenido de debajo bajo el dedo.
  const semanas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const arranque = inicioDeSemana(primero);
    return Array.from({ length: 6 }, (_, s) =>
      Array.from({ length: 7 }, (_, d) => {
        const f = new Date(arranque);
        f.setDate(arranque.getDate() + s * 7 + d);
        return f;
      })
    );
  }, [mes]);

  // Las iniciales de los días salen del idioma, no de una lista escrita a mano.
  const iniciales = useMemo(() => {
    const base = inicioDeSemana(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const f = new Date(base);
      f.setDate(base.getDate() + i);
      return f.toLocaleDateString(i18n.language, { weekday: "narrow" });
    });
  }, [i18n.language]);

  return (
    <div className="rounded-xl border border-border bg-card p-2 sm:p-3">
      <div className="grid grid-cols-7 mb-1">
        {iniciales.map((inicial, i) => (
          <div key={i} className="text-center text-[11px] font-medium text-muted-foreground py-1">
            {inicial}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {semanas.flat().map((fecha) => {
          const deEsteMes = fecha.getMonth() === mes.getMonth();
          const esHoy = mismoDia(fecha, hoy);
          const esElElegido = mismoDia(fecha, seleccionado);
          const marca = marcas.get(claveDia(fecha));

          return (
            <button
              key={fecha.toISOString()}
              onClick={() => onElegir(fecha)}
              aria-label={`${fecha.toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" })}${
                marca ? ` — ${t("scheduling.countThatDay", { count: marca.cuantas })}` : ""
              }`}
              aria-current={esElElegido ? "date" : undefined}
              className={cn(
                "relative min-h-11 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors",
                esElElegido ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                !deEsteMes && !esElElegido && "text-muted-foreground/50"
              )}
            >
              <span
                className={cn(
                  "text-sm leading-none",
                  esHoy && !esElElegido && "font-bold text-primary",
                  esElElegido && "font-semibold"
                )}
              >
                {fecha.getDate()}
              </span>

              {/* La marca del día con trabajo. Una sola cuando hay una cosa, y
                  hasta tres puntos cuando hay más: al planificar la semana, un
                  día con cuatro visitas no es lo mismo que uno con una, y esa
                  diferencia es justo la que se busca de un vistazo. */}
              <span className="flex items-center gap-0.5 h-1">
                {marca
                  ? Array.from({ length: Math.min(marca.cuantas, 3) }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-1 h-1 rounded-full",
                          esElElegido ? "bg-primary-foreground" : "bg-primary"
                        )}
                      />
                    ))
                  : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
