/**
 * El envío de correo, por HTTP contra Resend.
 *
 * Sin librería a propósito. El SDK de Resend haría exactamente esta petición y
 * a cambio añadiría una dependencia al lockfile, que es una construcción más
 * lenta y una cosa más que mantener. Son veinte líneas.
 *
 * Dos reglas que importan más que el envío en sí:
 *
 * 1. **Nunca revienta lo que estaba haciendo el usuario.** Generar un código
 *    de acceso tiene que funcionar aunque el correo no salga. El fallo se
 *    devuelve, no se lanza, y quien llama decide si dice algo.
 * 2. **Sin clave configurada no es un error.** Una instalación puede no tener
 *    correo —la nuestra estuvo así meses— y eso no puede llenar los registros
 *    de excepciones ni romper una pantalla.
 */

export type ResultadoDeCorreo =
  | { estado: "enviado"; id: string }
  | { estado: "sin_configurar" }
  | { estado: "fallo"; motivo: string };

/**
 * De quién salen los correos.
 *
 * El dominio tiene que estar verificado en Resend o la API los rechaza. Se
 * deja en una variable porque cambia con el despliegue, no con el código.
 */
function remitente(): string {
  return process.env.RESEND_FROM?.trim() || "no-reply@logiciel-construction.com";
}

/**
 * A quién contesta el cliente cuando le da a «Responder».
 *
 * Un correo sobre una obra que nace de `no-reply@` obliga a su cliente a
 * buscar el teléfono del contratista en otra parte. Si el negocio tiene correo,
 * la respuesta va a él.
 */
function conNombre(nombre: string | null | undefined, direccion: string): string {
  const limpio = (nombre ?? "").replace(/["\\<>]/g, "").trim();
  return limpio ? `${limpio} <${direccion}>` : direccion;
}

export async function enviarCorreo(mensaje: {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  /** El negocio, para que el correo salga a su nombre y no al nuestro. */
  deParteDe?: string | null;
  responderA?: string | null;
  /** El documento, para que no tenga que entrar a ninguna parte a buscarlo. */
  adjuntos?: { nombre: string; contenido: Buffer }[];
}): Promise<ResultadoDeCorreo> {
  const clave = process.env.RESEND_API_KEY?.trim();
  if (!clave) return { estado: "sin_configurar" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: conNombre(mensaje.deParteDe, remitente()),
        to: [mensaje.para],
        subject: mensaje.asunto,
        html: mensaje.html,
        // Va siempre, no sólo por cortesía: un correo sin versión en texto
        // puntúa peor en los filtros de spam, y este lleva un código que
        // tiene que llegar.
        text: mensaje.texto,
        ...(mensaje.responderA ? { reply_to: mensaje.responderA } : {}),
        ...(mensaje.adjuntos?.length
          ? {
              attachments: mensaje.adjuntos.map((a) => ({
                filename: a.nombre,
                content: a.contenido.toString("base64"),
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => "");
      return { estado: "fallo", motivo: `${res.status} ${cuerpo.slice(0, 200)}` };
    }
    const datos = (await res.json()) as { id?: string };
    return { estado: "enviado", id: datos.id ?? "" };
  } catch (err) {
    return { estado: "fallo", motivo: err instanceof Error ? err.message : String(err) };
  }
}

/** Escapar antes de meter nada de la base en el HTML del correo. */
export function esc(valor: string | null | undefined): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * La plantilla, una sola para todos los correos.
 *
 * Nada de CSS externo ni de flex: los clientes de correo llevan diez años sin
 * ponerse de acuerdo y Outlook sigue renderizando con Word. Tabla, estilos
 * en línea y ancho fijo es lo que se ve igual en todas partes.
 */
export function plantilla(partes: {
  titulo: string;
  cuerpo: string;
  negocio: string;
  logoUrl?: string | null;
  pie: string;
}): string {
  const cabecera = partes.logoUrl
    ? `<img src="${esc(partes.logoUrl)}" alt="${esc(partes.negocio)}" width="56" height="56"
         style="display:block;border-radius:8px;object-fit:cover;border:1px solid #e5e5e5">`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px">
        <tr><td style="padding:28px 28px 0">${cabecera}</td></tr>
        <tr><td style="padding:18px 28px 0">
          <h1 style="margin:0;font-size:19px;line-height:1.3;font-weight:600">${esc(partes.titulo)}</h1>
        </td></tr>
        <tr><td style="padding:12px 28px 28px;font-size:15px;line-height:1.6">${partes.cuerpo}</td></tr>
      </table>
      <p style="max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.5;color:#777">${esc(partes.pie)}</p>
    </td></tr>
  </table>
</body></html>`;
}
