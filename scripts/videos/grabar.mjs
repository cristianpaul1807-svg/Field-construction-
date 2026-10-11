/**
 * Grabar los vídeos tutoriales del producto, uno por función y por idioma.
 *
 *   node scripts/videos/grabar.mjs <guion> <idioma>      (ej.: sitio it)
 *   node scripts/videos/grabar.mjs --todos <idioma>
 *
 * Cada guion (`scripts/videos/guiones/*.mjs`) es la función de verdad usada
 * de verdad: entra en la aplicación publicada, hace lo que haría una persona
 * y lo cuenta con un subtítulo en cada paso. Si un paso no sale —un botón
 * que no responde, una pantalla que falla—, la grabación se para y lo dice:
 * un tutorial grabado sobre algo roto sería peor que no tenerlo, y de paso
 * así se prueba cada función.
 *
 * Las credenciales de la cuenta de pruebas llegan por variables de entorno,
 * nunca escritas aquí ni en el chat:
 *
 *   LOGICIEL_URL                    https://logiciel-construction.com por defecto
 *   LOGICIEL_PRUEBA_EMAIL / _CLAVE  el negocio de pruebas (panel)
 *   LOGICIEL_PRUEBA_IT_EMAIL / _IT_CLAVE   el de Italia, si es otro
 *   LOGICIEL_PRUEBA_CODIGO_CAMPO    el código de un trabajador (app /campo)
 *   LOGICIEL_PRUEBA_CODIGO_CLIENTE  el código de un cliente (portal)
 *
 * Sale en `marketing/videos/<idioma>/<guion>.mp4` (H.264, lo que acepta
 * YouTube e Instagram tal cual).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "../ancho/medir.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const BASE = (process.env.LOGICIEL_URL || "https://logiciel-construction.com").replace(/\/$/, "");

const FORMATOS = {
  // 1280 px escalado a 1080p: a 1920 reales la interfaz sale diminuta en
  // un teléfono, que es donde se ven los vídeos.
  horizontal: { width: 1280, height: 720, escala: 1.5 },
  // El móvil se graba a su tamaño real y se escala: así la app se ve como en
  // un teléfono y no como una web estirada.
  vertical: { width: 430, height: 932, escala: 2.5 },
};

/** El puntero y los toques: en una grabación automática no se ven solos. */
function puntero() {
  const css = document.createElement("style");
  css.textContent = `
    #lc-puntero{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(242,138,78,.85);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;transition:transform .12s}
    #lc-puntero.toca{transform:scale(.7)}
    .lc-onda{position:fixed;z-index:2147483646;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:3px solid rgba(242,138,78,.9);pointer-events:none;animation:lc-onda .55s ease-out forwards}
    @keyframes lc-onda{to{transform:scale(3.2);opacity:0}}
    #lc-subtitulo{position:fixed;z-index:2147483645;left:50%;bottom:6%;transform:translateX(-50%);max-width:min(88vw,1200px);padding:14px 26px;border-radius:16px;background:rgba(11,18,32,.88);color:#fff;font:600 clamp(16px,2.2vw,30px)/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.35);transition:opacity .25s;pointer-events:none}
    #lc-subtitulo:empty{opacity:0}
    #lc-subtitulo.arriba{bottom:auto;top:11%}`;
  const poner = () => {
    if (document.getElementById("lc-puntero")) return;
    document.head.appendChild(css);
    const p = document.createElement("div"); p.id = "lc-puntero"; p.style.left = "-40px"; p.style.top = "-40px";
    const s = document.createElement("div"); s.id = "lc-subtitulo";
    document.body.append(p, s);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", poner) : poner();
  addEventListener("mousemove", (e) => { const p = document.getElementById("lc-puntero"); if (p) { p.style.left = e.clientX + "px"; p.style.top = e.clientY + "px"; } }, true);
  addEventListener("mousedown", (e) => {
    const p = document.getElementById("lc-puntero"); p?.classList.add("toca");
    const o = document.createElement("div"); o.className = "lc-onda"; o.style.left = e.clientX + "px"; o.style.top = e.clientY + "px";
    document.body.appendChild(o); setTimeout(() => o.remove(), 600);
  }, true);
  addEventListener("mouseup", () => document.getElementById("lc-puntero")?.classList.remove("toca"), true);
}

/** Lo que un guion puede hacer, a ritmo de persona y no de robot. */
function herramientas(pagina, idioma, inicio) {
  const pausa = (ms) => pagina.waitForTimeout(ms);
  /** El subtítulo; `arriba` cuando lo que se enseña está abajo y lo taparía. */
  const decir = async (texto, ms = 2600, { arriba = false } = {}) => {
    await pagina.evaluate(([t, a]) => {
      const s = document.getElementById("lc-subtitulo");
      if (s) { s.textContent = t; s.classList.toggle("arriba", a); }
    }, [texto, arriba]);
    if (ms) await pausa(ms);
  };
  const callar = () => pagina.evaluate(() => { const s = document.getElementById("lc-subtitulo"); if (s) s.textContent = ""; });
  const ir = async (ruta) => {
    await pagina.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 45_000 });
    await pagina.evaluate(puntero).catch(() => {});
    // Lo grabado antes de que la primera página esté pintada es blanco: se
    // corta al convertir.
    if (inicio.primeraPintada === null) inicio.primeraPintada = (Date.now() - inicio.t0) / 1000;
  };
  /**
   * Entrar en el panel con la cuenta de pruebas, fuera de cámara: lo que se
   * corta del principio incluye esto, que nadie tiene por qué ver (ni la
   * contraseña tecleándose).
   */
  const entrar = async () => {
    const email = process.env[idioma === "it" ? "LOGICIEL_PRUEBA_IT_EMAIL" : "LOGICIEL_PRUEBA_EMAIL"];
    const clave = process.env[idioma === "it" ? "LOGICIEL_PRUEBA_IT_CLAVE" : "LOGICIEL_PRUEBA_CLAVE"];
    if (!email || !clave) throw new Error(`faltan las credenciales de pruebas para «${idioma}»`);
    await pagina.goto(BASE + "/iniciar-sesion", { waitUntil: "networkidle", timeout: 45_000 });
    await pagina.fill('input[type="email"]', email);
    await pagina.fill('input[type="password"]', clave);
    await pagina.click('button[type="submit"]');
    await pagina.waitForURL((u) => !u.pathname.includes("iniciar-sesion"), { timeout: 30_000 });
    await pagina.waitForLoadState("networkidle");
  };
  /** Mover el puntero hasta algo y pulsarlo, como lo haría una mano. */
  const tocar = async (objetivo, ms = 900) => {
    const el = typeof objetivo === "string" ? pagina.locator(objetivo).first() : objetivo;
    // Al centro y no al borde: abajo está la barra de ayuda fija, y un botón
    // pegado al borde queda debajo de ella.
    await el.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
    await pausa(450);
    const caja = await el.boundingBox();
    if (!caja) throw new Error(`no se ve: ${objetivo}`);
    await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2, { steps: 22 });
    await pausa(250);
    await el.click();
    await pausa(ms);
  };
  const escribir = async (objetivo, texto) => {
    await tocar(objetivo, 200);
    await pagina.keyboard.type(texto, { delay: 55 });
    await pausa(500);
  };
  /**
   * Llamar a la API con la sesión de la página, para preparar o limpiar
   * fuera de cámara (que repetir una grabación no deje duplicados).
   */
  const api = (metodo, ruta, cuerpo) =>
    pagina.evaluate(
      async ([m, r, c]) => {
        const clave = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
        const token = clave ? JSON.parse(localStorage.getItem(clave)).access_token : null;
        const res = await fetch(r, {
          method: m,
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: c === undefined ? undefined : JSON.stringify(c),
        });
        const texto = await res.text();
        let datos = null;
        try { datos = JSON.parse(texto); } catch {}
        return { ok: res.ok, estado: res.status, datos };
      },
      [metodo, ruta, cuerpo]
    );
  /** Bajar despacio, para que se pueda leer lo que pasa. */
  const bajar = async (px, pasos = 14) => {
    for (let i = 0; i < pasos; i++) { await pagina.mouse.wheel(0, px / pasos); await pausa(45); }
    await pausa(700);
  };
  return { pagina, idioma, BASE, pausa, decir, callar, ir, entrar, api, tocar, escribir, bajar };
}

