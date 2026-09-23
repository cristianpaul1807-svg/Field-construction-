import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { LifeBuoy, ChevronDown, ChevronLeft, RotateCcw, ArrowRight, Bot, UserRound, Check } from "lucide-react";
import { apiFetch, readJson } from "@/lib/api";
import { correoDeSoporte } from "@/lib/soporte";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useNombresDelMenu } from "@/lib/nombresDelMenu";
import { ARBOL_DE_AYUDA, seccionSegunRuta, type SeccionDeAyuda, type TemaDeAyuda } from "./arbolDeAyuda";
import { EVENTO_AYUDA, registrarAyuda, type PeticionDeAyuda } from "@/lib/abrirAyuda";
import { useAuth } from "@/contexts/AuthContext";
import { puede } from "@shared/permisos";

/** Dónde está la conversación ahora mismo. */
type Paso =
  | { tipo: "secciones" }
  | { tipo: "temas"; seccion: SeccionDeAyuda }
  | { tipo: "respuesta"; seccion: SeccionDeAyuda; tema: TemaDeAyuda }
  | { tipo: "ticket"; seccion: SeccionDeAyuda; tema: TemaDeAyuda };

/**
 * El bot de ayuda del panel.
 *
 * Ocupa el sitio donde antes había una barra que decía "pídele algo al
 * asistente del negocio" y, contestaras lo que contestaras, respondía que
 * todavía no estaba conectada a ningún modelo — en castellano fijo y hablando
 * de fases internas y de claves de API. Era el control más visible del panel,
 * está en todas las pantallas, y lo único que hacía era enseñarle a la gente
 * que preguntar no sirve.
 *
 * Esto sí contesta. Es un árbol de botones, sin modelo detrás: siempre da la
 * misma respuesta, no se inventa nada, funciona igual de rápido en una obra
 * con una raya de cobertura y no cuesta por pregunta. Para "¿dónde se pone el
 * número de TVQ?" eso es exactamente lo que hace falta.
 */
