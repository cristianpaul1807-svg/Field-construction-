import type { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * La conexión con QuickBooks Online.
 *
 * Aquí vive todo lo que habla con Intuit: la autorización, el refresco de los
 * tokens y las llamadas a su API. Lo que no vive aquí es qué se manda — eso lo
 * decide `api.ts`, que es quien sabe qué es una factura de este producto.
 *
 * Sin SDK a propósito. El de Intuit arrastra medio mundo por tres llamadas
 * HTTP, y las tres están documentadas y son estables.
 */

type Admin = ReturnType<typeof getSupabaseAdmin>;

export type EntornoQuickBooks = "sandbox" | "production";

export class QuickBooksNoConfigurado extends Error {
  readonly code = "quickbooks_not_configured";
  constructor() {
    super("Faltan las claves de QuickBooks en el servidor");
  }
}

export class QuickBooksSinConectar extends Error {
  readonly code = "quickbooks_not_connected";
  constructor() {
    super("Este negocio todavía no ha conectado su QuickBooks");
  }
}

/** Lo que el servidor tiene configurado. Lanza si falta algo, en vez de fallar luego. */
export function configuracion(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  entorno: EntornoQuickBooks;
} {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim();
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim();
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) throw new QuickBooksNoConfigurado();
  return {
    clientId,
    clientSecret,
    redirectUri,
    // Cualquier cosa que no sea exactamente 'production' es pruebas. Al revés
    // —dar por producción lo que no se entiende— mandaría facturas de verdad
    // desde un servidor mal configurado.
    entorno: process.env.QUICKBOOKS_ENVIRONMENT?.trim() === "production" ? "production" : "sandbox",
  };
}

export function estaConfigurado(): boolean {
  try {
    configuracion();
    return true;
  } catch {
    return false;
  }
}

/** La base de la API según el entorno. Las pruebas viven en otro dominio. */
function baseDeApi(entorno: EntornoQuickBooks): string {
  return entorno === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

const AUTORIZAR = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

/** Sólo la contabilidad. Cada permiso de más es una pregunta más en la revisión de Intuit. */
const ALCANCE = "com.intuit.quickbooks.accounting";

/**
 * La dirección a la que mandar al contratista para que autorice.
 *
 * El `state` no se firma: se guarda en la base y se borra al usarlo. Intuit
 * devuelve el navegador a nuestra dirección sin sesión ninguna, así que es lo
 * único que dice de qué negocio venía — y si se pudiera adivinar, cualquiera
 * podría colgar su QuickBooks del negocio de otro.
 */
export async function urlDeAutorizacion(admin: Admin, businessId: string): Promise<string> {
  const { clientId, redirectUri } = configuracion();

  const { data, error } = await admin
    .from("quickbooks_oauth_states")
    .insert({ business_id: businessId })
    .select("state")
    .single();
  if (error) throw error;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: ALCANCE,
    redirect_uri: redirectUri,
    state: data.state,
  });
  return `${AUTORIZAR}?${params.toString()}`;
}

interface RespuestaDeToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
}

/** El intercambio con Intuit. Las claves van en Basic, no en el cuerpo. */
async function pedirToken(cuerpo: URLSearchParams): Promise<RespuestaDeToken> {
  const { clientId, clientSecret } = configuracion();
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: cuerpo,
  });
  const texto = await res.text();
  if (!res.ok) {
    // El cuerpo de Intuit dice por qué —clave mal, dirección de vuelta que no
    // coincide, código ya usado— y sin él el fallo es indistinguible.
    throw new Error(`QuickBooks devolvió ${res.status}: ${texto.slice(0, 300)}`);
  }
  return JSON.parse(texto) as RespuestaDeToken;
}

/** Guarda la conexión recién autorizada y devuelve de qué empresa es. */
export async function completarAutorizacion(
  admin: Admin,
  args: { code: string; state: string; realmId: string }
): Promise<{ businessId: string }> {
  const { redirectUri, entorno } = configuracion();

  const { data: pendiente } = await admin
    .from("quickbooks_oauth_states")
    .select("state, business_id, created_at")
    .eq("state", args.state)
    .maybeSingle();
  if (!pendiente) throw new Error("state desconocido o ya usado");

  // Diez minutos. Autorizar lleva uno; un `state` que vive horas es un cabo
  // suelto esperando a que alguien lo encuentre.
  const edad = Date.now() - new Date(pendiente.created_at).getTime();
  await admin.from("quickbooks_oauth_states").delete().eq("state", args.state);
  if (edad > 10 * 60_000) throw new Error("la autorización caducó, vuelve a empezar");

  const token = await pedirToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: args.code,
      redirect_uri: redirectUri,
    })
  );

  const ahora = Date.now();
  const { error } = await admin.from("quickbooks_connections").upsert(
    {
      business_id: pendiente.business_id,
      realm_id: args.realmId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      access_expires_at: new Date(ahora + token.expires_in * 1000).toISOString(),
      refresh_expires_at: token.x_refresh_token_expires_in
        ? new Date(ahora + token.x_refresh_token_expires_in * 1000).toISOString()
        : null,
      environment: entorno,
      connected_at: new Date(ahora).toISOString(),
    },
    { onConflict: "business_id" }
  );
  if (error) throw error;

  return { businessId: pendiente.business_id };
}

