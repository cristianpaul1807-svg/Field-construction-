import express from "express";
import fs from "fs";
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

  // Claude's custom connector UI expects the public MCP URL in the form
  // https://host/mcp. Keep /api/mcp for existing clients, but delegate only
  // the MCP and OAuth discovery paths here; never expose the whole API root.
  app.all("/mcp", (req, res, next) => apiApp(req, res, next));
  app.get("/.well-known/oauth-protected-resource/mcp", (req, res, next) => apiApp(req, res, next));
  app.get("/.well-known/oauth-authorization-server", (req, res, next) => apiApp(req, res, next));
  app.all(/^\/oauth\/(register|authorize|token|revoke)$/, (req, res, next) => apiApp(req, res, next));

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
   * Las 28 páginas —siete por idioma— y el mapa de direcciones los genera
   * `sitio/construir.mjs`. El mapa se lee de ahí y no se escribe aquí: añadir
   * una página no puede depender de que alguien se acuerde de tocar este
   * archivo.
   *
   * Sólo se atienden las direcciones del mapa. Lo que no esté cae a la
   * aplicación como siempre — el panel, el portal del cliente, la app del
   * trabajador y el chat público siguen intactos, y `/` sigue siendo la
   * pantalla de arranque de la PWA.
   */
  const sitioPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "sitio")
      : path.resolve(__dirname, "..", "sitio", "publico");

  try {
    const mapa = JSON.parse(fs.readFileSync(path.join(sitioPath, "rutas.json"), "utf-8")) as {
      ruta: string;
      fichero: string;
    }[];

    /** El dominio desnudo es la puerta pública, no el inicio de la PWA. */
    const idiomasLanding = new Set(["fr", "en", "es", "it"]);
    const idiomaDesdeNavegador = (acceptLanguage: string | undefined) => {
      const preferencias = (acceptLanguage ?? "")
        .toLowerCase()
        .split(",")
        .map((preferencia) => {
          const [codigo, ...parametros] = preferencia.trim().split(";");
          const calidad = parametros.find((parametro) => parametro.trim().startsWith("q="));
          return {
            codigo: codigo.split("-")[0],
            calidad: calidad ? Number.parseFloat(calidad.split("=")[1]) : 1,
          };
        })
        .filter(({ calidad }) => calidad > 0)
        .sort((a, b) => b.calidad - a.calidad);

      return preferencias.find(({ codigo }) => idiomasLanding.has(codigo))?.codigo ?? "fr";
    };

    const portadas = new Map(
      mapa
        .filter(({ ruta }) => /^\/(fr|en|es|it)\/$/.test(ruta))
        .map(({ ruta, fichero }) => [ruta.slice(1, -1), fichero]),
    );

    // Algunos clientes OAuth conservan /campo como ruta antigua de acceso.
    // Si llegan parámetros OAuth completos, reenviamos únicamente ese flujo
    // al endpoint real; una visita normal a /campo sigue entrando en la PWA.
    const reenviarOAuthSiEsNecesario = (req: express.Request, res: express.Response, next: express.NextFunction): boolean => {
      // `state` is recommended but optional in OAuth; Claude may omit it in
      // some connector flows. The authorization endpoint validates the rest.
      const required = ["client_id", "redirect_uri", "code_challenge", "code_challenge_method"];
      if (!required.every((key) => typeof req.query[key] === "string" && req.query[key])) {
        next();
        return false;
      }
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === "string") query.set(key, value);
      }
      res.redirect(302, `/api/oauth/authorize?${query.toString()}`);
      return true;
    };

    app.get("/campo", reenviarOAuthSiEsNecesario);

    app.get("/", (req, res, next) => {
      // La PWA usa `/?app=1` para entrar en la pantalla de roles de React.
      // La raíz sin ese parámetro sigue siendo la landing indexable.
      if (reenviarOAuthSiEsNecesario(req, res, () => undefined)) return;
      if (req.query.app === "1") return next();
      const idioma = idiomaDesdeNavegador(req.get("accept-language"));
      const fichero = portadas.get(idioma) ?? portadas.get("fr");
      if (!fichero) return res.sendStatus(503);
      return res.sendFile(path.join(sitioPath, fichero));
    });

    for (const { ruta, fichero } of mapa) {
      // `/fr` sin la barra es lo que la gente escribe. Redirección permanente
      // para que Google no acabe con dos direcciones del mismo contenido.
      //
      // Va **antes** que el archivo y mira el camino de verdad porque Express,
      // sin `strict routing`, atiende `/fr` y `/fr/` con la misma ruta: puesta
      // después, nunca llegaba a ejecutarse y las dos direcciones devolvían la
      // página con un 200. Y puesta antes sin la comprobación, `/fr/` se
      // redirigiría a sí misma para siempre.
      if (ruta.endsWith("/")) {
        app.get(ruta.slice(0, -1), (req, res, next) => {
          if (req.path.endsWith("/")) return next();
          res.redirect(301, ruta);
        });
      }
      app.get(ruta, (_req, res) => res.sendFile(path.join(sitioPath, fichero)));
    }

    for (const fichero of ["estilo.css", "sitio.js", "logo.png"]) {
      app.get(`/sitio/${fichero}`, (_req, res) => res.sendFile(path.join(sitioPath, fichero)));
    }

    /**
     * Las letras del sitio, servidas desde aquí y no desde Google.
     *
     * Un año de caché porque el nombre del archivo lleva el peso y el
     * subconjunto dentro: si algún día cambia el tipo de letra, cambia el
     * nombre, y nadie se queda con el anterior pegado en el navegador.
     *
     * `immutable` es lo que evita que el navegador pregunte «¿sigue siendo
     * esta?» en cada visita — una vuelta al servidor por archivo, que es
     * justo lo que se gana quitándolas de un dominio ajeno.
     */
    app.use(
      "/sitio/fuentes",
      express.static(path.join(sitioPath, "fuentes"), {
        maxAge: "1y",
        immutable: true,
        fallthrough: false,
      }),
    );
    for (const fichero of ["robots.txt", "sitemap.xml"]) {
      app.get(`/${fichero}`, (_req, res) => res.sendFile(path.join(sitioPath, fichero)));
    }

    console.log(`Sitio de presentación: ${mapa.length} páginas`);
  } catch (err) {
    // Sin sitio la aplicación tiene que arrancar igual. Un fallo al generar las
    // páginas de marketing no puede dejar sin panel a quien está facturando.
    console.error("El sitio de presentación no se pudo cargar:", err instanceof Error ? err.message : err);
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
