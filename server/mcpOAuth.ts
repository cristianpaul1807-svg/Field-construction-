import type { NextFunction, Request, Response, Router } from "express";
import { randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import * as fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { areasDelRol, hashToken } from "./supabaseAuth";
import { resolveOwnerIdentity, resolveWorker, type WorkerIdentity } from "./mcp";
import { accesoDe, planDe } from "../shared/planes";
import { aviso, langDelMcp, IDIOMAS_MCP, TEXTOS_MCP, type LangMcp } from "./mcpTextos";

const DEFAULT_SCOPE = "mcp:read";
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

type OAuthClient = { client_id: string; client_name: string; redirect_uris: string[]; token_endpoint_auth_method: string };
type PendingAuthorization = {
  client: OAuthClient; redirectUri: string; state: string | undefined; scope: string; resource: string; codeChallenge: string; authorizationAction: string;
  /** La misma pantalla en otro idioma, con los parámetros de OAuth intactos. */
  enlaceDeIdioma: (lang: LangMcp) => string;
};

/**
 * La dirección de esta misma autorización, en otro idioma.
 *
 * Se reconstruye entera en vez de tocar la que venía porque la pantalla
 * también se pinta al responder a un POST, y ahí no hay query que retocar. Lo
 * que no puede pasar es perder el `state` o el `code_challenge` al cambiar de
 * idioma: eso rompe la autorización y el usuario sólo ve que no funciona.
 */
function enlaceDeIdioma(accion: string, p: { client: OAuthClient; redirectUri: string; state?: string; scope: string; resource: string; codeChallenge: string }) {
  return (lang: LangMcp) => {
    const url = new URL(accion);
    url.searchParams.set("client_id", p.client.client_id);
    url.searchParams.set("redirect_uri", p.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("code_challenge", p.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("resource", p.resource);
    url.searchParams.set("scope", p.scope);
    if (p.state) url.searchParams.set("state", p.state);
    url.searchParams.set("lang", lang);
    return url.toString();
  };
}

function baseUrl(req: Request) {
  const configured = process.env.MCP_OAUTH_ISSUER?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const originalPath = req.originalUrl.split("?", 1)[0];
  const prefix = originalPath.startsWith("/api/") ? "/api" : "";
  return `${req.protocol}://${req.get("host")}${prefix}`;
}
function resourceUrl(req: Request) { return `${baseUrl(req)}/mcp`; }
function b64url(bytes: Buffer) { return bytes.toString("base64url"); }
function opaqueToken(prefix: string) { return `${prefix}_${b64url(randomBytes(32))}`; }
function sha256(value: string) { return createHash("sha256").update(value).digest("base64url"); }
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}
function redirectError(res: Response, uri: string, error: string, description: string, state?: string) {
  const url = new URL(uri); url.searchParams.set("error", error); url.searchParams.set("error_description", description); if (state) url.searchParams.set("state", state); res.redirect(302, url.toString());
}
function bodyString(req: Request, key: string) { const value = req.body?.[key]; return typeof value === "string" ? value : ""; }
function withTimeout<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} no respondió en ${milliseconds / 1000} segundos`)), milliseconds)),
  ]);
}

async function findClient(clientId: string): Promise<OAuthClient | null> {
  // Claude's recommended “published identity” sends a URL as client_id.
  // Restrict server-side fetching to Anthropic-owned origins to avoid turning
  // OAuth discovery into an SSRF primitive.
  if (/^https:\/\/(?:claude\.ai|anthropic\.com)(?:\/|$)/i.test(clientId)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(clientId, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) return null;
      const metadata = await response.json() as Partial<OAuthClient>;
      const redirectUris = Array.isArray(metadata.redirect_uris)
        ? metadata.redirect_uris.filter((uri): uri is string => typeof uri === "string")
        : [];
      if (metadata.client_id !== clientId || !metadata.client_name || !redirectUris.length) return null;
      return {
        client_id: clientId,
        client_name: String(metadata.client_name).slice(0, 120),
        redirect_uris: redirectUris,
        token_endpoint_auth_method: metadata.token_endpoint_auth_method ?? "none",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  const { data, error } = await getSupabaseAdmin().from("mcp_oauth_clients").select("client_id, client_name, redirect_uris, token_endpoint_auth_method").eq("client_id", clientId).maybeSingle();
  if (error) throw error;
  return data as OAuthClient | null;
}

async function persistCimdClient(client: OAuthClient) {
  if (!client.client_id.startsWith("https://")) return;
  const { error } = await getSupabaseAdmin().from("mcp_oauth_clients").upsert({
    client_id: client.client_id,
    client_name: client.client_name,
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method: client.token_endpoint_auth_method,
  }, { onConflict: "client_id" });
  if (error) throw error;
}

async function issueConnection(identity: WorkerIdentity, client: OAuthClient, scope: string) {
  const admin = getSupabaseAdmin();
  const column = identity.workerKind === "employee" ? "employee_id" : identity.workerKind === "subcontractor" ? "subcontractor_id" : "owner_auth_user_id";
  const clientLabel = `${client.client_id} ${client.client_name}`.toLowerCase();
  const provider = clientLabel.includes("claude") || clientLabel.includes("anthropic")
    ? "claude"
    : clientLabel.includes("chatgpt") || clientLabel.includes("openai")
      ? "chatgpt"
      : "other";
  const existing = await admin.from("mcp_connections")
    .select("id")
    .eq("business_id", identity.businessId)
    .eq(column, identity.workerId)
    .eq("provider", provider)
    .in("status", ["active", "revoked"])
    .or(`external_subject.eq.${client.client_id},external_subject.eq.${client.client_id}:${identity.workerId}`)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const { error } = await admin.from("mcp_connections").update({ status: "active", scopes: [scope], revoked_at: null }).eq("id", existing.data.id);
    if (error) throw error;
    return existing.data.id as string;
  }
  const { data, error } = await admin.from("mcp_connections").insert({
    business_id: identity.businessId, [column]: identity.workerId, provider, external_subject: `${client.client_id}:${identity.workerId}`,
    status: "active", scopes: [scope],
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function resolveOwnerCredentials(email: string, password: string): Promise<WorkerIdentity | null> {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  const anon = (process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "").replace(/\s+/g, "");
  if (!url || !anon) {
    const msg = "[MCP] Falta SUPABASE_URL o KEY en el entorno\n";
    console.error(msg); fs.appendFileSync("mcp_debug.log", msg);
    return null;
  }
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const authAttempt = auth.auth.signInWithPassword({ email: email.trim(), password });
  // Ocho segundos, por debajo de los quince de quien llama a esta función, que
  // a su vez están por debajo de los veinte del socket. La escalera importa:
  // estaban al revés —ocho fuera envolviendo diez dentro— y el de dentro no
  // podía ganar nunca, así que el aviso que salía decía «la validación del
  // propietario» cuando lo que no respondía era Supabase. Un mensaje que
  // señala al sitio equivocado cuesta más que no tener mensaje.
  const { data, error } = await withTimeout(authAttempt, 8000, "Supabase Auth");
  if (error || !data.user) {
    const msg = `[MCP] signInWithPassword falló para ${email}: ${error?.message}\n`;
    console.error(msg); fs.appendFileSync("mcp_debug.log", msg);
    return null;
  }
  const admin = getSupabaseAdmin();

  // La misma función que resolverá el token en cada llamada de Claude. Que
  // aquí se decidiera una cosa y allí otra es lo que dejaba a un segundo
  // administrador pasando el consentimiento para chocarse después contra un
  // 401 en bucle. Ver `resolveOwnerIdentity` en `server/mcp.ts`.
  const propietario = await resolveOwnerIdentity(data.user.id);
  if (propietario) return propietario;

  const [employee, subcontractor] = await Promise.all([
    admin.from("employees").select("id, business_id, name, role, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at)").eq("auth_user_id", data.user.id).maybeSingle(),
    admin.from("subcontractors").select("id, business_id, name, trade, roles(name, permissions), businesses(subscription_plan, subscription_status, trial_ends_at)").eq("auth_user_id", data.user.id).maybeSingle(),
  ]);
  const row = employee.data ?? subcontractor.data;
  if (employee.error && subcontractor.error) throw employee.error;
  if (!row) {
    const msg = `[MCP] No se encontró negocio ni perfil de trabajador para el usuario ${data.user.id} (${email})\n`;
    console.error(msg); fs.appendFileSync("mcp_debug.log", msg);
    return null;
  }
  const workerBusiness = (row as any).businesses as { subscription_plan?: string | null; subscription_status?: string | null; trial_ends_at?: string | null } | null;
  const plan = planDe(workerBusiness?.subscription_plan);
  return {
    workerId: row.id,
    workerKind: employee.data ? "employee" : "subcontractor",
    businessId: row.business_id,
    name: row.name ?? null,
    workerRole: (row as any).roles?.name ?? ((row as any).role ?? (row as any).trade ?? null),
    areas: areasDelRol((row as any).roles),
    plan,
    access: accesoDe({ plan, estadoSuscripcion: workerBusiness?.subscription_status ?? null, pruebaHasta: workerBusiness?.trial_ends_at ?? null }),
  };
}

/**
 * La pantalla donde alguien decide si deja entrar a Claude.
 *
 * Es la única del producto donde se escribe una contraseña, y la pinta el
 * servidor fuera de React y de i18next — por eso se quedó en castellano fijo
 * mientras el resto estaba en cuatro idiomas. Los textos viven en
 * `server/mcpTextos.ts` y el idioma sale del navegador de quien la abre, con
 * un selector encima por si se equivoca: quien llega aquí viene de Claude, sin
 * sesión nuestra y sin idioma elegido, así que no hay nada guardado que mirar.
 *
 * El selector son enlaces y no un desplegable con JavaScript: conserva la
 * dirección entera —que lleva el `state`, el `code_challenge` y el
 * `redirect_uri` de OAuth— cambiando sólo `lang`. Un `<select>` que reescribe
 * la página se come esos parámetros y rompe la autorización.
 */
// Exportada para que `scripts/prueba-mcp/idiomas.mjs` pueda pintarla de verdad
// y medirla. Una pantalla que sólo se comprueba leyendo el código es la que se
// queda en un idioma durante un año.
export function consentPage(pending: PendingAuthorization, lang: LangMcp, error?: string) {
  const t = TEXTOS_MCP[lang];
  const hidden = (key: string, value: string | undefined) => value ? `<input type="hidden" name="${key}" value="${esc(value)}">` : "";
  const idiomas = IDIOMAS_MCP.map((idioma) =>
    idioma.codigo === lang
      ? `<span aria-current="true">${esc(idioma.nombre)}</span>`
      : `<a href="${esc(pending.enlaceDeIdioma(idioma.codigo))}" hreflang="${idioma.codigo}">${esc(idioma.nombre)}</a>`
  ).join("");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.titulo)}</title><style>body{font-family:system-ui,sans-serif;background:#f5f5f7;color:#171717;margin:0;padding:32px}.card{max-width:440px;margin:7vh auto;background:white;border-radius:20px;padding:28px;box-shadow:0 10px 40px #0001}h1{font-size:24px;margin:0 0 8px}p{color:#555;line-height:1.5}label{font-weight:600;font-size:14px;display:block;margin:18px 0 7px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #ccc;border-radius:10px;font:inherit}.scope{background:#f5f5f7;border-radius:12px;padding:12px;margin:18px 0;font-size:14px}.section{border-top:1px solid #eee;margin-top:20px;padding-top:5px}.hint{font-size:13px;color:#666}.error{color:#a40000;background:#fff0f0;padding:10px;border-radius:10px;font-size:14px}.progress{color:#174ea6;background:#eaf2ff;padding:10px;border-radius:10px;font-size:14px;margin-top:12px}button{width:100%;border:0;border-radius:11px;padding:13px;background:#111;color:#fff;font-weight:650;font-size:15px;margin-top:20px}button:disabled{opacity:0.7}.idiomas{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;margin:0 0 18px}.idiomas a{color:#174ea6}.idiomas span[aria-current]{font-weight:650;color:#171717}</style></head><body><main class="card"><nav class="idiomas" aria-label="${esc(t.idioma)}">${idiomas}</nav><h1>${esc(t.titulo)}</h1><p>${t.intro(esc(pending.client.client_name))}</p><div class="scope">${esc(t.alcance)}</div><div id="client-error" class="error" role="alert" ${error ? "" : "hidden"}>${error ? esc(error) : ""}</div><div id="progress" class="progress" role="status" hidden></div><form method="post" action="${esc(pending.authorizationAction)}" id="auth-form">${hidden("client_id", pending.client.client_id)}${hidden("redirect_uri", pending.redirectUri)}${hidden("state", pending.state)}${hidden("scope", pending.scope)}${hidden("resource", pending.resource)}${hidden("code_challenge", pending.codeChallenge)}${hidden("lang", lang)}<div class="section"><label for="worker_token">${esc(t.trabajadorEtiqueta)}</label><input id="worker_token" name="worker_token" autocomplete="off" autocapitalize="none"><p class="hint">${esc(t.trabajadorPista)}</p></div><div class="section"><label for="owner_email">${esc(t.propietarioEmail)}</label><input id="owner_email" name="owner_email" type="email" autocomplete="username" autocapitalize="none"><label for="owner_password">${esc(t.propietarioClave)}</label><input id="owner_password" name="owner_password" type="password" autocomplete="current-password"><p class="hint">${esc(t.propietarioPista)}</p></div><button id="btn" type="submit">${esc(t.boton)}</button></form></main><script>const form=document.getElementById("auth-form"),btn=document.getElementById("btn"),progress=document.getElementById("progress"),errorBox=document.getElementById("client-error");form.addEventListener("submit",function(event){const w=document.getElementById("worker_token").value.trim(),e=document.getElementById("owner_email").value.trim(),p=document.getElementById("owner_password").value;if((!w&&!e&&!p)||(!w&&(!!e!==!!p))||(w&&(e||p))){event.preventDefault();errorBox.textContent=${JSON.stringify(t.faltanDatos)};errorBox.hidden=false;return;}btn.disabled=true;btn.innerText=${JSON.stringify(t.conectando)};progress.textContent=${JSON.stringify(t.esperando)};progress.hidden=false;});</script></body></html>`;
}

