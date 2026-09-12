import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { LifeBuoy, ChevronDown, ChevronLeft, RotateCcw, ArrowRight, Bot, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useNombresDelMenu } from "@/lib/nombresDelMenu";
import { ARBOL_DE_AYUDA, seccionSegunRuta, type SeccionDeAyuda, type TemaDeAyuda } from "./arbolDeAyuda";

/** Dónde está la conversación ahora mismo. */
type Paso =
  | { tipo: "secciones" }
  | { tipo: "temas"; seccion: SeccionDeAyuda }
  | { tipo: "respuesta"; seccion: SeccionDeAyuda; tema: TemaDeAyuda };

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
  const [ruta, navegar] = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [camino, setCamino] = useState<Paso[]>([{ tipo: "secciones" }]);
  const finRef = useRef<HTMLDivElement>(null);

  const paso = camino[camino.length - 1];

  // Las respuestas dicen «{{menuCampo}} → {{menuRegistro}}» y aquí se
  // rellenan con el nombre que esa pantalla tiene de verdad en este idioma.
  const menu = useNombresDelMenu();

  // La sección de la pantalla en la que está, para ofrecerla primero. Quien
  // pide ayuda desde Facturación pregunta por facturas.
  const suya = useMemo(() => seccionSegunRuta(ruta), [ruta]);

  const secciones = useMemo(() => {
    if (!suya) return ARBOL_DE_AYUDA;
    return [suya, ...ARBOL_DE_AYUDA.filter((s) => s.id !== suya.id)];
  }, [suya]);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: "end" });
  }, [camino, abierto]);

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
                      {tema.nota && (
                        <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">
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
              </Opciones>
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
