import { createRoot } from "react-dom/client";
import "./index.css";
// Side-effect import: configures the shared i18next instance before any
// component that calls useTranslation() renders.
import "./i18n";
import { loadSupabaseConfig } from "@/lib/supabaseConfig";

function showFatal(message: string) {
  document.body.innerHTML =
    `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:64px auto;padding:24px;` +
    `border:1px solid #e5484d;border-radius:8px;color:#e5484d;background:#fff1f0">` +
    `<strong>Error de configuración</strong><p style="margin:8px 0 0;color:#111">${message}</p></div>`;
}

// Supabase config is resolved before the app mounts — from the bundle when it
// was compiled with VITE_* values, otherwise from the server. App is imported
// dynamically so nothing in its module graph touches the Supabase client
// before that config exists.
loadSupabaseConfig()
  .then(async () => {
    const { default: App } = await import("./App");
    createRoot(document.getElementById("root")!).render(<App />);
  })
  .catch((err: unknown) => {
    showFatal(
      err instanceof Error
        ? err.message
        : "No se pudo cargar la configuración de la aplicación."
    );
  });