interface Conexion {
  business_id: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  environment: EntornoQuickBooks;
}

/**
 * El token bueno de un negocio, refrescándolo si hace falta.
 *
 * Se refresca con un minuto de margen: entre que se lee y se usa puede pasar
 * medio segundo, y un token que caduca en ese hueco da un 401 que parece una
 * conexión rota cuando sólo era un reloj.
 */
async function tokenVivo(admin: Admin, businessId: string): Promise<Conexion> {
  const { data } = await admin
    .from("quickbooks_connections")
    .select("business_id, realm_id, access_token, refresh_token, access_expires_at, environment")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) throw new QuickBooksSinConectar();

  const conexion = data as Conexion;
  if (new Date(conexion.access_expires_at).getTime() - Date.now() > 60_000) return conexion;

  const token = await pedirToken(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: conexion.refresh_token })
  );

  const ahora = Date.now();
  await admin
    .from("quickbooks_connections")
    .update({
      access_token: token.access_token,
      // Intuit rota el de refresco de vez en cuando y devuelve uno nuevo.
      // Guardar el viejo rompe la conexión días después, lejos de aquí.
      refresh_token: token.refresh_token,
      access_expires_at: new Date(ahora + token.expires_in * 1000).toISOString(),
      refresh_expires_at: token.x_refresh_token_expires_in
        ? new Date(ahora + token.x_refresh_token_expires_in * 1000).toISOString()
        : null,
    })
    .eq("business_id", businessId);

  return { ...conexion, access_token: token.access_token, refresh_token: token.refresh_token };
}

/** Una llamada a la API de QuickBooks de ese negocio. */
export async function llamar<T = unknown>(
  admin: Admin,
  businessId: string,
  ruta: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const conexion = await tokenVivo(admin, businessId);
  const url = `${baseDeApi(conexion.environment)}/v3/company/${conexion.realm_id}/${ruta}`;

  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${conexion.access_token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const texto = await res.text();
  if (!res.ok) throw new Error(`QuickBooks ${res.status} en ${ruta}: ${texto.slice(0, 300)}`);
  return (texto ? JSON.parse(texto) : {}) as T;
}

/** Cómo está la conexión, sin devolver un solo token. */
export async function estado(
  admin: Admin,
  businessId: string
): Promise<{
  configured: boolean;
  connected: boolean;
  companyName: string | null;
  realmId: string | null;
  environment: EntornoQuickBooks | null;
  connectedAt: string | null;
  refreshExpiresAt: string | null;
}> {
  const configured = estaConfigurado();
  const { data } = await admin
    .from("quickbooks_connections")
    .select("realm_id, company_name, environment, connected_at, refresh_expires_at")
    .eq("business_id", businessId)
    .maybeSingle();

  return {
    configured,
    connected: Boolean(data),
    companyName: data?.company_name ?? null,
    realmId: data?.realm_id ?? null,
    environment: (data?.environment as EntornoQuickBooks) ?? null,
    connectedAt: data?.connected_at ?? null,
    refreshExpiresAt: data?.refresh_expires_at ?? null,
  };
}

/** El nombre de la empresa, para que la pantalla diga a cuál está conectado. */
export async function refrescarNombreDeEmpresa(admin: Admin, businessId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from("quickbooks_connections")
      .select("realm_id")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!data) return null;

    const info = await llamar<{ CompanyInfo?: { CompanyName?: string } }>(
      admin,
      businessId,
      `companyinfo/${data.realm_id}`
    );
    const nombre = info.CompanyInfo?.CompanyName ?? null;
    if (nombre) await admin.from("quickbooks_connections").update({ company_name: nombre }).eq("business_id", businessId);
    return nombre;
  } catch {
    // Que no sepamos el nombre no rompe la conexión: es un adorno de la
    // pantalla, no un requisito para mandar facturas.
    return null;
  }
}

export async function desconectar(admin: Admin, businessId: string): Promise<void> {
  await admin.from("quickbooks_connections").delete().eq("business_id", businessId);
}
