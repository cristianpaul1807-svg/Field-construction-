import i18n from "@/i18n";
import { nombresDelMenu } from "@/lib/nombresDelMenu";

/**
 * Qué se le dice a alguien cuando algo falla.
 *
 * Hasta aquí se enseñaba lo que contestara el servidor, tal cual. Mientras
 * probábamos venía bien; en producción es lo contrario de ayudar. Lo que salía
 * en pantalla era `Request failed (500)`, `content is required` o un párrafo de
 * PostgREST sobre relaciones entre tablas — en inglés, con el nombre de una
 * columna dentro, y sin decir qué hacer. Un contratista que lee eso no tiene
 * ningún siguiente paso: ni sabe si es culpa suya, ni si perdió el trabajo que
 * acababa de escribir, ni a quién preguntar.
 *
 * Ahora hay dos textos por cada fallo. El **anuncio** es lo que se lee: una
 * frase en su idioma que dice qué pasó y qué hacer. El **detalle** es la
 * respuesta literal del servidor, que no desaparece —es lo único que sirve
 * cuando alguien nos escribe— pero va plegada, no de primeras.
 *
 * Esto vive fuera de React a propósito: `useApi` y `downloadFile` no son
 * componentes y también fallan, y tener dos formas de contar un fallo es como
 * se acaba enseñando el crudo por una de las dos.
 */

/** Lo que el servidor manda cuando algo va mal. */
export interface CuerpoDeFallo {
  error?: string;
  code?: string;
  [otras: string]: unknown;
}

export interface Anuncio {
  /** La frase que se lee. Siempre en el idioma de quien mira. */
  mensaje: string;
  /** Lo que contestó el servidor, para plegar debajo. `null` si no dijo nada. */
  detalle: string | null;
  /** El código estable, si lo traía. Sirve para decidir qué ofrecer. */
  codigo: string | null;
}

type Traductor = (key: string, opts?: Record<string, unknown>) => string;

/** El `t` de i18next cuando quien llama no es un componente. */
function traductor(): Traductor {
  return (key, opts) => i18n.t(key, opts) as string;
}

/**
 * Por qué se falla, cuando el propio servidor no lo ha dicho con un código.
 *
 * Un 500 y un 403 tienen respuestas distintas —uno es nuestro y otro es un
 * permiso— y eso el estado HTTP lo sabe aunque el cuerpo venga vacío, que es
 * justo lo que pasa cuando el que corta es un proxy y no la aplicación.
 */
function porElEstado(estado: number, t: Traductor): string | null {
  if (estado === 0) return t("errores.sinConexion");
  if (estado === 401) return t("errores.sesion");
  if (estado === 403) return t("errores.permiso");
  if (estado === 404) return t("errores.noExiste");
  if (estado === 409) return t("errores.conflicto");
  if (estado === 413) return t("errores.demasiadoGrande");
  if (estado === 429) return t("errores.demasiadasVeces");
  if (estado >= 500) return t("errores.nuestro");
  return null;
}

/**
 * El anuncio de un fallo.
 *
 * El orden importa: primero el código estable, que es el único texto escrito
 * pensando en este caso concreto; después lo que el sitio que llama sabía decir
 * («no se pudo guardar el presupuesto»), que al menos nombra lo que se estaba
 * haciendo; y sólo si no hay ninguno de los dos, el estado HTTP.
 */
export function anuncioDeFallo(
  estado: number,
  cuerpo: CuerpoDeFallo | null | undefined,
  respaldo?: string,
  t: Traductor = traductor()
): Anuncio {
  const detalle = typeof cuerpo?.error === "string" && cuerpo.error.trim() ? cuerpo.error.trim() : null;
  const codigo = typeof cuerpo?.code === "string" && cuerpo.code ? cuerpo.code : null;

  // Un código con traducción es la mejor frase que vamos a tener. Si el código
  // llega pero nadie le escribió texto todavía, seguimos bajando en vez de
  // enseñar `serverErrors.loQueSea` en pantalla.
  if (codigo) {
    // Con los nombres del menú dentro: varios de estos textos mandan a una
    // pantalla —«conéctalo en Ajustes → Pagos»— y el nombre tiene que salir
    // del menú, no copiado. Ver `lib/nombresDelMenu.ts`, que cuenta las tres
    // veces que copiarlo mandó a gente a una opción que no existía.
    const suyo = t(`serverErrors.${codigo}`, { defaultValue: "", ...nombresDelMenu((clave) => t(clave)) });
    if (suyo) return { mensaje: suyo, detalle, codigo };
  }

  // El estado gana al respaldo cuando dice algo que el respaldo no puede
  // decir: «se te caducó la sesión» es accionable y «no se pudo guardar» no.
  // Los 4xx que el estado no cubre son casi siempre una petición mal formada,
  // o sea un fallo nuestro de programación —«content is required» no es una
  // instrucción para nadie—, y ahí manda el respaldo, que al menos nombra lo
  // que se estaba intentando hacer.
  const mensaje = porElEstado(estado, t) ?? respaldo ?? t("errores.generico");
  return { mensaje, detalle, codigo };
}

/** Un `Error` que se lee solo y además se guarda el crudo. */
export class FalloDelServidor extends Error {
  readonly detalle: string | null;
  readonly codigo: string | null;
  readonly estado: number;

  constructor(anuncio: Anuncio, estado: number) {
    super(anuncio.mensaje);
    this.name = "FalloDelServidor";
    this.detalle = anuncio.detalle;
    this.codigo = anuncio.codigo;
    this.estado = estado;
  }
}

/** El detalle técnico de un error, cuando lo lleve. */
export function detalleDe(err: unknown): string | null {
  return err instanceof FalloDelServidor ? err.detalle : null;
}

/**
 * Levanta el fallo de una respuesta que no vino bien.
 *
 * Quien llama se ahorra leer el cuerpo, mirar el estado y decidir el texto, que
 * son los tres sitios donde se colaba el crudo.
 */
export async function fallo(res: Response, respaldo?: string): Promise<FalloDelServidor> {
  const cuerpo = await res.json().catch(() => null);
  return new FalloDelServidor(anuncioDeFallo(res.status, cuerpo, respaldo), res.status);
}
