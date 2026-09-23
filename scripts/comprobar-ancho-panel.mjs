/**
 * Que ninguna pantalla del panel se salga en un móvil.
 *
 *   npm run build && node scripts/comprobar-ancho-panel.mjs
 *
 * `comprobar-ancho.mjs` mide las 28 páginas públicas. El panel se quedó fuera
 * cuando se escribió aquello —necesita sesión— y nunca volvió, así que **la
 * mitad del producto que más se usa era la que nadie medía**. Los cuatro
 * problemas de maquetación de esta semana los encontró el dueño abriendo su
 * móvil, no una prueba.
 *
 * ## Cómo entra sin cuenta
 *
 * Se sirve el paquete ya construido y se le miente en tres sitios, todos en el
 * navegador y ninguno en el código del producto:
 *
 * - Cualquier lectura de la clave de sesión de Supabase devuelve una sesión con
 *   caducidad lejana, así que `supabase-js` se da por satisfecho sin salir a la
 *   red.
 * - Cada `/api/…` contesta con datos de pega.
 * - Nada que no sea este servidor local llega a ninguna parte.
 *
 * La sesión se reconoce **por la forma de la clave** (`sb-…-auth-token`), no
 * por su nombre exacto. La primera versión de esto sembraba
 * `sb-pruebas-auth-token` a juego con un `/api/public/config` de mentira, y
 * pasó en verde midiendo 62 veces la pantalla de entrada: el paquete lleva
 * `VITE_SUPABASE_URL` dentro desde que se construye, así que nunca se pregunta
 * al servidor y la clave de verdad llevaba el identificador del proyecto real.
 * Escrita así, la prueba sobrevive a que ese proyecto cambie y a que alguien
 * ponga un `storageKey` propio.
 *
 * ## Los datos de pega son largos a propósito
 *
 * Una lista vacía cabe siempre. Lo que rompe una fila es un nombre largo, un
 * correo largo o un número de cinco cifras, así que las fixturas los llevan —
 * si no, esto pasaría en verde justo con los casos que fallan de verdad.
 *
 * ## Lo que esto no sustituye
 *
 * Abrirlo en un móvil. Aquí no hay teclado que suba, ni notificación que
 * empuje, ni una obra con el sol dando en la pantalla.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ANCHOS, chromium, medir } from "./ancho/medir.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PAQUETE = path.resolve(AQUI, "..", "dist", "public");

/** Las del panel que se abren solas, sin pasar por un detalle de algo. */
const PANTALLAS = [
  "/",
  "/crm",
  "/projects",
  "/budgets",
  "/invoicing",
  "/materials",
  "/cost-tracking",
  "/payroll",
  "/reports",
  "/technicians",
  "/subcontractors",
  "/work-orders",
  "/work-log",
  "/scheduling",
  "/time-off",
  "/contracts",
  "/photo-gallery",
  "/gps-routing",
  "/check-in",
  "/client-portal",
  "/communication",
  "/suscripcion",
  "/settings/company",
  "/settings/users",
  "/settings/payments",
  "/settings/quickbooks",
  "/settings/margins",
  "/settings/service-types",
  "/settings/whatsapp",
  "/settings/mcp-connections",
  "/settings/afiliados",
];

/** Lo único que se deja salir a la red. Las fuentes deciden el ancho del texto. */
const FUERA = ["fonts.googleapis.com", "fonts.gstatic.com"];

const LARGO = "Construcciones y Reformas Integrales del Valle del Saint-Laurent";
const CORREO = "administracion.general.contabilidad@construccionesdelvalle.example.com";

/**
 * Lo que contesta cada familia de la API.
 *
 * Lo que no esté aquí contesta `[]`, que es lo correcto: una pantalla sin
 * datos también tiene que caber, y así una ruta nueva no rompe la prueba.
 */
