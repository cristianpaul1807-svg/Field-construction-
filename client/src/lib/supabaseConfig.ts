import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Resolved once during boot (see main.tsx) and read synchronously afterwards,
// so every module that imports the client still gets a plain value rather
// than a promise.
let resolved: SupabaseConfig | null = null;
let client: SupabaseClient | null = null;

export class SupabaseConfigError extends Error {}

/**
 * Values compiled into the bundle win when present. Otherwise we ask the
 * server, which is what makes the app survive a host that injects environment
 * variables at run time only: VITE_* values are frozen into the bundle at
 * build time, so in that setup they'd be permanently empty and no restart
 * would fix it.
 */
export async function loadSupabaseConfig(): Promise<SupabaseConfig> {
  const buildTimeUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const buildTimeKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (buildTimeUrl && buildTimeKey) {
    resolved = { url: buildTimeUrl, anonKey: buildTimeKey };
    return resolved;
  }

  const res = await fetch("/api/public/config");
  if (!res.ok) {
    throw new SupabaseConfigError(`El servidor respondió ${res.status} al pedir la configuración.`);
  }
  const body = (await res.json()) as { supabaseUrl?: string; supabaseAnonKey?: string };
  if (!body.supabaseUrl || !body.supabaseAnonKey) {
    throw new SupabaseConfigError(
      "El servidor no tiene configurados SUPABASE_URL y VITE_SUPABASE_ANON_KEY."
    );
  }

  resolved = { url: body.supabaseUrl, anonKey: body.supabaseAnonKey };
  return resolved;
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  if (!resolved) {
    throw new SupabaseConfigError("La configuración de Supabase se pidió antes de cargarla.");
  }
  // detectSessionInUrl is off because every auth flow here goes through
  // verifyOtp() with a typed code, never a link — leaving it on means every
  // page load tries to parse the current URL for a token, which can throw on
  // leftover query/hash junk from the old link-based flow.
  client = createClient(resolved.url, resolved.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