async function grabar(nombre, idioma) {
  const guion = (await import(path.join(AQUI, "guiones", `${nombre}.mjs`))).default;
  const formato = FORMATOS[guion.formato ?? "horizontal"];
  const tmp = fs.mkdtempSync(path.join(RAIZ, "node_modules", ".cache", "video-"));
  const salida = path.join(RAIZ, "marketing", "videos", idioma);
  fs.mkdirSync(salida, { recursive: true });

  const navegador = await chromium().launch();
  const contexto = await navegador.newContext({
    viewport: { width: formato.width, height: formato.height },
    deviceScaleFactor: formato.escala,
    isMobile: guion.formato === "vertical",
    hasTouch: guion.formato === "vertical",
    locale: { it: "it-IT", fr: "fr-CA", en: "en-CA", es: "es-ES" }[idioma],
  });
  await contexto.addInitScript(puntero);
  // El idioma de la interfaz, el mismo que guarda el selector de idioma.
  await contexto.addInitScript((l) => { try { localStorage.setItem("fsm-language", l); } catch {} }, idioma);
  const inicio = { t0: Date.now(), primeraPintada: null };
  const pagina = await contexto.newPage();

  // Los fotogramas, sacados del propio navegador a su resolución real.
  //
  // El `recordVideo` de Playwright graba la página a su tamaño CSS (1280 px)
  // dentro de un lienzo de 1920 y la comprime a 1 Mb/s: la página salía en
  // una esquina y el texto, borroso. El screencast de Chrome da cada
  // fotograma en JPEG a los píxeles de verdad (1920 con la escala de 1,5), y
  // con su marca de tiempo se monta el vídeo con su ritmo real.
  const fotogramas = [];
  const cdp = await contexto.newCDPSession(pagina);
  cdp.on("Page.screencastFrame", async (f) => {
    const archivo = path.join(tmp, `f${String(fotogramas.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(archivo, Buffer.from(f.data, "base64"));
    fotogramas.push({ archivo, t: f.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: formato.width * formato.escala,
    maxHeight: formato.height * formato.escala,
  });
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(String(e)));

  let fallo = null;
  try {
    await guion.pasos(herramientas(pagina, idioma, inicio));
  } catch (err) {
    fallo = err;
  }
  // El último fotograma se queda en pantalla lo que dure la última pausa: el
  // screencast sólo manda fotogramas cuando algo cambia.
  const fin = Date.now() / 1000;
  await cdp.send("Page.stopScreencast").catch(() => {});
  await contexto.close();
  await navegador.close();

  if (fallo) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`«${nombre}» (${idioma}) no se pudo grabar: ${fallo.message}${errores.length ? `\nErrores de la página: ${errores.join(" | ")}` : ""}`);
  }
  const mp4 = path.join(salida, `${nombre}.mp4`);
  // Desde la primera pantalla útil: lo de antes es la entrada y la carga.
  const desde = inicio.t0 / 1000 + (inicio.primeraPintada ?? 0) - 0.2;
  let primero = fotogramas.findLastIndex((f) => f.t <= desde);
  if (primero < 0) primero = 0;
  const usados = fotogramas.slice(primero);
  if (!usados.length) throw new Error(`«${nombre}» (${idioma}): el navegador no mandó ningún fotograma`);
  const lista = usados
    .map((f, i) => {
      const siguiente = i + 1 < usados.length ? usados[i + 1].t : fin;
      return `file '${f.archivo}'\nduration ${Math.max(0.001, siguiente - Math.max(f.t, desde)).toFixed(3)}`;
    })
    .join("\n") + `\nfile '${usados[usados.length - 1].archivo}'\n`;
  const listaArchivo = path.join(tmp, "lista.txt");
  fs.writeFileSync(listaArchivo, lista);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listaArchivo, "-vf", `scale=${formato.width * formato.escala}:${formato.height * formato.escala}:flags=lanczos,fps=30`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4]);
  fs.rmSync(tmp, { recursive: true, force: true });
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString());
  console.log(`✓ ${path.relative(RAIZ, mp4)} — ${Math.round(dur)} s${errores.length ? ` (avisos de la página: ${errores.length})` : ""}`);
}

const [, , que, idioma = "it"] = process.argv;
if (!que) {
  console.error("Uso: node scripts/videos/grabar.mjs <guion|--todos> <idioma>");
  process.exit(1);
}
const lista = que === "--todos" ? fs.readdirSync(path.join(AQUI, "guiones")).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)).sort() : [que];
let mal = 0;
for (const nombre of lista) {
  try { await grabar(nombre, idioma); } catch (e) { mal++; console.error(`✗ ${e.message}`); }
}
process.exit(mal ? 1 : 0);
