import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// Server-only client using the service role key — bypasses RLS by design.
// It is never sent to the browser; every route below scopes its own
// queries by DEMO_BUSINESS_ID until Fase C introduces real per-user auth,
// at which point this constant is replaced by the business_id resolved
// from the authenticated request.
export const DEMO_BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";

let client: SupabaseClient | null = null;

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Configure them as " +
        "environment variables before using the API (see Fase B setup notes)."
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

// supabase-js appends /rest/v1 itself — normalize away a trailing
// /rest/v1(/) in case the configured env var already includes it, which
// would otherwise double up into an invalid path (PostgREST PGRST125).
function normalizeProjectUrl(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  // Trimmed on the way in: these are pasted into a hosting panel by hand,
  // and a trailing newline or stray space survives the "is it set?" check
  // while quietly corrupting the Authorization header, which fails with an
  // error that carries no message at all.
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");

  if (!rawUrl || !serviceRoleKey) {
    throw new SupabaseNotConfiguredError();
  }

  client = createClient(normalizeProjectUrl(rawUrl), serviceRoleKey, {
    auth: { persistSession: false },
    // supabase-js always spins up a realtime client on construction (even
    // though this app never subscribes to anything) and it looks for a
    // native `WebSocket` global. That only exists on Node 22+, so on older
    // Node runtimes (e.g. some container base images) it throws
    // synchronously and takes down every request. Passing the `ws` package
    // explicitly makes this work regardless of the host's Node version.
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  return client;
}