async function authorizeGet(req: Request, res: Response) {
  const clientId = String(req.query.client_id ?? ""); const redirectUri = String(req.query.redirect_uri ?? ""); const responseType = String(req.query.response_type ?? ""); const challenge = String(req.query.code_challenge ?? ""); const method = String(req.query.code_challenge_method ?? ""); const resource = String(req.query.resource ?? resourceUrl(req)); const scope = String(req.query.scope ?? DEFAULT_SCOPE);
  const client = await findClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) { res.status(400).send("OAuth client or redirect URI is not registered."); return; }
  if (responseType !== "code" || method !== "S256" || !challenge || resource !== resourceUrl(req)) { redirectError(res, redirectUri, "invalid_request", "OAuth requires response_type=code, PKCE S256 and the MCP resource parameter.", String(req.query.state ?? "")); return; }
  const accion = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?", 1)[0]}`;
  const datos = { client, redirectUri, state: typeof req.query.state === "string" ? req.query.state : undefined, scope: DEFAULT_SCOPE, resource, codeChallenge: challenge };
  const pending: PendingAuthorization = { ...datos, authorizationAction: accion, enlaceDeIdioma: enlaceDeIdioma(accion, datos) };
  const lang = langDelMcp(req.query.lang, req.get("accept-language"));
  // form-action must allow '*' so the browser doesn't block the 303 redirect to Claude's custom URI/localhost after the POST.
  res.setHeader("Content-Security-Policy", `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self' *; base-uri 'none'`);
  res.type("html").send(consentPage(pending, lang));
}

