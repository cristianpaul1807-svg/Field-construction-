/**
 * Las capturas del producto que enseña el sitio, en los cuatro idiomas.
 *
 *     npx vite build && node sitio/capturas.mjs && node sitio/construir.mjs
 *
 * El sitio decía lo que hace el producto; esto lo enseña. Tres pantallas de
 * verdad —la del trabajador, los SAL de una obra y el portal del cliente—
 * sacadas de la aplicación construida, con datos de ejemplo servidos aquí y no
 * de ninguna cuenta real. Si una pantalla cambia, se vuelven a sacar.
 *
 * Los ejemplos son del país de cada idioma: el italiano ve una obra de Roma con
 * su IVA y su bonifico; el francés, el inglés y el español, una de Montreal con
 * TPS y TVQ. Un dibujo de factura con los impuestos de otro país sería otra
 * vez la página escrita para Quebec que esto vino a arreglar.
 *
 * Igual que `imagen-compartir.mjs`, no corre en el despliegue —allí no hay
 * navegador—: se ejecuta aquí y las imágenes se guardan en `sitio/capturas/`.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "../scripts/ancho/medir.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PAQUETE = path.resolve(AQUI, "..", "dist", "public");
const SALIDA = path.join(AQUI, "capturas");
const ANCHO = 390;
const ALTO = 650;

if (!fs.existsSync(path.join(PAQUETE, "index.html"))) {
  console.error("Falta la aplicación construida: corre antes `npx vite build`.");
  process.exit(1);
}
fs.mkdirSync(SALIDA, { recursive: true });

const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const servidor = http.createServer((q, r) => {
  const camino = path.join(PAQUETE, new URL(q.url, "http://x").pathname);
  const existe = camino.startsWith(PAQUETE) && fs.existsSync(camino) && !fs.statSync(camino).isDirectory();
  const fichero = existe ? camino : path.join(PAQUETE, "index.html");
  r.writeHead(200, { "Content-Type": TIPOS[path.extname(fichero)] ?? "application/octet-stream" });
  r.end(fs.readFileSync(fichero));
});
await new Promise((listo) => servidor.listen(0, "127.0.0.1", listo));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

/** Lo de cada país: nombres, dirección, impuestos y el anticipo de la obra. */
const PAIS = {
  CA: {
    negocio: "Construction Lavoie inc.",
    cliente: "Rénovations Tremblay",
    obra: "777 rue Campbell — Rénovation",
    trabajador: "Franck Morel",
    tareas: ["Charpente des murs extérieurs", "Isolation du sous-sol"],
    desglose: (base) => ({ province: "QC", gst: r(base * 0.05), pst: r(base * 0.09975) }),
    impuesto: (base) => r(base * 0.05) + r(base * 0.09975),
    bonifico: null,
  },
  IT: {
    negocio: "Edil Rossi S.r.l.",
    cliente: "Famiglia Rossi",
    obra: "Via Garibaldi 8 — Ristrutturazione",
    trabajador: "Marco Bianchi",
    tareas: ["Rifacimento del bagno", "Massetto e pavimenti"],
    desglose: (base) => ({ country: "IT", ivaAliquota: 10, iva: r(base * 0.1) }),
    impuesto: (base) => r(base * 0.1),
    bonifico: (numero, importe) => ({
      bonus: "ristrutturazione",
      causale: `Pagamento fattura n. ${numero} del 30/09/2026 - per detrazione fiscale ai sensi dell'art. 16-bis D.P.R. 917/1986 - C.F. beneficiario RSSMRA80A01H501U - P.IVA 06363391001`,
      ritenuta: r((importe / 1.22) * 0.11),
      faltaCodiceFiscale: false,
    }),
  },
};
const r = (x) => Math.round(x * 100) / 100;
const IDIOMAS = [
  { codigo: "fr", pais: "CA" },
  { codigo: "en", pais: "CA" },
  { codigo: "es", pais: "CA" },
  { codigo: "it", pais: "IT" },
];

const navegador = await chromium().launch();
const fallos = [];

