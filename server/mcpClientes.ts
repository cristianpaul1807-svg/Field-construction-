/**
 * Qué Client ID hay que darle a quien va a conectar.
 *
 * Claude no abre la pantalla de autorización con la URL sola: pide también el
 * Client ID que tenemos registrado para él. El panel del negocio ya lo
 * enseñaba; la app del trabajador no, así que sus tres pasos estaban
 * incompletos y no había forma de terminarlos.
 *
 * ## Por qué esto no vive en la ruta
 *
 * Porque lo necesitan dos pantallas distintas —la del contratista y la del
 * trabajador— y la regla de «cuál es el bueno» no es obvia: hay registros
 * sueltos de otras plataformas que apuntan al callback de Claude, y ésos no
 * valen. Escrita dos veces, el día que se corrija en un sitio la otra pantalla
 * sigue dando el identificador equivocado y nadie se entera hasta que alguien
 * no puede conectar.
 */

import { getSupabaseAdmin } from "./supabaseAdmin";

type Admin = ReturnType<typeof getSupabaseAdmin>;

export interface ClienteOAuth {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
  createdAt: string;
  proveedor: "claude" | "chatgpt" | "manus" | "other";
  /** Si se puede repartir. Ver `esValido`. */
  valido: boolean;
}

/** De quién es este registro, por lo que dice de sí mismo. */
function proveedorDe(nombre: string, clientId: string): ClienteOAuth["proveedor"] {
  const texto = `${nombre} ${clientId}`.toLowerCase();
  if (texto.includes("claude") || texto.includes("anthropic")) return "claude";
  if (texto.includes("chatgpt") || texto.includes("openai")) return "chatgpt";
  if (texto.includes("manus")) return "manus";
  return "other";
}

/**
 * Si un registro se puede repartir.
 *
 * Lo que descarta es un caso concreto y real: un registro que dice ser de otra
 * plataforma y lleva el callback de Claude. Eso es un alta mal hecha, y dar
 * ese Client ID manda a la persona a una autorización que no vuelve.
 */
function esValido(cliente: { proveedor: ClienteOAuth["proveedor"]; redirectUris: string[] }): boolean {
  const vuelveAClaude = cliente.redirectUris.some((uri) => uri.includes("claude.ai"));
  return cliente.proveedor === "claude" || !vuelveAClaude;
}

export async function clientesOAuth(admin: Admin): Promise<ClienteOAuth[]> {
  const { data, error } = await admin
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris, token_endpoint_auth_method, created_at")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;

  return (data ?? []).map((fila) => {
    const redirectUris = (fila.redirect_uris ?? []) as string[];
    const proveedor = proveedorDe(fila.client_name, fila.client_id);
    return {
      clientId: fila.client_id,
      clientName: fila.client_name,
      redirectUris,
      tokenEndpointAuthMethod: fila.token_endpoint_auth_method,
      createdAt: fila.created_at,
      proveedor,
      valido: esValido({ proveedor, redirectUris }),
    };
  });
}

/**
 * El Client ID que se le da a alguien para conectar Claude, o `null`.
 *
 * `null` no es un fallo: significa que todavía no hay ninguno registrado, y la
 * pantalla tiene que decirlo en vez de enseñar un hueco. Repartir los pasos
 * sin el identificador es mandar a alguien a una puerta que no abre.
 */
export async function clientIdDeClaude(admin: Admin): Promise<string | null> {
  const clientes = await clientesOAuth(admin);
  return clientes.find((cliente) => cliente.proveedor === "claude" && cliente.valido)?.clientId ?? null;
}
