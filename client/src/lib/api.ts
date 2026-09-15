import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getClientSession } from "@/lib/clientSession";
import { anuncioDeFallo, detalleDe, fallo, FalloDelServidor } from "@/lib/fallos";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  /** El anuncio, ya en el idioma de quien mira. Es lo que se enseña. */
  error: string | null;
  /** Lo que contestó el servidor. Va plegado en el aviso, no en la frase. */
  detalle: string | null;
  /** Re-runs the request. Screens that write call this after a mutation. */
  reload: () => void;
}

// Every business/client panel route needs the caller's Supabase session
// token attached so the Express API can resolve business_id/client_id from
// auth.uid() and run the query through an RLS-scoped client — this is the
// one place that happens, so every fetch (via useApi or apiFetch) gets it
// automatically instead of every call site remembering to add it.
async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) return { Authorization: `Bearer ${token}` };

  // No Supabase session — this may be a client who entered with the access
  // code their contractor gave them (no email, no password). The server's
  // requireClientAuth accepts either credential, so every client-portal
  // screen works through this same path without knowing which it is.
  const clientSession = getClientSession();
  return clientSession ? { Authorization: `Bearer ${clientSession.token}` } : {};
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(await authHeaders()), ...(init.headers ?? {}) };
  return fetch(path, { ...init, headers });
}

/**
 * Reads a JSON body without ever throwing. A failed request can answer with
 * an HTML error page, an empty body, or a proxy timeout — and a parse error
 * thrown here replaces the real reason with a message about JSON syntax,
 * which is how a backend outage once read as a broken Stripe button.
 */
export async function readJson<T = any>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

/**
 * El mensaje de un fallo del servidor, en el idioma de quien lo lee.
 *
 * Los mensajes del servidor estaban escritos en castellano y se enseñaban tal
 * cual: un cliente francófono pagando una factura, o un trabajador tecleando
 * mal su código, leían el fallo en español. Ahora el servidor manda un código
 * estable y aquí se traduce.
 *
 * Lo que ya no hace es enseñar el texto del servidor cuando no hay código. De
 * los 194 fallos que contesta la API, un tercio no tiene nombre todavía y su
 * texto está escrito para nosotros: «content is required», «token is required».
 * Eso no es una instrucción para nadie. El crudo no se pierde —va en el
 * `detalle` del fallo, plegado en el aviso— pero deja de ser lo que se lee.
 */
export function serverMessage(
  body: { error?: string; code?: string } | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
  fallback: string
): string {
  if (body?.code) return t(`serverErrors.${body.code}`, { defaultValue: fallback });
  return fallback;
}

/**
 * El `filename="…"` de un Content-Disposition, si viene.
 *
 * Se le quita todo lo que sea separador de carpetas: el navegador ya lo
 * sanea, pero el nombre entra desde una cabecera y no cuesta nada no
 * confiarse.
 */
function nombreDeLaCabecera(cabecera: string | null): string | null {
  if (!cabecera) return null;
  const encontrado = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(cabecera);
  const nombre = (encontrado?.[1] ?? encontrado?.[2] ?? "").trim().replace(/[/\\]/g, "");
  return nombre || null;
}

/**
 * Saves a file from an authenticated endpoint. A plain <a download> can't be
 * used for these: the bearer token lives in a header, and a link request
 * carries no headers, so the server would answer 401. Fetching the bytes and
 * handing the browser a blob URL is what makes "Download PDF" work at all.
 */
/**
 * `fetcher` existe para el trabajador: él lleva un código en localStorage y no
 * una sesión de Supabase, así que `apiFetch` no mandaría cabecera de
 * autorización ninguna y la descarga volvería 401. Quien llama desde /campo
 * pasa el suyo; el resto no toca nada.
 */
export async function downloadFile(
  path: string,
  filename: string,
  fetcher: (path: string, init?: RequestInit) => Promise<Response> = apiFetch
): Promise<void> {
  const res = await fetcher(path);
  if (!res.ok) throw await fallo(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // El nombre bueno lo sabe el servidor: es el número correlativo que lleva
  // impreso el documento, y aquí sólo se tiene el uuid. Así la factura
  // «2026-0004» se guarda como 2026-0004.pdf en vez de INV-1BE0A42A.pdf, que
  // era imposible de emparejar en la carpeta del contable. El nombre que llega
  // por parámetro queda de reserva para las descargas que no lo declaren.
  link.download = nombreDeLaCabecera(res.headers.get("content-disposition")) ?? filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers; one tick
  // is enough for the click to have been consumed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Small fetch hook — no data library in this project yet, and the app's
// data needs (a handful of read endpoints per screen) don't warrant adding one.
// Pass `null` as the path to skip fetching (e.g. while waiting on a prerequisite id).
export function useApi<T>(path: string | null): ApiState<T> {
  const [state, setState] = useState<Omit<ApiState<T>, "reload">>({
    data: null,
    loading: path !== null,
    error: null,
    detalle: null,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, loading: false, error: null, detalle: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null, detalle: null });

    apiFetch(path)
      .then(async (res) => {
        if (!res.ok) throw await fallo(res);
        return (await res.json().catch(() => null)) as T;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null, detalle: null });
      })
      .catch((err) => {
        // Una lectura que no llega es casi siempre la red o nosotros, nunca
        // algo que la persona hiciera mal: no hay respaldo que ponerle, y el
        // estado ya dice lo bastante. Lo que no llegó a haber respuesta —el
        // móvil sin cobertura en la obra— entra como estado 0, porque «Failed
        // to fetch» es exactamente el texto que no queremos enseñar.
        if (!cancelled) {
          const anuncio =
            err instanceof FalloDelServidor
              ? { mensaje: err.message, detalle: err.detalle }
              : anuncioDeFallo(0, null);
          setState({ data: null, loading: false, error: anuncio.mensaje, detalle: anuncio.detalle });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  return { ...state, reload };
}
