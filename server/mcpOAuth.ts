import type { NextFunction, Request, Response, Router } from "express";
import { randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { hashToken } from "./supabaseAuth";
import { resolveWorker, type WorkerIdentity } from "./mcp";

const DEFAULT_SCOPE = "mcp:read";
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

type OAuthClient = { client_id: string; client_name: string; redirect_uris: string[]; token_endpoint_auth_method: string };
type PendingAuthorization = { client: OAuthClient; redirectUri: string; state: string | undefined; scope: string; resource: string; codeChallenge: string };

function baseUrl(req: Request) {
  const configured = process.env.MCP_OAUTH_ISSUER?.trim().replace(/\/$/, "");
  return configured || `${req.protocol}://${req.get("host")}/api`;
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
  const column = identity.workerKind === "employee" ? "employee_id" : "subcontractor_id";
  const { data, error } = await admin.from("mcp_connections").insert({
    business_id: identity.businessId, [column]: identity.workerId, provider: client.client_name.slice(0, 120), external_subject: client.client_id,
    status: "active", scopes: [scope],
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

function consentPage(pending: PendingAuthorization, error?: string) {
  const hidden = (key: string, value: string | undefined) => value ? `<input type="hidden" name="${key}" value="${esc(value)}">` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autoriser Field</title><style>body{font-family:system-ui,sans-serif;background:#f5f5f7;color:#171717;margin:0;padding:32px}.card{max-width:440px;margin:7vh auto;background:white;border-radius:20px;padding:28px;box-shadow:0 10px 40px #0001}h1{font-size:24px;margin:0 0 8px}p{color:#555;line-height:1.5}label{font-weight:600;font-size:14px;display:block;margin:22px 0 7px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #ccc;border-radius:10px;font:inherit}.scope{background:#f5f5f7;border-radius:12px;padding:12px;margin:18px 0;font-size:14px}.error{color:#a40000;background:#fff0f0;padding:10px;border-radius:10px;font-size:14px}button{width:100%;border:0;border-radius:11px;padding:13px;background:#111;color:#fff;font-weight:650;font-size:15px;margin-top:20px}</style></head><body><main class="card"><h1>Conectar Field</h1><p><strong>${esc(pending.client.client_name)}</strong> solicita acceso a tus datos de Field.</p><div class="scope">Solo lectura: agenda, órdenes, proyectos, tareas, horas y documentos autorizados.</div>${error ? `<div class="error">${esc(error)}</div>` : ""}<form method="post">${hidden("client_id", pending.client.client_id)}${hidden("redirect_uri", pending.redirectUri)}${hidden("state", pending.state)}${hidden("scope", pending.scope)}${hidden("resource", pending.resource)}${hidden("code_challenge", pending.codeChallenge)}<label for="worker_token">Código de acceso de trabajador</label><input id="worker_token" name="worker_token" autocomplete="current-password" autocapitalize="none" required><button type="submit">Autorizar acceso de solo lectura</button></form></main></body></html>`;
}

async function authorizeGet(req: Request, res: Response) {
  const clientId = String(req.query.client_id ?? ""); const redirectUri = String(req.query.redirect_uri ?? ""); const responseType = String(req.query.response_type ?? ""); const challenge = String(req.query.code_challenge ?? ""); const method = String(req.query.code_challenge_method ?? ""); const resource = String(req.query.resource ?? resourceUrl(req)); const scope = String(req.query.scope ?? DEFAULT_SCOPE);
  const client = await findClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) { res.status(400).send("OAuth client or redirect URI is not registered."); return; }
  if (responseType !== "code" || method !== "S256" || !challenge || resource !== resourceUrl(req)) { redirectError(res, redirectUri, "invalid_request", "OAuth requires response_type=code, PKCE S256 and the MCP resource parameter.", String(req.query.state ?? "")); return; }
  const pending: PendingAuthorization = { client, redirectUri, state: typeof req.query.state === "string" ? req.query.state : undefined, scope: scope === DEFAULT_SCOPE ? DEFAULT_SCOPE : DEFAULT_SCOPE, resource, codeChallenge: challenge };
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none");
  res.type("html").send(consentPage(pending));
}

async function authorizePost(req: Request, res: Response) {
  const clientId = bodyString(req, "client_id"); const redirectUri = bodyString(req, "redirect_uri"); const state = bodyString(req, "state") || undefined; const challenge = bodyString(req, "code_challenge"); const resource = bodyString(req, "resource") || resourceUrl(req); const scope = bodyString(req, "scope") || DEFAULT_SCOPE; const client = await findClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) { res.status(400).send("OAuth client or redirect URI is not registered."); return; }
  const pending: PendingAuthorization = { client, redirectUri, state, scope: DEFAULT_SCOPE, resource, codeChallenge: challenge };
  if (resource !== resourceUrl(req) || !challenge) { res.status(400).send("Invalid MCP resource or PKCE challenge."); return; }
  const identity = await resolveWorker(bodyString(req, "worker_token"));
  if (!identity || identity.access === "bloqueado") { res.status(401).type("html").send(consentPage(pending, "El código de trabajador no es válido o el acceso del negocio está bloqueado.")); return; }
  await persistCimdClient(client);
  const connectionId = await issueConnection(identity, client, DEFAULT_SCOPE);
  const rawCode = opaqueToken("mcp_code");
  const { error } = await getSupabaseAdmin().from("mcp_oauth_codes").insert({ code_hash: hashToken(rawCode), client_id: client.client_id, redirect_uri: redirectUri, resource, code_challenge: challenge, scope: DEFAULT_SCOPE, connection_id: connectionId, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() });
  if (error) throw error;
  const target = new URL(redirectUri); target.searchParams.set("code", rawCode); if (state) target.searchParams.set("state", state); res.redirect(302, target.toString());
}

async function token(req: Request, res: Response) {
  const grant = bodyString(req, "grant_type"); const resource = bodyString(req, "resource") || resourceUrl(req); const clientId = bodyString(req, "client_id"); const code = bodyString(req, "code"); const verifier = bodyString(req, "code_verifier"); const refresh = bodyString(req, "refresh_token");
  if (resource !== resourceUrl(req)) { res.status(400).json({ error: "invalid_target", error_description: "The resource must be the Field MCP server." }); return; }
  if (grant === "authorization_code") {
    const { data: row, error } = await getSupabaseAdmin().from("mcp_oauth_codes").select("id, client_id, redirect_uri, code_challenge, scope, connection_id, expires_at, consumed_at").eq("code_hash", hashToken(code)).maybeSingle(); if (error) throw error;
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now() || row.client_id !== clientId || !safeEqual(sha256(verifier), row.code_challenge)) { res.status(400).json({ error: "invalid_grant" }); return; }
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