const FIXTURAS = {
  "/api/auth/me": {
    persona: "business",
    businessId: "b-1",
    areas: null,
    plan: "entreprise",
    subscriptionStatus: "active",
    trialEndsAt: null,
    subscriptionPeriodEnd: "2027-01-01T00:00:00Z",
  },
  "/api/settings/users": {
    users: [
      { id: "u-1", name: LARGO, email: CORREO, phone: "+1 514 555 0199", areas: null, status: "activo", mcpActive: true },
      { id: "u-2", name: "Ana", email: "ana@x.ca", phone: null, areas: ["campo"], status: "invitado", mcpActive: false },
    ],
    roles: [],
  },
  "/api/settings/afiliados": {
    tieneEnlace: true,
    codigo: "ABCD2345",
    estado: "activo",
    firmado: false,
    comisionPct: 10,
    referidos: 12,
    pagando: 4,
    devengadoCad: 1234.56,
    pagadoCad: 987.65,
  },
  "/api/settings/mcp-connections": {
    mcpUrl: "https://logiciel-construction.com/mcp",
    scope: "mcp:read",
    platforms: [
      {
        id: "claude",
        name: "Claude",
        description: "Conecta Claude con los datos autorizados.",
        docsUrl: "https://claude.ai",
        configured: true,
        clients: [{ clientId: "mcp_client_f59f1cba-94d9-4f63-bb50-424910da142b", clientName: "Claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback"], tokenEndpointAuthMethod: "none", createdAt: "2026-09-01T00:00:00Z", valid: true }],
        connections: [{ id: "c-1", status: "active", scopes: ["mcp:read"], createdAt: "2026-09-01T00:00:00Z", lastUsedAt: "2026-09-22T00:00:00Z", revokedAt: null, quien: { tipo: "empleado", nombre: LARGO }, viva: true }],
      },
    ],
  },
  // Las tres que siguen contestan un objeto, no una lista. Con `[]` la pantalla
  // reventaba y el guardia la daba por buena: un aviso de error cabe de sobra.
  "/api/materials": {
    materials: [
      { id: "m-1", name: "Contreplaqué traité sous pression 19 mm — qualité extérieure", unit: "feuille", price: 128.45, category: "bois", supplier: LARGO, isReferenceOnly: false, sku: "CTP-19-EXT-1220x2440", description: null },
      { id: "m-2", name: "Vis", unit: null, price: null, category: null, supplier: null, isReferenceOnly: true, sku: null, description: null },
    ],
    laborRates: [
      { id: "l-1", name: "Charpentier-menuisier compagnon — quart de nuit", hourlyRate: 62.5 },
      { id: "l-2", name: "Peón", hourlyRate: 24 },
    ],
    subcontractors: [{ id: "s-1", name: LARGO, trade: "Électricité et domotique résidentielle", rating: 5 }],
  },
  "/api/reports": {
    revenueByMonth: [
      { month: "2026-07", ingresos: 128450.75, gastos: 98120.4 },
      { month: "2026-08", ingresos: 214900.0, gastos: 150300.25 },
      { month: "2026-09", ingresos: 98750.5, gastos: 77400.1 },
    ],
    totalRevenue: 442101.25,
    totalExpense: 325820.75,
    profit: 116280.5,
    activeProjects: 14,
    completedProjects: 137,
    revenueByChargeKind: { proyecto: 398000.25, extra: 44101.0 },
    hoursByEmployee: [{ name: LARGO, horas: 1284.5 }, { name: "Ana", horas: 12 }],
    topMaterials: [{ name: "Contreplaqué traité sous pression 19 mm", unit: "feuille", totalQuantity: 1250 }],
  },
  // Cobros pendientes por antigüedad. Los tramos van con dinero dentro porque
  // la fila sólo pinta los que no están a cero: vacíos no se mide ninguna.
  "/api/reports/receivables": {
    total: 184320.55,
    buckets: { corriente: 42000.0, d1_30: 61200.3, d31_60: 38450.25, d61_90: 22670.0, d90_mas: 20000.0 },
    holdbackOutstanding: 18432.05,
    clients: [
      { clientId: "c-1", clientName: LARGO, clientEmail: CORREO, total: 142320.55, buckets: { corriente: 30000, d1_30: 51200.3, d31_60: 30450.25, d61_90: 20670, d90_mas: 10000 }, oldestDaysOverdue: 124, invoiceCount: 18 },
      { clientId: "c-2", clientName: null, clientEmail: null, total: 42000, buckets: { corriente: 12000, d1_30: 10000, d31_60: 8000, d61_90: 2000, d90_mas: 10000 }, oldestDaysOverdue: 95, invoiceCount: 3 },
    ],
  },
  "/api/settings/company": {
    id: "b-1",
    name: LARGO,
    slug: "construcciones-y-reformas-integrales-del-valle",
    licenseNumber: "5678-1234-01",
    taxConfig: { region: "QC", rate: 14.975 },
    country: "CA",
    province: "QC",
    address: "1234, boulevard Saint-Laurent, bureau 5600, Montréal (Québec) H2X 2S8",
    phone: "+1 514 555 0199",
    email: CORREO,
    gstNumber: "123456789 RT0001",
    qstNumber: "1234567890 TQ0001",
    holdbackPercent: 10,
    estimateTerms: null,
    logoUrl: null,
    estimateShowMaterials: true,
    estimateShowSchedule: true,
    ccqEmployerNumber: "0123456",
    ccqSubject: true,
  },
  "/api/canada-tax-rates": [
    { province: "QC", label: "Québec", isHst: false, gstRate: 5, pstRate: 9.975, hstRate: 0 },
    { province: "ON", label: "Ontario", isHst: true, gstRate: 0, pstRate: 0, hstRate: 13 },
  ],
  "/api/subscription": {
    plan: "entreprise",
    estado: "active",
    periodo: "mes",
    renuevaEl: "2027-01-01T00:00:00Z",
    seCancelaAlFinal: false,
    pruebaHasta: null,
    tienePortal: true,
    precios: { chantier: { mes: 99, ano: 990, moneda: "CAD" }, entreprise: { mes: 249, ano: 2490, moneda: "CAD" } },
    sePuedeCobrar: true,
    porQueNo: null,
    clavesQueFaltan: [],
  },
};

