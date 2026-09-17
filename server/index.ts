import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { apiApp } from "./api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use("/api", apiApp);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  /**
   * El sitio de presentación.
   *
   * HTML de verdad, sin React, y servido **antes** que la aplicación. Lo abre
   * alguien que llegó de Google con el móvil en la furgoneta: así lee la
   * página entera sin esperar a que baje un paquete de JavaScript, y Google la
   * indexa sin tener que ejecutar nada.
   *
   * Sólo se atienden las direcciones que existen. Lo que no esté en esta lista
   * cae a la aplicación como siempre — el panel, el portal del cliente, la app
   * del trabajador y el chat público siguen intactos.
   */
  const sitioPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "sitio")
      : path.resolve(__dirname, "..", "sitio");

  //
  // La portada vive en `/accueil` y no en `/` porque la raíz es la aplicación:
  // es la pantalla de arranque de la PWA —el trabajador que la tiene instalada
  // vuelve ahí— y la puerta de quien ya tiene sesión. Quitársela dejaría a la
  // cuadrilla aterrizando en un anuncio.
  //
  // Para que el sitio sea de verdad la puerta de entrada, la aplicación se muda
  // a `app.logiciel-construction.com` y entonces esto pasa a `"/"`. Es un
  // cambio de una línea aquí, y de DNS y de la URL de retorno de Intuit fuera.
  const PAGINAS: Record<string, string> = {
    "/accueil": "index.html",
    "/fonctionnalites": "fonctionnalites.html",
    "/ccq-taxes": "ccq-taxes.html",
    "/tarifs": "tarifs.html",
    "/contact": "contact.html",
  };

  for (const [ruta, fichero] of Object.entries(PAGINAS)) {
    app.get(ruta, (_req, res) => res.sendFile(path.join(sitioPath, fichero)));
  }

  // Los ficheros sueltos del sitio: la hoja de estilo, su script, y los dos
  // que le dicen a Google qué hay y qué no mirar.
  for (const fichero of ["estilo.css", "sitio.js", "robots.txt", "sitemap.xml"]) {
    app.get(`/${fichero}`, (_req, res) => res.sendFile(path.join(sitioPath, fichero)));
  }

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