async function contexto(idioma, almacen) {
  const ctx = await navegador.newContext({
    viewport: { width: ANCHO, height: ALTO },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: idioma === "fr" ? "fr-CA" : idioma === "it" ? "it-IT" : idioma === "es" ? "es-419" : "en-CA",
    timezoneId: idioma === "it" ? "Europe/Rome" : "America/Toronto",
  });
  await ctx.addInitScript(([lang, extra]) => {
    try {
      localStorage.setItem("fsm-language", lang);
      for (const [k, v] of Object.entries(extra.local ?? {})) localStorage.setItem(k, v);
    } catch {}
    if (extra.sesion) {
      const leer = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) {
        const g = leer.call(this, k);
        return g === null && /^sb-.+-auth-token$/.test(String(k)) ? extra.sesion : g;
      };
    }
  }, [idioma, almacen]);
  return ctx;
}

/** Responde a la API con lo que diga `datos`; lo que no esté, lista vacía. */
async function servir(ctx, datos) {
  await ctx.route("**/*", (ruta) => {
    const u = new URL(ruta.request().url());
    if (u.origin !== BASE) return ruta.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    if (!u.pathname.startsWith("/api/")) return ruta.continue();
    const cuerpo = datos(u.pathname, ruta.request().method());
    return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cuerpo === undefined ? [] : cuerpo) });
  });
}

async function guardar(pagina, nombre) {
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(500);
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  if (ancho > ANCHO + 1) fallos.push(`${nombre}: la pantalla se sale (${ancho} px)`);
  await pagina.screenshot({ path: path.join(SALIDA, nombre), type: "jpeg", quality: 82 });
}

/**
 * Un miércoles por la mañana, a la misma hora local en los dos países: el
 * fichaje de las 7:04 y el reloj del navegador parado a las 11:31. Sin el
 * reloj parado, la captura dependía de a qué hora se sacara.
 */
const MANANA = {
  IT: { entrada: "2026-10-14T05:04:00Z", ahora: "2026-10-14T09:31:00Z" },
  CA: { entrada: "2026-10-14T11:04:00Z", ahora: "2026-10-14T15:31:00Z" },
};

