import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import WebSocket from "ws";
import { getSupabaseAdmin } from "./supabaseAdmin";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

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

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

// Authenticated but persona-agnostic — used only by the two provisioning
// endpoints (register-business / claim-client), which run before a users
// or clients row exists yet, so business_id/client_id can't be resolved.
export async function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  req.authUserId = data.user.id;
  req.supabase = getSupabaseForToken(token);
  next();
}

// Every business-panel route: resolves which business the caller belongs
// to via their own users row, read through their own RLS-scoped client.
export async function requireBusinessAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const { data: userData, error: userError } = await getSupabaseAdmin().auth.getUser(token);
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
}

// Client Portal routes: resolves which clients row the caller claimed.
export async function requireClientAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const { data: userData, error: userError } = await getSupabaseAdmin().auth.getUser(token);
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
}

// Worker PWA (/campo): a completely separate flow, deliberately not built
// on Supabase Auth. The bearer value is the raw token issued once via
// POST /employees|subcontractors/:id/access-token, hashed and compared
// against access_token_hash. Since there's no auth.uid() here, RLS can't
// apply — every worker endpoint uses the service-role client and filters
// by employee_id/subcontractor_id + business_id explicitly in application
// code instead.
export async function requireWorkerAuth(req: Request, res: Response, next: NextFunction) {
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

  const worker = employee.data ?? subcontractor.data;
  if (!worker) {
    res.status(401).json({ error: "Invalid worker token" });
    return;
  }

  req.workerId = worker.id;
  req.workerKind = employee.data ? "employee" : "subcontractor";
  req.workerBusinessId = worker.business_id;
  next();
}
