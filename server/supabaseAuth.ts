import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import WebSocket from "ws";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Same hand-pasted-into-a-panel hazard as in supabaseAdmin: strip stray
// whitespace so a trailing newline cannot corrupt the request headers.
const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY ?? "").replace(/\s+/g, "");

function normalizeProjectUrl(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

// One client per request, carrying the caller's own JWT — every query it
// makes runs as that authenticated user, so Postgres RLS (not app code) is
// what actually enforces tenant isolation. This is deliberately different
// from supabaseAdmin's service-role client, which bypasses RLS by design.
export function getSupabaseForToken(jwt: string): SupabaseClient {
  return createClient(normalizeProjectUrl(SUPABASE_URL), SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      supabase?: SupabaseClient;
      authUserId?: string;
      businessId?: string;
      clientId?: string;
      workerId?: string;
      workerKind?: "employee" | "subcontractor";
      workerBusinessId?: string;
    }
  }
}

// An auth middleware that throws takes the entire process down, because
// Express can't catch a rejected promise from an async handler. Any
// infrastructure failure here (misconfigured service-role key, Supabase
// unreachable) should degrade to a clean 503 for that one request instead.
function guarded(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch((err) => {
      console.error("auth middleware failed", err);
      if (!res.headersSent) {
        res.status(503).json({ error: "Authentication is temporarily unavailable" });
      }
    });
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// supabase-js reports both "this JWT is bad" and "I couldn't reach the auth
// server" as an error on the same call. Blaming the user's session for an
// infrastructure problem sends them chasing a login that was never broken,
// so the two are separated here by status code: only a 4xx from the auth
// service is really about the token.
function isCredentialRejection(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

function authUnavailable(res: Response, err: unknown) {
  console.error("Supabase auth is unreachable", err);
  res.status(503).json({
    error:
      "El servidor no pudo contactar con Supabase. Revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.",
  });
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

// Authenticated but persona-agnostic — used only by the two provisioning
// endpoints (register-business / claim-client), which run before a users
// or clients row exists yet, so business_id/client_id can't be resolved.
export const requireAuthenticatedUser = guarded(async (req: Request, res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error && !isCredentialRejection(error)) {
    authUnavailable(res, error);
    return;
  }
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  req.authUserId = data.user.id;
  req.supabase = getSupabaseForToken(token);
  next();
});

// Every business-panel route: resolves which business the caller belongs
// to via their own users row, read through their own RLS-scoped client.
export const requireBusinessAuth = guarded(async (req: Request, res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const { data: userData, error: userError } = await getSupabaseAdmin().auth.getUser(token);
  if (userError && !isCredentialRejection(userError)) {
    authUnavailable(res, userError);
    return;
  }
  if (userError || !userData.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const scoped = getSupabaseForToken(token);
  const { data: userRow, error: rowError } = await scoped
    .from("users")
    .select("business_id")
    .eq("auth_user_id", userData.user.id)
    .single();

  if (rowError || !userRow) {
    res.status(403).json({ error: "This account is not linked to a business yet" });
    return;
  }

  req.authUserId = userData.user.id;
  req.businessId = userRow.business_id;
  req.supabase = scoped;
  next();
});

// Client Portal routes. A client can arrive two ways:
//
//   1. An access code the business handed them (the default). Same
//      passwordless mechanism the worker PWA uses — no email delivery, no
//      password reset, nothing external standing between the client and
//      their project. There's no auth.uid() in this path, so RLS can't
//      apply and req.supabase is the service-role client; every client
//      route filters by req.clientId explicitly in application code.
//   2. A Supabase Auth session, for clients who already set up an
//      email/password login. RLS applies as before.
//
// The access code is checked first because it's the cheaper lookup and the
// common case; a value that isn't a known code falls through to being
// treated as a JWT.
export const requireClientAuth = guarded(async (req: Request, res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const admin = getSupabaseAdmin();
  const { data: byCode } = await admin
    .from("clients")
    .select("id")
    .eq("access_token_hash", hashToken(token))
    .maybeSingle();

  if (byCode) {
    req.clientId = byCode.id;
    req.supabase = admin;
    next();
    return;
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError && !isCredentialRejection(userError)) {
    authUnavailable(res, userError);
    return;
  }
  if (userError || !userData.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const scoped = getSupabaseForToken(token);
  const { data: clientRow, error: rowError } = await scoped
    .from("clients")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .single();

  if (rowError || !clientRow) {
    res.status(403).json({ error: "This account is not linked to a client yet" });
    return;
  }

  req.authUserId = userData.user.id;
  req.clientId = clientRow.id;
  req.supabase = scoped;
  next();
});

// Worker PWA (/campo): a completely separate flow, deliberately not built
// on Supabase Auth. The bearer value is the raw token issued once via
// POST /employees|subcontractors/:id/access-token, hashed and compared
// against access_token_hash. Since there's no auth.uid() here, RLS can't
// apply — every worker endpoint uses the service-role client and filters
// by employee_id/subcontractor_id + business_id explicitly in application
// code instead.
export const requireWorkerAuth = guarded(async (req: Request, res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing worker token" });
    return;
  }

  const hash = hashToken(token);
  const admin = getSupabaseAdmin();
  const [employee, subcontractor] = await Promise.all([
    admin.from("employees").select("id, business_id").eq("access_token_hash", hash).maybeSingle(),
    admin.from("subcontractors").select("id, business_id").eq("access_token_hash", hash).maybeSingle(),
  ]);

  // A database that did not answer is not a worker with the wrong code. Told
  // apart because the difference decides what the person on site does next:
  // one means re-read the card in their wallet, the other means wait, and
  // sending them after the wrong one wastes a morning.
  if (employee.error && subcontractor.error) {
    console.error("[auth] worker lookup failed", employee.error);
    res.status(503).json({ error: "Worker directory unavailable", code: "backend_unavailable" });
    return;
  }

  const worker = employee.data ?? subcontractor.data;
  if (!worker) {
    res.status(401).json({ error: "Invalid worker token" });
    return;
  }

  req.workerId = worker.id;
  req.workerKind = employee.data ? "employee" : "subcontractor";
  req.workerBusinessId = worker.business_id;
  next();
});