for (const { codigo, pais } of IDIOMAS) {
  const P = PAIS[pais];

  // ---- 1. El móvil del trabajador, fichado desde las 7:04 ----
  {
    const sesionTrabajador = JSON.stringify({ token: "t", id: "w1", name: P.trabajador, businessId: "b1", businessName: P.negocio, businessLogoUrl: null, kind: "employee" });
    const ctx = await contexto(codigo, { local: { "fsm-worker-session": sesionTrabajador } });
    await servir(ctx, (camino) => {
      if (camino === "/api/worker/time-entries/active") return { id: "te1", projectId: "p1", projectName: P.obra, checkInTime: MANANA[pais].entrada, serviceType: null };
      if (camino === "/api/worker/projects")
        return P.tareas.map((t, i) => ({ key: `k${i}`, projectId: "p1", name: P.obra, hoy: true, tarea: t, scheduleEventId: null, workOrderId: `o${i}`, serviceType: null, commessa: null }));
      if (camino === "/api/worker/time-entries/history")
        return [1, 2, 3].map((dias) => {
          const entrada = new Date(new Date(MANANA[pais].entrada).getTime() - dias * 86_400_000);
          const salida = new Date(entrada.getTime() + 8.5 * 3_600_000);
          return { id: `h${dias}`, projectId: "p1", projectName: P.obra, checkInTime: entrada.toISOString(), checkOutTime: salida.toISOString(), checkInLocation: null, checkOutLocation: null, checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null, serviceType: null, overtime: false };
        });
      if (camino === "/api/worker/mcp-status") return { conectado: false };
      return undefined;
    });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(new Date(MANANA[pais].ahora));
    p.on("pageerror", (e) => fallos.push(`${codigo}-1: ${String(e).slice(0, 140)}`));
    await p.goto(`${BASE}/campo`, { waitUntil: "networkidle" });
    await p.waitForTimeout(600);
    // La pestaña del fichaje, que es la segunda: la agenda vacía de esta tarde
    // no enseña nada, y el «fichado desde las 7:04» es lo que se viene a ver.
    await p.locator('[role="tab"]').nth(1).click();
    await p.waitForTimeout(700);
    await guardar(p, `${codigo}-1.jpg`);
    await ctx.close();
  }

  // ---- 2. Los SAL de una obra ----
  {
    const caduca = Math.floor(Date.now() / 1000) + 86400;
    const sesion = JSON.stringify({ access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 999999, expires_at: caduca, user: { id: "a", aud: "authenticated", role: "authenticated", email: "demo@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
    const ctx = await contexto(codigo, { sesion });
    const righe = pais === "IT"
      ? [
          { chiave: "l:a", descrizione: "Demolizioni e rimozione rivestimenti", zona: "Bagno", quantita: 1, prezzoUnitario: 2400, importo: 2400, percentualePrecedente: 100 },
          { chiave: "l:b", descrizione: "Impianto idraulico", zona: "Bagno", quantita: 1, prezzoUnitario: 6800, importo: 6800, percentualePrecedente: 60 },
          { chiave: "l:c", descrizione: "Piastrelle gres 60x60", zona: "Bagno", quantita: 28, prezzoUnitario: 95, importo: 2660, percentualePrecedente: 0 },
          { chiave: "l:d", descrizione: "Massetto e pavimento", zona: "Soggiorno", quantita: 64, prezzoUnitario: 120, importo: 7680, percentualePrecedente: 25 },
        ]
      : [
          { chiave: "l:a", descrizione: "Démolition et préparation", zona: "Sous-sol", quantita: 1, prezzoUnitario: 4800, importo: 4800, percentualePrecedente: 100 },
          { chiave: "l:b", descrizione: "Charpente des murs extérieurs", zona: "Extérieur", quantita: 1, prezzoUnitario: 18500, importo: 18500, percentualePrecedente: 60 },
          { chiave: "l:c", descrizione: "Isolation et pare-vapeur", zona: "Sous-sol", quantita: 92, prezzoUnitario: 85, importo: 7820, percentualePrecedente: 0 },
          { chiave: "l:d", descrizione: "Gypse et finition", zona: "Sous-sol", quantita: 110, prezzoUnitario: 160, importo: 17600, percentualePrecedente: 25 },
        ];
    const contratto = r(righe.reduce((s, x) => s + x.importo, 0));
    const cumulato = r(righe.reduce((s, x) => s + (x.importo * x.percentualePrecedente) / 100, 0));
    const acconti = r(contratto * 0.2);
    const primero = r(cumulato * 0.45);
    await servir(ctx, (camino) => {
      if (camino === "/api/auth/me") return { persona: "business", businessId: "b1", areas: null, plan: "entreprise", subscriptionStatus: "active", trialEndsAt: null, country: pais };
      if (camino === "/api/settings/company") return { id: "b1", name: P.negocio, country: pais, province: pais === "IT" ? "RM" : "QC", taxConfig: null, holdbackPercent: pais === "IT" ? 0 : 10 };
      if (camino === "/api/projects/p1/sal")
        return {
          righe,
          contratto,
          acconti,
          accontoGiaRecuperato: r((acconti * cumulato) / contratto),
          cumulatoPrecedente: cumulato,
          sal: [
            { id: "s1", numero: 1, data: "2026-08-31", importoCumulato: primero, importo: primero, recuperoAcconto: r((acconti * primero) / contratto), note: null, invoiceId: "f1", invoiceNumber: "2026-0011", invoiceStatus: "pagado" },
            { id: "s2", numero: 2, data: "2026-09-30", importoCumulato: cumulato, importo: r(cumulato - primero), recuperoAcconto: r((acconti * (cumulato - primero)) / contratto), note: null, invoiceId: null, invoiceNumber: null, invoiceStatus: null },
          ],
        };
      if (camino === "/api/projects/p1/congruita") return { estado: "congrua", categoria: "ristrutturazione_civile", indice: 0.22, valoreOpera: contratto, minima: r(contratto * 0.22), manodopera: r(contratto * 0.24), incidenza: 0.24, falta: 0, lavoroPubblico: false, valoreManuale: null, valoreContratto: contratto, oreSenzaCosto: 0 };
      if (camino === "/api/projects/p1")
        return { id: "p1", clientId: "c1", clientName: P.cliente, clientAddress: null, projectAddress: null, estimateId: "e1", estimateTotal: contratto, name: P.obra, type: null, status: "en_progreso", lifecycle: null, bonusFiscale: null, progressPercent: 55, startDate: "2026-08-03", endDate: "2026-11-27", team: [], estimateLines: [], expenses: [], documents: [], photos: [], scheduleEvents: [], changeOrders: [] };
      return undefined;
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => fallos.push(`${codigo}-2: ${String(e).slice(0, 140)}`));
    await p.goto(`${BASE}/projects/p1`, { waitUntil: "networkidle" });
    await p.waitForTimeout(600);
    const pestana = p.locator('[role="tab"][id$="-trigger-sal"]');
    await pestana.scrollIntoViewIfNeeded();
    await pestana.click();
    await p.waitForTimeout(600);
    // La tarjeta arriba de la pantalla: es lo que se viene a ver.
    await p.evaluate(() => {
      const tarjeta = document.querySelector('[role="tabpanel"][data-state="active"]');
      if (!tarjeta) return;
      // El panel se desplaza dentro de su propio contenedor, no en la
      // ventana: se lleva la tarjeta arriba de ese contenedor, con aire.
      tarjeta.scrollIntoView({ block: "start" });
      let caja = tarjeta.parentElement;
      while (caja && caja.scrollHeight <= caja.clientHeight) caja = caja.parentElement;
      // Y por debajo de la cabecera fija, que si no tapa el título.
      const fijas = [...document.querySelectorAll("body *")].filter((e) => {
        const pos = getComputedStyle(e).position;
        const caja2 = e.getBoundingClientRect();
        return (pos === "fixed" || pos === "sticky") && caja2.top <= 0 && caja2.height < 160 && caja2.width > 300;
      });
      const cabecera = Math.max(0, ...fijas.map((e) => e.getBoundingClientRect().bottom));
      (caja ?? document.scrollingElement)?.scrollBy(0, -(cabecera + 10));
    });
    await guardar(p, `${codigo}-2.jpg`);
    await ctx.close();
  }

  // ---- 3. El portal del cliente ----
  {
    const ctx = await contexto(codigo, { local: { "fsm-client-session": JSON.stringify({ token: "c", id: "c1", name: P.cliente, businessId: "b1" }) } });
    const base = pais === "IT" ? 4000 : 14625;
    const numero = "2026-0014";
    const importe = r(base + P.impuesto(base) - (pais === "CA" ? base * 0.1 : 0));
    await servir(ctx, (camino) => {
      if (camino === "/api/client-portal/me")
        return {
          client: { id: "c1", name: P.cliente },
          project: {
            id: "p1",
            name: P.obra,
            progressPercent: 55,
            status: "en_progreso",
            lifecycle: null,
            paymentSchedule: [],
          },
          estimate: { id: "e1", number: "EST-2026-0007", status: "aceptado", total: base * 4, taxAmount: P.impuesto(base * 4), totalWithTax: r(base * 4 + P.impuesto(base * 4)), taxBreakdown: P.desglose(base * 4), signature: { name: P.cliente, signedAt: "2026-08-01T09:14:00Z", total: base * 4 } },
          pendingInvoice: { id: "f2", number: numero, type: "parcial", amount: importe, status: "pendiente", bonifico: P.bonifico ? P.bonifico(numero, importe) : null },
          business: { name: P.negocio, logoUrl: null, country: pais },
          visiblePhotos: [],
        };
      return undefined;
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => fallos.push(`${codigo}-3: ${String(e).slice(0, 140)}`));
    await p.goto(`${BASE}/portal`, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    await guardar(p, `${codigo}-3.jpg`);
    await ctx.close();
  }
}

await navegador.close();
servidor.close();

if (fallos.length) {
  console.error("Capturas con problemas:\n" + fallos.map((f) => `  · ${f}`).join("\n"));
  process.exit(1);
}
console.log(`capturas ok — ${IDIOMAS.length * 3} en ${SALIDA}`);
