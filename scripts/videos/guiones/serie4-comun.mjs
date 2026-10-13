/**
 * Lo que comparten los vídeos de la serie 4 (el programa de afiliados): dónde
 * se graba, el panel de ejemplo y la tarjeta final de los Shorts.
 *
 * Esta serie no le habla al contratista sino a quien lo conoce —un creador,
 * un contable, un proveedor, un antiguo del oficio—, y es la única que se
 * graba sobre el paquete construido en este disco, y no sobre la aplicación
 * publicada:
 *
 * - El panel de un afiliado de verdad sale vacío el primer día, y un panel
 *   con clientes inventados no se puede sembrar en producción: serían
 *   comisiones de mentira en las mismas tablas de las que se paga.
 * - Así que el panel lleva un ejemplo, contestado desde aquí, y el vídeo lo
 *   dice («voici un exemple») antes de enseñarlo.
 * - El formulario de alta se rellena pero no se envía: no se crea ninguna
 *   cuenta ni se firma ningún contrato de verdad.
 *
 *   npm run build
 *   node scripts/videos/grabar.mjs serie4-largo fr
 *
 * No es un guion (no tiene `pasos`): `--todos` lo salta.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const APP = path.join(RAIZ, "dist", "public");
const SITIO = path.join(RAIZ, "sitio", "publico");
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };

/** El primer fichero que exista de la lista, o null. */
const primero = (...candidatos) => candidatos.find((f) => fs.existsSync(f) && fs.statSync(f).isFile()) ?? null;

/**
 * El fichero que serviría producción para un camino: `/sitio/…` y `/fr/…`
 * del generador del sitio, todo lo demás del paquete, con vuelta al index
 * para las rutas de la aplicación.
 */
function ficheroDe(camino) {
  if (camino.startsWith("/sitio/")) return primero(path.join(SITIO, camino.slice("/sitio/".length)));
  if (/^\/(fr|it|en|es)(\/|$)/.test(camino)) {
    const base = path.join(SITIO, camino);
    return primero(base, `${base}.html`, path.join(base, "index.html"));
  }
  return primero(path.join(APP, camino)) ?? path.join(APP, "index.html");
}

/** Hace `dias` días, en ISO: el panel de ejemplo siempre parece de esta semana. */
const hace = (dias) => new Date(Date.now() - dias * 86_400_000).toISOString();

/**
 * Un afiliado con cuatro empresas pagando, dos en prueba y una que no siguió.
 *
 * Las cifras cuadran entre sí, como cuadrarían en el panel de verdad: tres
 * empresas en el plan Chantier (99 $ → 29,70 $ al mes) y una en Entreprise
 * (249 $ → 74,70 $); lo de este mes espera, lo del anterior está disponible,
 * y lo de antes ya se cobró. Quien pare el vídeo y sume, que le salga.
 */