const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

/** El paquete, con vuelta al index para cualquier ruta del panel. */
function servidor() {
  return http.createServer((req, res) => {
    const camino = new URL(req.url, "http://x").pathname;
    const destino = path.join(PAQUETE, camino);
    const existe = destino.startsWith(PAQUETE) && fs.existsSync(destino) && !fs.statSync(destino).isDirectory();
    const fichero = existe ? destino : path.join(PAQUETE, "index.html");
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(fichero)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(fichero));
  });
}

/**
 * Las fuentes web que la página pidió y no llegaron.
 *
 * Hoy no hay ninguna —el panel va con la letra del sistema— así que esto no
 * mira nada y pasa. No se comprueba contra una lista escrita a mano a
 * propósito: una lista se queda vieja en silencio, y en el momento en que
 * alguien ponga una fuente, este guardia empieza a exigirla solo. Medir con la
 * letra de reserva da un ancho que nadie ve, y es justo el fallo que esto
 * existe para encontrar.
 */
async function fuentesQueFaltan(pagina) {
  await pagina.evaluate(() => document.fonts.ready);
  return pagina.evaluate(() =>
    [...document.fonts].filter((f) => f.status !== "loaded").map((f) => `${f.family} ${f.weight}`),
  );
}

/** Una sesión que no caduca en lo que dura la prueba. */
function sesion() {
  const dentroDeUnAno = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  return JSON.stringify({
    access_token: "token-de-pruebas",
    refresh_token: "refresco-de-pruebas",
    token_type: "bearer",
    expires_in: 365 * 24 * 3600,
    expires_at: dentroDeUnAno,
    user: { id: "auth-1", aud: "authenticated", role: "authenticated", email: CORREO, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  });
}

/**
 * Contestar a la clave de sesión sea cual sea su nombre.
 *
 * Corre antes que nada en la página. `supabase-js` compone la clave con el
 * identificador del proyecto, que el paquete lleva dentro desde que se
 * construye y aquí no se sabe; reconocerla por la forma evita tener que
 * saberlo.
 */
function sembrarSesion(valor) {
  const esLaDeSupabase = (clave) => /^sb-.+-auth-token$/.test(String(clave));
  const leer = Storage.prototype.getItem;
  Storage.prototype.getItem = function (clave) {
    const guardado = leer.call(this, clave);
    if (guardado === null && esLaDeSupabase(clave)) return valor;
    return guardado;
  };
}

async function main() {
  if (!fs.existsSync(path.join(PAQUETE, "index.html"))) {
    console.error("No hay paquete que medir. Corre `npm run build` antes.");
    process.exit(1);
  }

  const srv = servidor();
  await new Promise((listo) => srv.listen(0, "127.0.0.1", listo));
  const base = `http://127.0.0.1:${srv.address().port}`;

  const navegador = await chromium().launch();
  const fallos = [];
  let miradas = 0;
  let comprobadasLasFuentes = false;

  for (const ancho of ANCHOS) {
    const contexto = await navegador.newContext({ viewport: { width: ancho, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    await contexto.addInitScript(sembrarSesion, sesion());

    // Fuera de este servidor sólo pasan las fuentes: son las que deciden el
    // ancho del texto y medir con la letra de reserva daría un número que nadie
    // va a ver. El Supabase de verdad, en cambio, viene dentro del paquete y
    // hay que cortarlo — una prueba de maquetación no toca la base de datos.
    await contexto.route("**/*", (ruta) => {
      const url = new URL(ruta.request().url());
      if (url.origin === base) {
        if (!url.pathname.startsWith("/api/")) return ruta.continue();
        const cuerpo = FIXTURAS[url.pathname] ?? [];
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cuerpo) });
      }
      if (FUERA.some((host) => url.host === host)) return ruta.continue();
      ruta.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    const pagina = await contexto.newPage();

    for (const pantalla of PANTALLAS) {
      await pagina.goto(base + pantalla, { waitUntil: "networkidle" });

      // Que haya pintado algo y que sea **esta** pantalla. Sin la segunda
      // mitad, la sesión de pega puede dejar de colar y esto se pasa la vida
      // midiendo la pantalla de entrada, que cabe de sobra: 62 verdes
      // seguidos sin haber mirado el panel ni una vez. Se corta la prueba en
      // vez de apuntarlo como un ancho que se sale, porque no es un problema
      // de maquetación: es que no hay nada medido.
      try {
        await pagina.waitForFunction(
          (esperada) => (document.getElementById("root")?.childElementCount ?? 0) > 0 && location.pathname === esperada,
          pantalla,
          { timeout: 15_000 },
        );
      } catch {
        console.error(`\n${pantalla} no se abrió: acabó en ${new URL(pagina.url()).pathname}.`);
        console.error("Si es la entrada, la sesión de pega ya no cuela y esto no está midiendo el panel.\n");
        await navegador.close();
        srv.close();
        process.exit(1);
      }

      // Una pantalla que ha reventado enseña un aviso estrecho que cabe en
      // cualquier móvil, así que se pasaría por buena sin haber medido nada de
      // lo que se quería medir. Pasó con tres —`/materials`, `/reports` y
      // `/settings/company`— porque sus fixturas devolvían una lista donde la
      // API devuelve un objeto.
      if (await pagina.locator("[data-error-boundary]").count()) {
        const traza = (await pagina.locator("[data-error-boundary] pre").first().innerText().catch(() => "")).split("\n")[0];
        console.error(`\n${pantalla} reventó al pintarse: ${traza}`);
        console.error("Mientras reventada no se mide: el aviso de error cabe siempre.\n");
        await navegador.close();
        srv.close();
        process.exit(1);
      }

      if (!comprobadasLasFuentes) {
        const faltan = await fuentesQueFaltan(pagina);
        if (faltan.length) {
          console.error(`No cargaron las fuentes (${faltan.join(", ")}). Medir con la letra de reserva daría un ancho que nadie va a ver.`);
          await navegador.close();
          srv.close();
          process.exit(1);
        }
        comprobadasLasFuentes = true;
      }

      await pagina.evaluate(() => document.fonts.ready);

      miradas += 1;
      const mal = await medir(pagina);
      if (mal) {
        fallos.push(`  · ${pantalla} a ${ancho}px — ocupa ${Math.round(mal.ocupa)} y caben ${mal.cabe}\n` + mal.quien.map((q) => `      ${q}`).join("\n"));
      }

      // Y cada ficha desplegada, de una en una. Lo que el dueño encontró en su
      // móvil —los botones de una ficha de usuario saliéndose— estaba dentro
      // de una que hay que abrir, así que medir sólo lo cerrado habría pasado
      // en verde justo por encima del fallo que hizo escribir esto.
      //
      // De una en una y no todas a la vez por dos motivos: varias pantallas
      // sólo dejan una abierta —abrir la segunda cierra la primera, así que
      // «todas» acaba siendo «la última»— y así el fallo dice cuál es.
      // Sólo las de dentro de `main`: los menús de la cabecera se cierran unos
      // a otros y lo que enseñan flota por encima, que no es esto.
      const fichas = pagina.locator('main [aria-expanded="false"]');
      const cuantas = Math.min(await fichas.count(), 8);
      for (let i = 0; i < cuantas; i += 1) {
        // `nth(i)` y no `nth(0)`: como cada una se cierra al terminar, la lista
        // de cerradas vuelve a ser la de antes y hay que avanzar a mano. Con
        // `nth(0)` se abría siempre la misma y las demás no se miraban nunca.
        const ficha = pagina.locator('main [aria-expanded="false"]').nth(i);
        const nombre = (await ficha.innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 30);
        if (!(await ficha.click({ timeout: 2000 }).then(() => true).catch(() => false))) break;
        await pagina.waitForTimeout(120);

        miradas += 1;
        const malAbierta = await medir(pagina);
        if (malAbierta) {
          fallos.push(`  · ${pantalla} a ${ancho}px, con «${nombre}» abierta — ocupa ${Math.round(malAbierta.ocupa)} y caben ${malAbierta.cabe}\n` + malAbierta.quien.map((q) => `      ${q}`).join("\n"));
        }

        // Cerrarla deja la pantalla como estaba para la siguiente. Si no se
        // puede, se sigue: lo que quede abierto también es un estado real.
        await pagina.locator('main [aria-expanded="true"]').first().click({ timeout: 2000 }).catch(() => {});
        await pagina.waitForTimeout(80);
      }
    }

    await contexto.close();
  }

  await navegador.close();
  srv.close();

  if (fallos.length) {
    console.error(`\nSe salen ${fallos.length} de ${miradas}:\n`);
    console.error(fallos.join("\n\n"));
    console.error("\nEn un móvil eso se arrastra de lado, que es donde se lee esto.\n");
    process.exit(1);
  }

  console.log(`ancho del panel ok — ${miradas} vistas, ninguna se sale en ${ANCHOS.join(" ni ")} px`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
