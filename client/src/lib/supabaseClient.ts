import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Browser client — uses the publishable/anon key only (safe to expose).
// Every actual data query still goes through our Express API; this client
// exists solely to run Supabase Auth (sign up / sign in / session refresh).
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