export function panelDeEjemplo(idioma) {
  const nombres = {
    fr: { afiliado: "Julie Gagnon", clientes: ["Réno••••", "Toit••••", "Plom••••", "Cons••••", "Élec••••", "Exca••••", "Revê••••"] },
    it: { afiliado: "Giulia Ferri", clientes: ["Edil••••", "Ristr••••", "Impi••••", "Cost••••", "Elet••••", "Scav••••", "Pavi••••"] },
  }[idioma];
  const n = nombres.clientes;
  const mes = (m) => hace(30 * m + 3);
  const listaDeClientes = [
    { nombre: n[0], llegoEn: hace(128), etapa: "pagando", hasta: hace(-240), ganadoCad: 118.8, anuladoCad: 0 },
    { nombre: n[1], llegoEn: hace(98), etapa: "pagando", hasta: hace(-270), ganadoCad: 89.1, anuladoCad: 0 },
    { nombre: n[2], llegoEn: hace(70), etapa: "pagando", hasta: hace(-300), ganadoCad: 59.4, anuladoCad: 0 },
    { nombre: n[3], llegoEn: hace(66), etapa: "pagando", hasta: hace(-300), ganadoCad: 149.4, anuladoCad: 0 },
    { nombre: n[4], llegoEn: hace(9), etapa: "prueba", hasta: hace(-21), ganadoCad: 0, anuladoCad: 0 },
    { nombre: n[5], llegoEn: hace(4), etapa: "prueba", hasta: hace(-26), ganadoCad: 0, anuladoCad: 0 },
    { nombre: n[6], llegoEn: hace(51), etapa: "prueba_vencida", hasta: hace(21), ganadoCad: 0, anuladoCad: 0 },
  ];
  const comision = (periodo, importeCad, estado, disponibleEn) => ({ periodo, importeCad, estado, disponibleEn });
  return {
    codigo: idioma === "it" ? "GIULIA7K" : "JULIE7K2",
    nombre: nombres.afiliado,
    estado: "activo",
    comisionPct: 30,
    meses: 12,
    diasDeEspera: 30,
    minimoCad: 50,
    pais: idioma === "it" ? "IT" : "CA",
    stripeConectado: true,
    cobroListo: true,
    firmado: true,
    contrato: { fecha: hace(130), nombre: nombres.afiliado, version: "2026-10" },
    clientes: { total: 7, enPrueba: 2, pagando: 4 },
    listaDeClientes,
    enEsperaCad: 163.8,
    disponibleCad: 163.8,
    pagadoCad: 89.1,
    ultimasComisiones: [
      ...[74.7, 29.7, 29.7, 29.7].map((x) => comision(mes(0), x, "en_espera", hace(-27))),
      ...[74.7, 29.7, 29.7, 29.7].map((x) => comision(mes(1), x, "disponible", hace(3))),
      comision(mes(2), 29.7, "pagada", hace(33)),
      comision(mes(2), 29.7, "pagada", hace(33)),
      comision(mes(3), 29.7, "pagada", hace(63)),
    ],
    pagos: [{ importeCad: 89.1, estado: "enviado", fecha: hace(20) }],
  };
}

/** Lo que contesta la API mientras se graba. Lo que no está aquí, `[]`, como en comprobar-ancho-panel: lo que espera una lista. */
function respuestas(idioma) {
  return {
    "/api/public/afiliados/programa": { comisionPct: 30, meses: 12, diasDeEspera: 30, minimoCad: 50 },
    "/api/auth/me": { persona: "affiliate" },
    "/api/afiliados/panel": panelDeEjemplo(idioma),
  };
}

