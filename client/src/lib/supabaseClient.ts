import { getSupabaseClient } from "@/lib/supabaseConfig";

// Browser client — uses the publishable/anon key only (safe to expose).
// Every actual data query still goes through our Express API; this client
// exists solely to run Supabase Auth (sign up / sign in / session refresh).
//
// Config is resolved during boot in main.tsx, before this module's first use,
// so callers still get a plain client instead of a promise. Accessed through
// a getter rather than captured at import time, because the module graph is
// loaded before boot finishes.
export const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_target, prop) {
    const value = (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(getSupabaseClient()) : value;
  },
});