async function authorizePost(req: Request, res: Response) {
  const clientId = bodyString(req, "client_id"); const redirectUri = bodyString(req, "redirect_uri"); const state = bodyString(req, "state") || undefined; const challenge = bodyString(req, "code_challenge"); const resource = bodyString(req, "resource") || resourceUrl(req); const scope = bodyString(req, "scope") || DEFAULT_SCOPE; const client = await findClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) { res.status(400).send("OAuth client or redirect URI is not registered."); return; }
  const accion = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?", 1)[0]}`;
  const datos = { client, redirectUri, state, scope: DEFAULT_SCOPE, resource, codeChallenge: challenge };
  const pending: PendingAuthorization = { ...datos, authorizationAction: accion, enlaceDeIdioma: enlaceDeIdioma(accion, datos) };
  // El idioma que ya estaba puesto viaja en el formulario: quien eligió
  // francés para escribir su contraseña no debe leer el error en otro idioma.
  const lang = langDelMcp(bodyString(req, "lang"), req.get("accept-language"));
  if (resource !== resourceUrl(req) || !challenge) { res.status(400).send("Invalid MCP resource or PKCE challenge."); return; }
  res.setTimeout(20000, () => {
    if (!res.headersSent) {
      res.status(504).type("html").send(consentPage(pending, lang, aviso("no_responde", lang)));
    }
  });
  try {
    const ownerEmail = bodyString(req, "owner_email");
    const ownerPassword = bodyString(req, "owner_password");
    const identity = ownerEmail && ownerPassword
      ? await withTimeout(resolveOwnerCredentials(ownerEmail, ownerPassword), 15000, "La validación del propietario")
      : await withTimeout(resolveWorker(bodyString(req, "worker_token")), 8000, "La validación del trabajador");

    if (!identity) {
      console.error("[MCP OAuth] No se pudo resolver la identidad enviada");
      res.status(401).type("html").send(consentPage(pending, lang, aviso("credenciales_no_validas", lang)));
      return;
    }

    if (identity.access === "bloqueado") {
      console.error(`[MCP OAuth] Acceso bloqueado para la identidad ${identity.workerId}`);
      res.status(403).type("html").send(consentPage(pending, lang, aviso("acceso_bloqueado", lang)));
      return;
    }

    await withTimeout(persistCimdClient(client), 5000, "El registro del cliente OAuth");
    const connectionId = await withTimeout(issueConnection(identity, client, DEFAULT_SCOPE), 6000, "La conexión del negocio");
    const rawCode = opaqueToken("mcp_code");
    const { error } = await withTimeout((async () => getSupabaseAdmin().from("mcp_oauth_codes").insert({ code_hash: hashToken(rawCode), client_id: client.client_id, redirect_uri: redirectUri, resource, code_challenge: challenge, scope: DEFAULT_SCOPE, connection_id: connectionId, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }))(), 5000, "La creación del código OAuth");
    if (error) throw error;
    // RFC 9207 / MCP authorization response: the issuer lets clients such as
    // Claude bind the callback to the authorization server they discovered.
    const target = new URL(redirectUri); target.searchParams.set("code", rawCode); target.searchParams.set("iss", baseUrl(req)); if (state) target.searchParams.set("state", state);
    // The authorization form is submitted with POST. 303 explicitly tells
    // browsers and hosted MCP clients to follow the callback with GET instead
    // of retrying the POST or leaving the consent page pending.
    res.setHeader("Cache-Control", "no-store");
    res.redirect(303, target.toString());
  } catch (error) {
    console.error("[MCP OAuth] Error completando autorización", error);
    // El detalle técnico va al registro, no a la pantalla: quien la lee no
    // puede hacer nada con «Supabase Auth no respondió en 8 segundos», y ese
    // texto sólo existe en castellano.
    res.status(503).type("html").send(consentPage(pending, lang, aviso("no_responde", lang)));
  }
}