/** Una sesión que no caduca mientras dura la grabación. */
function sesion() {
  const dentroDeUnAno = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  return JSON.stringify({
    access_token: "grabacion",
    refresh_token: "grabacion",
    token_type: "bearer",
    expires_in: 365 * 24 * 3600,
    expires_at: dentroDeUnAno,
    user: { id: "afiliado-de-ejemplo", aud: "authenticated", role: "authenticated", email: "ejemplo@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  });
}

/**
 * Contestar a la clave de sesión de Supabase, sea cual sea su nombre (lleva
 * dentro el identificador del proyecto). La misma idea que
 * scripts/comprobar-ancho-panel.mjs.
 */
function sembrarSesion(valor) {
  if (!sessionStorage.getItem("lc-sesion-de-ejemplo")) return;
  const leer = Storage.prototype.getItem;
  Storage.prototype.getItem = function (clave) {
    const guardado = leer.call(this, clave);
    if (guardado === null && /^sb-.+-auth-token$/.test(String(clave))) return valor;
    return guardado;
  };
}

/**
 * Antes de nada: la API contestada desde aquí, y nada que salga a internet
 * salvo las fuentes.
 *
 * Las páginas tampoco salen: el navegador pide logiciel-construction.com y
 * se le contesta con el paquete de este disco. Así el enlace del panel dice
 * `logiciel-construction.com/?ref=…`, que es lo que el afiliado va a
 * compartir, y no la dirección de un servidor local.
 *
 * La sesión de ejemplo queda preparada pero apagada: con ella puesta, la
 * puerta de afiliados mandaría al panel en vez de enseñarse. `conSesion()`
 * la enciende para la siguiente carga.
 */
export async function prepararGrabacion({ pagina, BASE, idioma }) {
  if (!fs.existsSync(path.join(APP, "index.html"))) throw new Error("no hay paquete: corre `npm run build` antes");
  const origen = new URL(BASE).origin;
  const api = respuestas(idioma);
  const contexto = pagina.context();
  await contexto.addInitScript(sembrarSesion, sesion());
  await contexto.route("**/*", (ruta) => {
    const url = new URL(ruta.request().url());
    if (url.origin === origen) {
      if (url.pathname.startsWith("/api/")) {
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(api[url.pathname] ?? []) });
      }
      const fichero = ficheroDe(decodeURIComponent(url.pathname));
      return ruta.fulfill({ status: 200, contentType: TIPOS[path.extname(fichero)] ?? "application/octet-stream", body: fs.readFileSync(fichero) });
    }
    if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.host)) return ruta.continue();
    return ruta.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

export const conSesion = (pagina) => pagina.evaluate(() => sessionStorage.setItem("lc-sesion-de-ejemplo", "1"));

/**
 * Abrir el panel de ejemplo sin que se vea entrar: la sesión necesita una
 * página del sitio en la que guardarse antes de la carga que la usa.
 */
export async function abrirPanelDeEjemplo({ pagina, BASE, idioma }) {
  await pagina.goto(`${BASE}/afiliados?lang=${idioma}`, { waitUntil: "networkidle" });
  await conSesion(pagina);
  await pagina.goto(`${BASE}/afiliados/panel`, { waitUntil: "networkidle" });
}

/**
 * Los textos de la pantalla de afiliados, para buscar cada parte por lo que
 * dice: si alguien cambia una frase, el guion la sigue encontrando.
 */
export const etiquetas = (idioma) =>
  JSON.parse(fs.readFileSync(path.join(RAIZ, "client", "src", "i18n", "locales", `${idioma}.json`), "utf8")).afiliados;

/** Una tarjeta del panel, por un texto que lleva dentro. */
export const tarjetaCon = (pagina, texto) => pagina.locator('[data-slot="card"]').filter({ hasText: texto }).first();

/** Lo que se teclea en el formulario de alta, que no se llega a enviar. */
export const ALTA = {
  fr: {
    correo: "julie.gagnon@example.com",
    clave: "exemple-video-2026",
    nombre: "Julie Gagnon",
    donde: "Ma chaîne YouTube et mes groupes Facebook de rénovation",
    firma: "Julie Gagnon",
  },
  it: {
    correo: "giulia.ferri@example.com",
    clave: "esempio-video-2026",
    nombre: "Giulia Ferri",
    donde: "Il mio canale YouTube e i gruppi Facebook di ristrutturazione",
    firma: "Giulia Ferri",
  },
};

/** Una firma con el dedo: un trazo seguido, como lo haría una mano. */
export async function firmarConElDedo(pagina, lienzo, pausa) {
  await lienzo.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
  await pausa(450);
  const c = await lienzo.boundingBox();
  if (!c) throw new Error("no se ve el recuadro de la firma");
  const punto = (x, y) => [c.x + c.width * x, c.y + c.height * y];
  const trazo = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    trazo.push(punto(0.12 + 0.7 * t, 0.55 - 0.22 * Math.sin(t * Math.PI * 3.2) * (1 - t * 0.4)));
  }
  await pagina.mouse.move(...trazo[0], { steps: 12 });
  await pagina.mouse.down();
  for (const p of trazo) await pagina.mouse.move(...p, { steps: 2 });
  await pagina.mouse.up();
  await pausa(300);
}

export const FINAL_SERIE4 = {
  fr: {
    sobre: "Programme d'affiliation",
    titulo: "Recommandez. *Touchez 30 %* pendant 12 mois.",
    texto: "Inscription gratuite, contrat clair, paiement par Stripe dès 50 $.",
    pie: "<b>logiciel-construction.com/afiliados</b> · lien dans la description",
  },
  it: {
    sobre: "Programma di affiliazione",
    titulo: "Consiglia. *Guadagna il 30 %* per 12 mesi.",
    texto: "Iscrizione gratuita, contratto chiaro, pagamento con Stripe da 50 $.",
    pie: "<b>logiciel-construction.com/afiliados</b> · link nella descrizione",
  },
};
