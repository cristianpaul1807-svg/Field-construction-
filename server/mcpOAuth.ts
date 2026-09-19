import type { NextFunction, Request, Response, Router } from "express";
import { randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { hashToken } from "./supabaseAuth";
import { resolveWorker, type WorkerIdentity } from "./mcp";
import { accesoDe, planDe } from "../shared/planes";

const DEFAULT_SCOPE = "mcp:read";
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

type OAuthClient = { client_id: string; client_name: string; redirect_uris: string[]; token_endpoint_auth_method: string };
type PendingAuthorization = { client: OAuthClient; redirectUri: string; state: string | undefined; scope: string; resource: string; codeChallenge: string };

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
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const anon = (process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "").replace(/\s+/g, "");
  if (!url || !anon) return null;
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return null;
  const admin = getSupabaseAdmin();
  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("id, name, subscription_plan, subscription_status, trial_ends_at, primary_auth_user_id")
    .eq("primary_auth_user_id", data.user.id)
    .maybeSingle();
  if (businessError) throw businessError;
  let resolvedBusiness = business;
  let permissionRole = "admin";
  // Older/provisioned accounts may have the auth link on public.users but not
  // yet on businesses.primary_auth_user_id. Accept that canonical link too.
  if (!resolvedBusiness) {
    const { data: userRow, error: userError } = await admin
      .from("users")
      .select("business_id, roles(name)")
      .eq("auth_user_id", data.user.id)
      .eq("status", "activo")
      .limit(1)
      .maybeSingle();
    if (userError) throw userError;
    if (userRow?.business_id) {
      const { data: linkedBusiness, error: linkedBusinessError } = await admin
        .from("businesses")
        .select("id, name, subscription_plan, subscription_status, trial_ends_at, primary_auth_user_id")
        .eq("id", userRow.business_id)
        .maybeSingle();
      if (linkedBusinessError) throw linkedBusinessError;
      resolvedBusiness = linkedBusiness;
      permissionRole = (userRow as any).roles?.name ?? "tecnico";
    }
  }
  if (resolvedBusiness) {
    const plan = planDe(resolvedBusiness.subscription_plan);
    return {
      workerId: data.user.id,
      workerKind: "owner",
      businessId: resolvedBusiness.id,
      name: resolvedBusiness.name ?? null,
      workerRole: permissionRole,
      plan,
      access: accesoDe({ plan, estadoSuscripcion: resolvedBusiness.subscription_status, pruebaHasta: resolvedBusiness.trial_ends_at }),
    };
  }

  const [employee, subcontractor] = await Promise.all([
    admin.from("employees").select("id, business_id, name, role, roles(name), businesses(subscription_plan, subscription_status, trial_ends_at)").eq("auth_user_id", data.user.id).maybeSingle(),
    admin.from("subcontractors").select("id, business_id, name, trade, roles(name), businesses(subscription_plan, subscription_status, trial_ends_at)").eq("auth_user_id", data.user.id).maybeSingle(),
  ]);
  const row = employee.data ?? subcontractor.data;
  if (employee.error && subcontractor.error) throw employee.error;
  if (!row) return null;
  const workerBusiness = (row as any).businesses as { subscription_plan?: string | null; subscription_status?: string | null; trial_ends_at?: string | null } | null;
  const plan = planDe(workerBusiness?.subscription_plan);
  return {
    workerId: row.id,
    workerKind: employee.data ? "employee" : "subcontractor",
    businessId: row.business_id,
    name: row.name ?? null,
    workerRole: (row as any).roles?.name ?? ((row as any).role ?? (row as any).trade ?? null),
    plan,
    access: accesoDe({ plan, estadoSuscripcion: workerBusiness?.subscription_status ?? null, pruebaHasta: workerBusiness?.trial_ends_at ?? null }),
  };
}

function consentPage(pending: PendingAuthorization, error?: string) {
  const hidden = (key: string, value: string | undefined) => value ? `<input type="hidden" name="${key}" value="${esc(value)}">` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizar Field</title><style>body{font-family:system-ui,sans-serif;background:#f5f5f7;color:#171717;margin:0;padding:32px}.card{max-width:440px;margin:7vh auto;background:white;border-radius:20px;padding:28px;box-shadow:0 10px 40px #0001}h1{font-size:24px;margin:0 0 8px}p{color:#555;line-height:1.5}label{font-weight:600;font-size:14px;display:block;margin:18px 0 7px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #ccc;border-radius:10px;font:inherit}.scope{background:#f5f5f7;border-radius:12px;padding:12px;margin:18px 0;font-size:14px}.section{border-top:1px solid #eee;margin-top:20px;padding-top:5px}.hint{font-size:13px;color:#666}.error{color:#a40000;background:#fff0f0;padding:10px;border-radius:10px;font-size:14px}button{width:100%;border:0;border-radius:11px;padding:13px;background:#111;color:#fff;font-weight:650;font-size:15px;margin-top:20px}</style></head><body><main class="card"><h1>Conectar Field</h1><p><strong>${esc(pending.client.client_name)}</strong> solicita acceso a tus datos de Field.</p><div class="scope"><strong>Solo lectura.</strong> Agenda, órdenes, proyectos, tareas, horas, documentos y reportes permitidos por tu rol.</div>${error ? `<div class="error">${esc(error)}</div>` : ""}<form method="post">${hidden("client_id", pending.client.client_id)}${hidden("redirect_uri", pending.redirectUri)}${hidden("state", pending.state)}${hidden("scope", pending.scope)}${hidden("resource", pending.resource)}${hidden("code_challenge", pending.codeChallenge)}<div class="section"><label for="worker_token">Código de acceso de trabajador</label><input id="worker_token" name="worker_token" autocomplete="off" autocapitalize="none"><p class="hint">Úsalo para conectar un trabajador o subcontratista.</p></div><div class="section"><label for="owner_email">Email de la cuenta propietaria</label><input id="owner_email" name="owner_email" type="email" autocomplete="username" autocapitalize="none"><label for="owner_password">Contraseña de la cuenta propietaria</label><input id="owner_password" name="owner_password" type="password" autocomplete="current-password"><p class="hint">Solo se valida contra Supabase Auth; no se guarda la contraseña.</p></div><button type="submit">Autorizar acceso de solo lectura</button></form></main></body></html>`;
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
  const ownerEmail = bodyString(req, "owner_email");
  const ownerPassword = bodyString(req, "owner_password");
  const identity = ownerEmail && ownerPassword
    ? await resolveOwnerCredentials(ownerEmail, ownerPassword)
    : await resolveWorker(bodyString(req, "worker_token"));
  if (!identity || identity.access === "bloqueado") { res.status(401).type("html").send(consentPage(pending, "Las credenciales no son válidas o el acceso del negocio está bloqueado.")); return; }
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