async function token(req: Request, res: Response) {
  const grant = bodyString(req, "grant_type"); const resource = bodyString(req, "resource") || resourceUrl(req); const clientId = bodyString(req, "client_id"); const code = bodyString(req, "code"); const verifier = bodyString(req, "code_verifier"); const refresh = bodyString(req, "refresh_token");
  if (resource !== resourceUrl(req)) { res.status(400).json({ error: "invalid_target", error_description: "The resource must be the Logiciel Construction MCP server." }); return; }
  if (grant === "authorization_code") {
    const { data: row, error } = await getSupabaseAdmin().from("mcp_oauth_codes").select("id, client_id, redirect_uri, code_challenge, scope, connection_id, expires_at, consumed_at").eq("code_hash", hashToken(code)).maybeSingle(); if (error) throw error;
    const redirectUri = bodyString(req, "redirect_uri");
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now() || row.client_id !== clientId || (redirectUri && redirectUri !== row.redirect_uri) || !verifier || !safeEqual(sha256(verifier), row.code_challenge)) { res.status(400).json({ error: "invalid_grant" }); return; }
    const { error: consumedError } = await getSupabaseAdmin().from("mcp_oauth_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id).is("consumed_at", null); if (consumedError) throw consumedError;
    await issueTokens(res, row.connection_id, clientId, row.scope, resource); return;
  }
  if (grant === "refresh_token") { await rotateRefresh(res, refresh, clientId, resource); return; }
  res.status(400).json({ error: "unsupported_grant_type" });
}

