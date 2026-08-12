import { createRoot } from "react-dom/client";
import "./index.css";
// Side-effect import: configures the shared i18next instance before any
// component that calls useTranslation() renders.
import "./i18n";
import { loadSupabaseConfig } from "@/lib/supabaseConfig";

// This screen has to work when the app never mounted, so it can't reach
// react-i18next — it picks its own wording from the browser's language
// against a copy of the four strings it needs.
const FATAL_COPY: Record<string, { heading: string; fallback: string }> = {
  es: { heading: "Error de configuración", fallback: "No se pudo cargar la configuración de la aplicación." },
  en: { heading: "Configuration error", fallback: "The application configuration could not be loaded." },
  fr: { heading: "Erreur de configuration", fallback: "Impossible de charger la configuration de l'application." },
  it: { heading: "Errore di configurazione", fallback: "Impossibile caricare la configurazione dell'applicazione." },
};

function fatalCopy() {
  const lang = (navigator.language || "es").slice(0, 2).toLowerCase();
  return FATAL_COPY[lang] ?? FATAL_COPY.es;
}

// The message can carry a server error string, so it is inserted as text
// rather than markup — an error is not a place to start trusting input.
function showFatal(message: string) {
  const { heading } = fatalCopy();
  const box = document.createElement("div");
  box.setAttribute(
    "style",
    "font-family:system-ui,sans-serif;max-width:640px;margin:64px auto;padding:24px;" +
      "border:1px solid #e5484d;border-radius:8px;color:#e5484d;background:#fff1f0"
  );
  const title = document.createElement("strong");
  title.textContent = heading;
  const body = document.createElement("p");
  body.setAttribute("style", "margin:8px 0 0;color:#111");
  body.textContent = message;
  box.append(title, body);
  document.body.replaceChildren(box);
}

// Supabase config is resolved before the app mounts — from the bundle when it
// was compiled with VITE_* values, otherwise from the server. App is imported
// dynamically so nothing in its module graph touches the Supabase client
// before that config exists.
// Registered after the app has a chance to boot, so a failing worker can
// never be the reason the app doesn't start.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // An unregistrable worker costs offline support, nothing else.
    });
  });
}

loadSupabaseConfig()
  .then(async () => {
    const { default: App } = await import("./App");
    createRoot(document.getElementById("root")!).render(<App />);
  })
  .catch((err: unknown) => {
    showFatal(
      err instanceof Error
        ? err.message
        : fatalCopy().fallback
    );
  });
