import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  const message =
    "Configuración incompleta: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el build de producción. " +
    "Agrega estas variables en el entorno de build de tu hosting y vuelve a compilar (no basta con reiniciar el contenedor).";
  document.body.innerHTML =
    `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:64px auto;padding:24px;` +
    `border:1px solid #e5484d;border-radius:8px;color:#e5484d;background:#fff1f0">` +
    `<strong>Error de configuración</strong><p style="margin:8px 0 0;color:#111">${message}</p></div>`;
  throw new Error(message);
}

// Browser client — uses the publishable/anon key only (safe to expose).
// Every actual data query still goes through our Express API; this client
// exists solely to run Supabase Auth (sign up / sign in / session refresh).
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