export function BotDeAyuda() {
  const { t } = useTranslation();
  const { areas } = useAuth();
  const [ruta, navegar] = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [camino, setCamino] = useState<Paso[]>([{ tipo: "secciones" }]);
  const finRef = useRef<HTMLDivElement>(null);

  const paso = camino[camino.length - 1];

  // Las respuestas dicen «{{menuCampo}} → {{menuRegistro}}» y aquí se
  // rellenan con el nombre que esa pantalla tiene de verdad en este idioma.
  const menu = useNombresDelMenu();

  // El mismo mapa de áreas que protege las pantallas decide qué ayuda existe
  // para esta persona. `null` significa administrador sin rol restringido.
  const seccionesPermitidas = useMemo(
    () => ARBOL_DE_AYUDA.filter((seccion) => !seccion.areas || seccion.areas.some((area) => puede(areas, area))),
    [areas],
  );

  // La sección de la pantalla en la que está, para ofrecerla primero. Quien
  // pide ayuda desde Facturación pregunta por facturas, pero nunca se prioriza
  // una sección que el rol no puede consultar.
  const suya = useMemo(() => {
    const seccion = seccionSegunRuta(ruta);
    return seccion && seccionesPermitidas.some((visible) => visible.id === seccion.id) ? seccion : null;
  }, [ruta, seccionesPermitidas]);

  const secciones = useMemo(() => {
    if (!suya) return seccionesPermitidas;
    return [suya, ...seccionesPermitidas.filter((s) => s.id !== suya.id)];
  }, [seccionesPermitidas, suya]);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: "end" });
  }, [camino, abierto]);

  // Quien avisa de un fallo ofrece preguntar aquí, y llega ya colocado en la
  // respuesta que toca. Que el aviso tenga salida es la mitad del aviso: leer
  // que algo falló sin nada que hacer después es donde la gente se cae.
  useEffect(() => registrarAyuda(), []);

  useEffect(() => {
    const atender = (e: Event) => {
      const { seccion, tema } = (e as CustomEvent<PeticionDeAyuda>).detail ?? {};
      setAbierto(true);
      const s = seccionesPermitidas.find((x) => x.id === seccion);
      if (!s) return setCamino([{ tipo: "secciones" }]);
      const x = s.temas.find((y) => y.id === tema);
      setCamino(x ? [{ tipo: "secciones" }, { tipo: "temas", seccion: s }, { tipo: "respuesta", seccion: s, tema: x }] : [{ tipo: "secciones" }, { tipo: "temas", seccion: s }]);
    };
    window.addEventListener(EVENTO_AYUDA, atender);
    return () => window.removeEventListener(EVENTO_AYUDA, atender);
  }, [seccionesPermitidas]);

  const atras = () => setCamino((c) => (c.length > 1 ? c.slice(0, -1) : c));
  const reiniciar = () => setCamino([{ tipo: "secciones" }]);

  const tituloSeccion = (s: SeccionDeAyuda) => t(`help.section.${s.id}`);
  const tituloTema = (s: SeccionDeAyuda, x: TemaDeAyuda) => t(`help.topic.${s.id}.${x.id}.title`);

  /** Una burbuja del bot. */
  const Bot_ = ({ children }: { children: React.ReactNode }) => (
    <div className="flex gap-2 justify-start">
      <div className="w-6 h-6 rounded-full bg-status-info-bg flex items-center justify-center flex-shrink-0">
        <Bot size={12} className="text-status-info-fg" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary text-foreground px-3 py-2 text-sm space-y-2">
        {children}
      </div>
    </div>
  );

  /** Lo que eligió la persona, para que la conversación se lea como tal. */
  const Suyo = ({ children }: { children: React.ReactNode }) => (
    <div className="flex gap-2 justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm">
        {children}
      </div>
      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
        <UserRound size={12} />
      </div>
    </div>
  );

  const Opciones = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-wrap gap-2 pl-8">{children}</div>
  );

  const Opcion = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="text-left text-sm rounded-full border border-border bg-card px-3 py-1.5 text-foreground hover:bg-secondary hover:border-primary/40 transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div className="sticky bottom-0 z-30 flex-shrink-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-safe px-safe">
      {abierto && (
        <div className="absolute bottom-full left-0 right-0 max-h-[26rem] flex flex-col border-t border-border bg-card shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <LifeBuoy size={14} strokeWidth={1.75} className="text-muted-foreground" />
              {t("help.title")}
            </div>
            <div className="flex items-center gap-1">
              {camino.length > 1 && (
                <>
                  <button
                    onClick={atras}
                    aria-label={t("help.back")}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={reiniciar}
                    aria-label={t("help.restart")}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => setAbierto(false)}
                aria-label={t("common.close")}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <Bot_>
              <p>{t("help.intro")}</p>
            </Bot_>

            {/* El recorrido hecho hasta aquí, para que se vea de dónde viene
                y el botón de atrás signifique algo. */}
            {camino.map((p, i) => {
              if (p.tipo === "temas") {
                return (
                  <div key={`t-${i}`} className="space-y-3">
                    <Suyo>{tituloSeccion(p.seccion)}</Suyo>
                    <Bot_>
                      <p>{t("help.pickTopic", { section: tituloSeccion(p.seccion) })}</p>
                    </Bot_>
                  </div>
                );
              }
              if (p.tipo === "respuesta") {
                const { seccion, tema } = p;
                const base = `help.topic.${seccion.id}.${tema.id}`;
                return (
                  <div key={`r-${i}`} className="space-y-3">
                    <Suyo>{tituloTema(seccion, tema)}</Suyo>
                    <Bot_>
                      {Array.from({ length: tema.parrafos }, (_, n) => (
                        <p key={n}>{t(`${base}.p${n + 1}`, menu)}</p>
                      ))}
                      {/* La nota se lee igual de grande que el resto.

                          Iba en `text-xs` y en gris apagado, dos escalones por
                          debajo del cuerpo, como si fuera una aclaración
                          menor. No lo es: es donde vive lo que te muerde. «Una
                          tarjeta de verdad no pasa por mucho que completes el
                          alta», «lo que cobres desde la app de Stripe no llega
                          aquí solo» — lo más caro de cada respuesta estaba en
                          la letra más pequeña de la pantalla, leída a pleno
                          sol en una obra. La raya de la izquierda ya dice que
                          es un aparte; no hacía falta además esconderla. */}
                      {tema.nota && (
                        <p className="text-sm text-foreground border-l-2 border-border pl-2.5">
                          {t(`${base}.nota`, menu)}
                        </p>
                      )}
                    </Bot_>
                  </div>
                );
              }
              return null;
            })}

            {/* Y lo que toca elegir ahora. */}
            {paso.tipo === "secciones" && (
              <>
                <Bot_>
                  <p>{t("help.pickSection")}</p>
                </Bot_>
                <Opciones>
                  {secciones.map((s) => (
                    <Opcion key={s.id} onClick={() => setCamino((c) => [...c, { tipo: "temas", seccion: s }])}>
                      {tituloSeccion(s)}
                      {suya?.id === s.id && (
                        <span className="ml-1.5 text-xs text-muted-foreground">{t("help.thisScreen")}</span>
                      )}
                    </Opcion>
                  ))}
                </Opciones>
              </>
            )}

            {paso.tipo === "temas" && (
              <Opciones>
                {paso.seccion.temas.map((x) => (
                  <Opcion
                    key={x.id}
                    onClick={() => setCamino((c) => [...c, { tipo: "respuesta", seccion: paso.seccion, tema: x }])}
                  >
                    {tituloTema(paso.seccion, x)}
                  </Opcion>
                ))}
              </Opciones>
            )}

            {paso.tipo === "respuesta" && (
              <Opciones>
                {/* Explicar dónde está algo y no llevarte es media respuesta. */}
                {paso.tema.ruta && (
                  <Opcion
                    onClick={() => {
                      navegar(paso.tema.ruta!);
                      setAbierto(false);
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                      {t("help.goThere")} <ArrowRight size={13} />
                    </span>
                  </Opcion>
                )}
                <Opcion onClick={atras}>{t("help.otherQuestion")}</Opcion>
                <Opcion onClick={reiniciar}>{t("help.restart")}</Opcion>
                {/* La última salida, y la última a propósito: el árbol
                    contesta al instante y un correo tarda un día. Ofrecerlo
                    antes de haber intentado responder sería cambiar una
                    respuesta inmediata por una espera. */}
                <Opcion
                  onClick={() => setCamino((c) => [...c, { tipo: "ticket", seccion: paso.seccion, tema: paso.tema }])}
                >
                  <span className="text-muted-foreground">{t("help.notSolved")}</span>
                </Opcion>
              </Opciones>
            )}

            {paso.tipo === "ticket" && (
              <Ticket
                pantalla={ruta}
                tema={`${paso.seccion.id}.${paso.tema.id}`}
                onAtras={atras}
                onReiniciar={reiniciar}
              />
            )}

            <div ref={finRef} />
          </div>
        </div>
      )}

      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
        aria-expanded={abierto}
      >
        <LifeBuoy size={16} strokeWidth={1.75} className="text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-sm text-muted-foreground">{t("help.openHelp")}</span>
      </button>
    </div>
  );
}

/**
 * El ticket, cuando el árbol no llega.
 *
 * Va con la pantalla y el tema que se acababa de leer. Eso es la diferencia
 * entre contestar a la primera y tres correos preguntando dónde estaba —
 * tres correos que paga alguien que mientras tanto no puede facturar.
 *
 * Si no se pudo mandar, **lo escrito se queda en la caja**. Perder lo que
 * alguien acaba de teclear cuando ya venía enfadado es la forma más rápida de
 * que no vuelva a escribir nunca.
 */
function Ticket({
  pantalla,
  tema,
  onAtras,
  onReiniciar,
}: {
  pantalla: string;
  tema: string;
  onAtras: () => void;
  onReiniciar: () => void;
}) {
  const { t } = useTranslation();
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"escribiendo" | "mandando" | "hecho" | "fallo">("escribiendo");
  const [buzon, setBuzon] = useState<string | null>(null);

  async function mandar() {
    if (!mensaje.trim()) return;
    setEstado("mandando");
    try {
      const res = await apiFetch("/api/soporte/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje, pantalla, tema }),
      });
      const cuerpo = await readJson<{ ok?: boolean }>(res);
      if (cuerpo.ok) {
        setEstado("hecho");
        return;
      }
      setEstado("fallo");
      // Sólo cuando ha fallado: ofrecer el buzón antes es invitar a saltarse
      // el camino que sí llega con el contexto puesto.
      setBuzon(await correoDeSoporte());
    } catch {
      setEstado("fallo");
      setBuzon(await correoDeSoporte());
    }
  }

  if (estado === "hecho") {
    return (
      <div className="space-y-3">
        <div className="flex gap-2 justify-start">
          <div className="w-6 h-6 rounded-full bg-status-success-bg flex items-center justify-center flex-shrink-0">
            <Check size={12} className="text-status-success-fg" />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm">
            {t("help.ticketSent")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-8">
          <button
            onClick={onReiniciar}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-secondary"
          >
            {t("help.restart")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pl-8">
      <p className="text-xs text-muted-foreground leading-snug">{t("help.ticketIntro")}</p>
      <textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        placeholder={t("help.ticketPlaceholder")}
        rows={3}
        maxLength={4000}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-y"
      />
      {estado === "fallo" && (
        <p className="text-xs text-status-danger-fg leading-snug">
          {t("help.ticketFailed")}
          {buzon && (
            <>
              {" "}
              {t("help.ticketWriteTo")}{" "}
              <a href={`mailto:${buzon}`} className="underline font-medium">
                {buzon}
              </a>
            </>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void mandar()}
          disabled={!mensaje.trim() || estado === "mandando"}
          className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {estado === "mandando" ? t("help.ticketSending") : t("help.ticketSend")}
        </button>
        <button
          onClick={onAtras}
          className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-secondary"
        >
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}