async function issueTokens(res: Response, connectionId: string, clientId: string, scope: string, resource: string) {
  const access = opaqueToken("mcp_at"); const refresh = opaqueToken("mcp_rt"); const admin = getSupabaseAdmin();
  const { error } = await admin.from("mcp_oauth_tokens").insert({ connection_id: connectionId, client_id: clientId, access_token_hash: hashToken(access), refresh_token_hash: hashToken(refresh), scope, resource, access_expires_at: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString(), refresh_expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString() });
  if (error) throw error;
  res.setHeader("Cache-Control", "no-store"); res.setHeader("Pragma", "no-cache"); res.json({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refresh, scope, resource });
}

async function rotateRefresh(res: Response, rawRefresh: string, clientId: string, resource: string) {
  const admin = getSupabaseAdmin(); const { data: row, error } = await admin.from("mcp_oauth_tokens").select("id, connection_id, client_id, scope, refresh_expires_at, revoked_at").eq("refresh_token_hash", hashToken(rawRefresh)).maybeSingle(); if (error) throw error;
  if (!row || row.client_id !== clientId || row.revoked_at || new Date(row.refresh_expires_at).getTime() <= Date.now()) { res.status(400).json({ error: "invalid_grant" }); return; }
  await admin.from("mcp_oauth_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", row.id); await issueTokens(res, row.connection_id, clientId, row.scope, resource);
}

