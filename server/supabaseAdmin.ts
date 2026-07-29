import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new SupabaseNotConfiguredError();
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}
