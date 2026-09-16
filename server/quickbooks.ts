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

/**
 * La conexión murió del otro lado.
 *
 * Pasa cuando alguien la desconecta desde QuickBooks (Apps → Disconnect) o
 * cuando el token de refresco caduca por estar cien días sin usarse. Tiene su
 * propio tipo porque la respuesta es distinta: no es «falló el envío», es «hay
 * que volver a conectar», y si no se distingue, la pantalla sigue diciendo que
 * está conectada mientras todo falla.
 */
export class QuickBooksDesconectadoAlla extends Error {
  readonly code = "quickbooks_reconnect_needed";
  constructor() {
    super("QuickBooks ya no acepta esta conexión. Hay que volver a conectarla.");
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

/**
 * Las direcciones de Intuit, preguntadas a Intuit.
 *
 * Estaban escritas aquí a mano y funcionaban — hoy siguen siendo estas dos.
 * El problema es el día que no lo sean: la conexión dejaría de ir y el fallo
 * diría cualquier cosa menos que han movido una dirección.
 *
 * Intuit publica un documento con las suyas, que es lo que se lee ahora. Las
 * constantes se quedan como red: si el documento no contesta —y esto corre en
 * mitad de un inicio de sesión, con una persona esperando— se usa lo último
 * que sabíamos en vez de no dejar conectar.
 */
const POR_DEFECTO = {
  autorizar: "https://appcenter.intuit.com/connect/oauth2",
  token: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
  revocar: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
};

const DESCUBRIMIENTO: Record<EntornoQuickBooks, string> = {
  production: "https://developer.api.intuit.com/.well-known/openid_configuration",
  sandbox: "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration",
};

type Direcciones = typeof POR_DEFECTO;
const UN_DIA = 24 * 60 * 60 * 1000;
const recordadas = new Map<EntornoQuickBooks, { cuando: number; cuales: Direcciones }>();

async function direcciones(): Promise<Direcciones> {
  const { entorno } = configuracion();
  const guardadas = recordadas.get(entorno);
  if (guardadas && Date.now() - guardadas.cuando < UN_DIA) return guardadas.cuales;

  try {
    const res = await fetch(DESCUBRIMIENTO[entorno], { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const d = (await res.json()) as Record<string, unknown>;
    const cuales: Direcciones = {
      autorizar: typeof d.authorization_endpoint === "string" ? d.authorization_endpoint : POR_DEFECTO.autorizar,
      token: typeof d.token_endpoint === "string" ? d.token_endpoint : POR_DEFECTO.token,
      revocar: typeof d.revocation_endpoint === "string" ? d.revocation_endpoint : POR_DEFECTO.revocar,
    };
    recordadas.set(entorno, { cuando: Date.now(), cuales });
    return cuales;
  } catch {
    return POR_DEFECTO;
  }
}

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
  return `${(await direcciones()).autorizar}?${params.toString()}`;
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
  const res = await fetch((await direcciones()).token, {
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

  let token: RespuestaDeToken;
  try {
    token = await pedirToken(
      new URLSearchParams({ grant_type: "refresh_token", refresh_token: conexion.refresh_token })
    );
  } catch (err) {
    // `invalid_grant` es Intuit diciendo que ese refresco ya no vale. Guardar
    // una conexión muerta es peor que no tener ninguna: la pantalla dice que
    // está conectada, cada envío falla con un motivo distinto, y nadie sabe
    // que lo único que hay que hacer es volver a pulsar Conectar.
    if (err instanceof Error && /invalid_grant/i.test(err.message)) {
      await admin.from("quickbooks_connections").delete().eq("business_id", businessId);
      throw new QuickBooksDesconectadoAlla();
    }
    throw err;
  }

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

/** Lo que se arregla volviendo a intentarlo dentro de un momento. */
const PASAJEROS = new Set([429, 500, 502, 503, 504]);

/** Una llamada a la API de QuickBooks de ese negocio. */
export async function llamar<T = unknown>(
  admin: Admin,
  businessId: string,
  ruta: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const conexion = await tokenVivo(admin, businessId);
  const url = `${baseDeApi(conexion.environment)}/v3/company/${conexion.realm_id}/${ruta}`;

  // Hasta tres intentos, y sólo para lo que se arregla esperando: un 429 es
  // Intuit pidiendo que bajemos el ritmo y un 503 es un mal minuto suyo.
  // Reintentar un 400 sería repetir el mismo error tres veces y tardar el
  // triple en decirlo.
  for (let intento = 0; ; intento++) {
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
    if (res.ok) return (texto ? JSON.parse(texto) : {}) as T;

    if (PASAJEROS.has(res.status) && intento < 2) {
      await new Promise((seguir) => setTimeout(seguir, 500 * 2 ** intento));
      continue;
    }

    // El `intuit_tid` identifica esta llamada en los registros de Intuit. Es
    // lo primero que piden cuando les escribes, y sin guardarlo aquí ya no hay
    // forma de saberlo: la respuesta se pierde en cuanto se lee.
    const tid = res.headers.get("intuit_tid");
    throw new Error(
      `QuickBooks ${res.status} en ${ruta}: ${texto.slice(0, 300)}${tid ? ` [intuit_tid ${tid}]` : ""}`
    );
  }
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
  /**
   * Si en pruebas se deja conectar igualmente.
   *
   * Mientras Intuit no apruebe la app, la pantalla enseña la integración como
   * lo que es —hecha y esperando permiso— y no deja pulsar: un contratista que
   * conecta su contabilidad de verdad contra un servidor de pruebas se queda
   * con una conexión que parece buena y no manda nada.
   *
   * Pero alguien tiene que poder seguir probándola, o la primera factura que
   * compruebe que la TPS y la TVQ salen bien será una de verdad, de un cliente
   * de verdad. `QUICKBOOKS_SANDBOX_CONNECT=1` abre esa puerta y no está puesta
   * en producción.
   */
  sandboxConnect: boolean;
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
    // Conectado, manda el entorno de la conexión: se puede estar enganchado a
    // una empresa de pruebas con el servidor en producción, y eso hay que
    // decirlo. Sin conexión, el que vale es el del servidor — es el que va a
    // tener la conexión siguiente.
    //
    // Antes esto era `null` a secas, y por eso al desconectar desaparecía el
    // aviso de «esto todavía es de pruebas» justo cuando hacía falta: delante
    // del botón de conectar.
    environment: (data?.environment as EntornoQuickBooks) ?? (configured ? configuracion().entorno : null),
    connectedAt: data?.connected_at ?? null,
    refreshExpiresAt: data?.refresh_expires_at ?? null,
    sandboxConnect: process.env.QUICKBOOKS_SANDBOX_CONNECT?.trim() === "1",
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
  // Se le retira el permiso a Intuit, no sólo a nosotros.
  //
  // Antes esto borraba nuestra fila y ya. El token seguía vivo al otro lado
  // hasta caducar solo, así que «desconectado» aquí y «esta app tiene acceso a
  // tu contabilidad» allí convivían durante meses. Nuestra propia política de
  // privacidad dice que la conexión se borra; borrar sólo nuestra mitad no es
  // eso.
  const { data } = await admin
    .from("quickbooks_connections")
    .select("refresh_token")
    .eq("business_id", businessId)
    .maybeSingle();

  if (data?.refresh_token) {
    try {
      const { clientId, clientSecret } = configuracion();
      await fetch((await direcciones()).revocar, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ token: data.refresh_token }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // Que Intuit no conteste no puede dejar a nadie atado a una conexión que
      // quiere quitarse. Se borra igual: la nuestra desaparece seguro, y la
      // suya caduca sola.
    }
  }

  await admin.from("quickbooks_connections").delete().eq("business_id", businessId);
}