export function mcpOAuthRoutes(router: Router) {
  router.get("/.well-known/oauth-protected-resource/mcp", (req, res) => res.json({ resource: resourceUrl(req), authorization_servers: [baseUrl(req)] }));
  router.get("/.well-known/oauth-authorization-server", (req, res) => { const issuer = baseUrl(req); res.json({ issuer, authorization_endpoint: `${issuer}/oauth/authorize`, token_endpoint: `${issuer}/oauth/token`, registration_endpoint: `${issuer}/oauth/register`, revocation_endpoint: `${issuer}/oauth/revoke`, response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"], scopes_supported: [DEFAULT_SCOPE], client_id_metadata_document_supported: true }); });
  router.post("/oauth/register", async (req, res, next) => { try { const redirects = Array.isArray(req.body?.redirect_uris) ? req.body.redirect_uris.filter((v: unknown): v is string => typeof v === "string") : []; if (!redirects.length || redirects.some((uri: string) => !/^https:\/\//.test(uri) && !/^http:\/\/localhost(?::\d+)?\//.test(uri))) { res.status(400).json({ error: "invalid_client_metadata" }); return; } const clientId = `mcp_client_${randomUUID()}`; const { error } = await getSupabaseAdmin().from("mcp_oauth_clients").insert({ client_id: clientId, client_name: String(req.body?.client_name ?? "MCP client").slice(0, 120), redirect_uris: redirects, token_endpoint_auth_method: "none" }); if (error) throw error; res.status(201).json({ client_id: clientId, client_name: String(req.body?.client_name ?? "MCP client").slice(0, 120), redirect_uris: redirects, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }); } catch (error) { next(error); } });
  router.all("/oauth/authorize", async (req, res, next) => { try { if (req.method === "GET") await authorizeGet(req, res); else if (req.method === "POST") await authorizePost(req, res); else res.status(405).end(); } catch (error) { next(error); } });
  router.post("/oauth/token", async (req, res, next) => { try { await token(req, res); } catch (error) { next(error); } });
  router.post("/oauth/revoke", async (req, res, next) => { try { const raw = bodyString(req, "token"); const admin = getSupabaseAdmin(); await admin.from("mcp_oauth_tokens").update({ revoked_at: new Date().toISOString() }).or(`access_token_hash.eq.${hashToken(raw)},refresh_token_hash.eq.${hashToken(raw)}`); res.status(200).json({}); } catch (error) { next(error); } });
}

export function oauthErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) { if (error instanceof Error && error.message.includes("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")) { res.status(503).json({ error: "OAuth storage unavailable", code: "backend_unavailable" }); return; } next(error); }
