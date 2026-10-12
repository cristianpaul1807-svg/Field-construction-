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
 *   AZURE_SPEECH_KEY / _REGION      la voz por el servicio oficial de Microsoft
 *                                   (la misma Sylvie); sin ellas, edge-tts
 *   PIPER_MODELO                    ruta a una voz Piper (.onnx): libre y local,
 *                                   para cuando no hay ninguna de las otras
 *   SIN_VOZ=1                       ensayar sin pedir ninguna voz: sale mudo,
 *                                   con el ritmo que tendría hablado
 *
 * Los vídeos van por series: un vídeo largo horizontal (`serieN-largo`) que
 * explica un proceso entero con capítulos, y Shorts verticales
 * (`serieN-short-*`) que abren con un gancho —la frase del problema encima de
 * la aplicación ya en marcha— y acaban mandando al largo.
 *
 * Sale en `marketing/videos/<idioma>/`:
 *
 *   <guion>.mp4   el vídeo (H.264, lo que acepta YouTube e Instagram tal cual)
 *   <guion>.srt   los subtítulos en archivo aparte: YouTube los indexa, y es
 *                 una de las señales con las que decide a quién enseñarlo
 *   <guion>.txt   título, descripción con capítulos, hashtags y etiquetas,
 *                 listos para pegar al subirlo
 *
 * El formato de cada vídeo: no es un manual. Empieza por un problema que el
 * contratista reconoce (una pantalla informativa, no la aplicación), enseña
 * cómo se resuelve contado en su idioma y no en el de los menús, y acaba con
 * el resultado. La venta es que funcione delante de él.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "../ancho/medir.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CASCO = `data:image/png;base64,${fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "client", "public", "icons", "icon-1024.png")).toString("base64")}`;
const RAIZ = path.resolve(AQUI, "..", "..");
const BASE = (process.env.LOGICIEL_URL || "https://logiciel-construction.com").replace(/\/$/, "");

/** La voz de cada idioma: una persona del país, no un francés de París leyendo Quebec. */
const VOCES = { fr: "fr-CA-SylvieNeural", it: "it-IT-ElsaNeural", es: "es-ES-ElviraNeural", en: "en-CA-ClaraNeural" };
const CACHE_VOZ = path.join(RAIZ, "node_modules", ".cache", "voz");

/**
 * Una frase en audio, con su duración. Se guarda por su texto: grabar otra
 * vez el mismo vídeo no vuelve a pedir la voz, y no hay esperas de red en
 * mitad de una grabación.
 */
function voz(idioma, texto) {
  const limpio = texto.replace(/\*/g, "").replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  // SIN_VOZ=1: para ensayar un guion sin pedir ninguna voz. Cada frase dura lo
  // que tardaría en decirse (unos 15 caracteres por segundo), así que el ritmo
  // es el del vídeo de verdad, pero sale mudo.
  if (process.env.SIN_VOZ) return { archivo: null, segundos: limpio.length / 15 };
  fs.mkdirSync(CACHE_VOZ, { recursive: true });
  // La voz que suena entra en la clave: una frase dicha por Piper no puede
  // salir de la caché en un vídeo que se graba con Sylvie, ni al revés.
  const quien = process.env.PIPER_MODELO ? `piper:${path.basename(process.env.PIPER_MODELO)}` : VOCES[idioma];
  const archivo = path.join(CACHE_VOZ, `${createHash("sha1").update(`${quien}|${limpio}`).digest("hex")}.mp3`);
  if (!fs.existsSync(archivo) || fs.statSync(archivo).size === 0) {
    execFileSync("/usr/bin/python3", [path.join(AQUI, "voz.py"), VOCES[idioma], archivo, limpio], {
      env: { ...process.env, SSL_CERT_FILE: process.env.SSL_CERT_FILE || "/root/.ccr/ca-bundle.crt" },
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 60_000,
    });
  }
  const segundos = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", archivo]).toString());
  return { archivo, segundos };
}

/** Lo que se va a decir en un guion, para pedir todas las voces antes de grabar. */
function frasesDe(textos) {
  const salida = [];
  const recorrer = (o, clave) => {
    if (typeof o === "string") { if (!["b", "lineas", "caps", "datos", "pie", "sobre"].includes(clave)) salida.push(o); return; }
    if (!o || typeof o !== "object" || ["b", "lineas", "caps", "datos"].includes(clave)) return;
    if (o.titulo) { salida.push(locucionDeTarjeta(o)); return; }
    for (const [k, v] of Object.entries(o)) recorrer(v, k);
  };
  recorrer(textos, "");
  return salida;
}
function locucionDeTarjeta({ titulo = "", texto = "" }) {
  return [titulo, texto].filter(Boolean).join(" ").replace(/\*/g, "");
}

const FORMATOS = {
  // 1280 px escalado a 1080p: a 1920 reales la interfaz sale diminuta en
  // un teléfono, que es donde se ven los vídeos.
  horizontal: { width: 1280, height: 720, escala: 1.5 },
  // El móvil se graba a su tamaño real y se escala: así la app se ve como en
  // un teléfono y no como una web estirada.
  // 432 × 768 por 2,5 = 1080 × 1920: el 9:16 de Shorts, Reels y TikTok.
  vertical: { width: 432, height: 768, escala: 2.5 },
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
    #lc-subtitulo.arriba{bottom:auto;top:11%}
    #lc-tarjeta{position:fixed;inset:0;z-index:2147483644;pointer-events:none;display:flex;flex-direction:column;justify-content:center;padding:0 9vw;background:radial-gradient(ellipse 80% 70% at 50% 0%,#1d3f8a 0%,#0f2350 45%,#0B1220 100%);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;opacity:0;transition:opacity .35s}
    #lc-tarjeta.ve{opacity:1}
    #lc-tarjeta .marca{position:absolute;top:5.5vh;left:9vw;display:flex;align-items:center;gap:12px;font-weight:800;font-size:clamp(14px,1.7vw,22px);letter-spacing:-.02em;opacity:.92}
    #lc-tarjeta .marca span{width:clamp(30px,3.4vw,44px);height:clamp(30px,3.4vw,44px);border-radius:28%;background:#fff;display:grid;place-items:center}
    #lc-tarjeta .marca img{width:78%}
    #lc-tarjeta .sobre{font-weight:800;font-size:clamp(12px,1.4vw,19px);letter-spacing:.14em;text-transform:uppercase;color:#7BA6EE;margin-bottom:2.2vh}
    #lc-tarjeta .sobre.problema{color:#F28A4E}
    #lc-tarjeta .sobre.resultado{color:#5DD39E}
    #lc-tarjeta h1{margin:0;font-weight:800;font-size:clamp(30px,5.6vw,84px);line-height:1.02;letter-spacing:-.04em;max-width:16ch}
    #lc-tarjeta h1 em{font-style:normal;color:#F28A4E}
    #lc-tarjeta .cifra{font-weight:800;font-size:clamp(60px,13vw,190px);line-height:.9;letter-spacing:-.05em;color:#F28A4E;margin-bottom:1.5vh}
    #lc-tarjeta p{margin:2.6vh 0 0;font-size:clamp(16px,2.1vw,30px);line-height:1.4;color:rgba(255,255,255,.78);max-width:36ch}
    #lc-tarjeta .pie{position:absolute;bottom:6vh;left:9vw;right:9vw;font-size:clamp(13px,1.5vw,20px);color:rgba(255,255,255,.7)}
    #lc-tarjeta .pie b{color:#fff}
    #lc-tarjeta .linea{opacity:0;transform:translateY(18px);transition:opacity .5s,transform .5s}
    #lc-tarjeta.ve .linea{opacity:1;transform:none}
    #lc-tarjeta.ve .linea.d1{transition-delay:.15s}#lc-tarjeta.ve .linea.d2{transition-delay:.35s}#lc-tarjeta.ve .linea.d3{transition-delay:.6s}
    body.lc-en-tarjeta #lc-puntero{opacity:0}
    #lc-foco{position:fixed;z-index:2147483643;border:3px solid #F28A4E;border-radius:14px;box-shadow:0 0 0 200vmax rgba(11,18,32,.55);pointer-events:none;opacity:0;transition:opacity .35s}
    #lc-foco.ve{opacity:1}
    #lc-tarjeta.ya,#lc-tarjeta.ya .linea{transition:none}
    #lc-gancho{position:fixed;z-index:2147483645;left:0;right:0;top:0;padding:7vh 7vw 9vh;background:linear-gradient(180deg,rgba(11,18,32,.94) 0%,rgba(11,18,32,.86) 62%,rgba(11,18,32,0) 100%);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:none;opacity:0;transform:translateY(-12px);transition:opacity .3s,transform .3s}
    #lc-gancho.ve{opacity:1;transform:none}
    #lc-gancho .sobre{font-weight:800;font-size:clamp(12px,1.5vw,18px);letter-spacing:.14em;text-transform:uppercase;color:#F28A4E;margin-bottom:1.2vh}
    #lc-gancho h1{margin:0;font-weight:800;font-size:clamp(28px,4.6vw,64px);line-height:1.05;letter-spacing:-.035em}
    #lc-gancho h1 em{font-style:normal;color:#F28A4E}`;
  /**
   * Pintar la tarjeta informativa. Vive aquí, en lo que se inyecta en cada
   * página, y no en el guion, porque una tarjeta tiene que sobrevivir a una
   * recarga: es lo que tapa el cambio de una sesión a otra (del panel al
   * móvil del cliente). Lo que se está enseñando se guarda en sessionStorage
   * y la página nueva lo vuelve a pintar ya puesto, sin animación.
   */
  window.__lcTarjeta = (d, casco, ya) => {
    document.getElementById("lc-tarjeta")?.remove();
    const s = document.getElementById("lc-subtitulo"); if (s) s.textContent = "";
    const t = document.createElement("div");
    t.id = "lc-tarjeta";
    if (ya) t.className = "ya ve";
    const esc = (x) => x.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    // *palabra* sale en naranja: la que importa de la frase.
    const marcar = (x) => esc(x).replace(/\*([^*]+)\*/g, "<em>$1</em>");
    t.innerHTML =
      `<div class="marca"><span><img src="${casco}"></span>Logiciel Construction</div>` +
      (d.sobre ? `<div class="sobre linea ${d.tipo}">${esc(d.sobre)}</div>` : "") +
      (d.cifra ? `<div class="cifra linea d1">${esc(d.cifra)}</div>` : "") +
      `<h1 class="linea d1">${marcar(d.titulo)}</h1>` +
      (d.texto ? `<p class="linea d2">${marcar(d.texto)}</p>` : "") +
      (d.pie ? `<div class="pie linea d3">${d.pie}</div>` : "");
    document.body.appendChild(t);
    document.body.classList.add("lc-en-tarjeta");
    if (!ya) requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("ve")));
  };
  let guardada = null;
  try { guardada = JSON.parse(sessionStorage.getItem("lc-tarjeta") ?? "null"); } catch {}
  // Mientras carga la página nueva, fondo oscuro y no blanco: entre una página
  // y otra no hay tarjeta todavía, y un destello blanco en mitad se ve.
  // El script entra antes de que exista <html>: se espera a que aparezca.
  if (guardada) {
    const oscurecer = () => { document.documentElement.style.background = "#0B1220"; };
    if (document.documentElement) oscurecer();
    else new MutationObserver((_, o) => { if (document.documentElement) { oscurecer(); o.disconnect(); } }).observe(document, { childList: true });
  }
  const poner = () => {
    if (document.getElementById("lc-puntero")) return;
    document.head.appendChild(css);
    const p = document.createElement("div"); p.id = "lc-puntero"; p.style.left = "-40px"; p.style.top = "-40px";
    const s = document.createElement("div"); s.id = "lc-subtitulo";
    document.body.append(p, s);
    if (guardada) window.__lcTarjeta(guardada.d, guardada.casco, true);
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
  const ahora = () => Date.now() / 1000;
  const empezar = () => { if (inicio.primeraPintada === null) inicio.primeraPintada = (Date.now() - inicio.t0) / 1000; };
  /** Lo que se dice, con su hora: de ahí salen el .srt y los capítulos. */
  const cerrarFrase = () => {
    const ultima = inicio.frases[inicio.frases.length - 1];
    if (ultima && ultima.fin === null) ultima.fin = ahora();
  };
  const apuntar = (texto) => {
    cerrarFrase();
    if (texto) inicio.frases.push({ ini: ahora(), fin: null, texto });
  };
  /** El subtítulo; `arriba` cuando lo que se enseña está abajo y lo taparía. */
  /**
   * La voz: no empieza una frase hasta que acaba la anterior, y devuelve
   * cuánto le queda por decir.
   */
  const narrar = async (texto) => {
    const v = voz(idioma, texto);
    if (!v) return 0;
    const espera = inicio.vozHasta - ahora();
    if (espera > 0) await pausa(espera * 1000);
    if (v.archivo) inicio.audios.push({ t: ahora(), archivo: v.archivo });
    inicio.vozHasta = ahora() + v.segundos + 0.25;
    return v.segundos;
  };
  const decir = async (texto, ms = 2600, { arriba = false } = {}) => {
    // Primero se espera a que acabe la frase anterior, y entonces cambia el
    // subtítulo: así lo escrito y lo dicho van siempre juntos.
    const espera = inicio.vozHasta - ahora();
    if (espera > 0) await pausa(espera * 1000);
    await pagina.evaluate(([t, a]) => {
      const s = document.getElementById("lc-subtitulo");
      if (s) { s.textContent = t; s.classList.toggle("arriba", a); }
    }, [texto, arriba]);
    apuntar(texto);
    const dura = await narrar(texto);
    // Con `ms`, se queda en pantalla al menos lo que tarda en decirse.
    if (ms) await pausa(Math.max(ms, dura * 1000 + 300));
  };
  const callar = async () => {
    await pagina.evaluate(() => { const s = document.getElementById("lc-subtitulo"); if (s) s.textContent = ""; });
    cerrarFrase();
  };

  /**
   * Una pantalla informativa a pantalla completa: el problema, una cifra, el
   * resultado, el cierre. Es lo que sujeta a quien está mirando: la aplicación
   * sola es una sucesión de formularios, y lo que se queda es la frase.
   *
   * `tipo`: "problema" (naranja), "resultado" (verde) o nada (azul).
   * `capitulo`: el nombre con el que sale en los capítulos de YouTube.
   * `durante`: lo que se hace detrás mientras se lee, normalmente `navegar`.
   *   Cargar una pantalla nueva eran cinco u ocho segundos de «Chargement…»
   *   en mitad del vídeo; tapados por la tarjeta, no se ven.
   */
  const tarjeta = async ({ sobre = "", titulo, texto = "", cifra = "", pie = "", tipo = "", ms = 3800, capitulo = null, durante = null }) => {
    const espera = inicio.vozHasta - ahora();
    if (espera > 0) await pausa(espera * 1000);
    await pagina.evaluate(
      ([d, casco]) => {
        try { sessionStorage.setItem("lc-tarjeta", JSON.stringify({ d, casco })); } catch {}
        window.__lcTarjeta(d, casco, false);
      },
      [{ sobre, titulo, texto, cifra, pie, tipo }, CASCO]
    );
    // Si el vídeo empieza por esta tarjeta, empieza con ella ya puesta y no
    // con medio segundo de lo que hubiera debajo (el panel, tras entrar).
    if (inicio.primeraPintada === null) {
      await pausa(700);
      empezar();
    }
    apuntar([sobre, cifra, titulo, texto].filter(Boolean).join(" — ").replace(/\*/g, ""));
    if (capitulo) inicio.capitulos.push({ t: ahora(), titulo: capitulo });
    const dura = await narrar(locucionDeTarjeta({ titulo, texto }));
    const detras = durante ? durante() : null;
    await pausa(Math.max(ms, dura * 1000 + 700));
    await detras;
    await pagina.evaluate(() => {
      try { sessionStorage.removeItem("lc-tarjeta"); } catch {}
      document.documentElement.style.background = "";
      const t = document.getElementById("lc-tarjeta");
      if (t) { t.classList.remove("ya", "ve"); setTimeout(() => t.remove(), 400); }
      document.body.classList.remove("lc-en-tarjeta");
    });
    cerrarFrase();
    await pausa(450);
  };

  /**
   * El gancho de un Short: la frase del problema arriba, grande, con la
   * aplicación ya moviéndose debajo desde el primer segundo. En el feed de
   * Shorts se decide en un segundo si se sigue mirando, y una tarjeta quieta
   * de cinco segundos es lo que hace pasar de largo.
   *
   * `durante`: lo que pasa debajo mientras se lee (escribir, tocar…).
   * Se queda puesto hasta `soltarGancho()` o hasta que acaba `durante`.
   */
  const gancho = async ({ sobre = "", titulo, durante = null, ms = 0 }) => {
    const espera = inicio.vozHasta - ahora();
    if (espera > 0) await pausa(espera * 1000);
    await pagina.evaluate(([d]) => {
      document.getElementById("lc-gancho")?.remove();
      const g = document.createElement("div");
      g.id = "lc-gancho";
      const esc = (x) => x.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
      g.innerHTML = (d.sobre ? `<div class="sobre">${esc(d.sobre)}</div>` : "") + `<h1>${esc(d.titulo).replace(/\*([^*]+)\*/g, "<em>$1</em>")}</h1>`;
      document.body.appendChild(g);
      requestAnimationFrame(() => requestAnimationFrame(() => g.classList.add("ve")));
    }, [{ sobre, titulo }]);
    if (inicio.primeraPintada === null) {
      await pausa(350);
      empezar();
    }
    apuntar([sobre, titulo].filter(Boolean).join(" — ").replace(/\*/g, ""));
    const dura = await narrar(titulo);
    const t0 = ahora();
    if (durante) await durante();
    const resta = Math.max(ms / 1000, dura + 0.4) - (ahora() - t0);
    if (resta > 0) await pausa(resta * 1000);
  };
  const soltarGancho = async () => {
    await pagina.evaluate(() => {
      const g = document.getElementById("lc-gancho");
      if (g) { g.classList.remove("ve"); setTimeout(() => g.remove(), 350); }
    });
    cerrarFrase();
  };
  /** Marcar un capítulo sin tarjeta: cuando la escena de la aplicación ya lo dice. */
  const capitulo = (titulo) => inicio.capitulos.push({ t: ahora(), titulo });

  /** Oscurecer todo menos una parte de la pantalla, mientras se explica. */
  const resaltar = async (objetivo, ms = 2600, texto = null, opciones = {}) => {
    const el = typeof objetivo === "string" ? pagina.locator(objetivo).first() : objetivo;
    // El foco va con su frase: si se mueve mientras la voz aún dice la
    // anterior, se oye «tus trabajadores» con el recuadro ya en los clientes.
    const antes = inicio.vozHasta - ahora();
    if (antes > 0) await pausa(antes * 1000);
    await el.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
    await pausa(450);
    const caja = await el.boundingBox();
    if (!caja) throw new Error(`no se ve para resaltar: ${objetivo}`);
    await pagina.evaluate((c) => {
      document.getElementById("lc-foco")?.remove();
      const f = document.createElement("div");
      f.id = "lc-foco";
      const m = 8;
      Object.assign(f.style, { left: c.x - m + "px", top: c.y - m + "px", width: c.width + 2 * m + "px", height: c.height + 2 * m + "px" });
      document.body.appendChild(f);
      requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add("ve")));
    }, caja);
    if (texto) await decir(texto, 0, opciones);
    // Y no se apaga hasta que la frase acaba, aunque `ms` sea más corto.
    await pausa(Math.max(ms, (inicio.vozHasta - ahora()) * 1000));
    await pagina.evaluate(() => {
      const f = document.getElementById("lc-foco");
      if (f) { f.classList.remove("ve"); setTimeout(() => f.remove(), 400); }
    });
    await pausa(350);
  };
  const ir = async (ruta) => {
    await pagina.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 45_000 });
    await pagina.evaluate(puntero).catch(() => {});
    // Lo grabado antes de que la primera página esté pintada es blanco: se
    // corta al convertir.
    empezar();
  };
  /**
   * Ir a otra pantalla sin recargar, como un enlace de la propia aplicación.
   * La tarjeta, el puntero y el subtítulo viven fuera de React y sobreviven
   * al cambio; con `ir` la página entera se recarga y se los lleva.
   * `espera`: algo que tiene que verse antes de dar la pantalla por cargada.
   */
  const navegar = async (ruta, espera = null) => {
    await pagina.evaluate((r) => {
      history.pushState(null, "", r);
      dispatchEvent(new PopStateEvent("popstate"));
    }, ruta);
    await pagina.waitForLoadState("networkidle").catch(() => {});
    if (espera) await (typeof espera === "string" ? pagina.locator(espera).first() : espera).waitFor({ timeout: 30_000 });
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
    // Sólo se desplaza si hace falta: recentrar en cada toque mareaba.
    const fuera = await el.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return r.top < 80 || r.bottom > innerHeight - 70;
    });
    if (fuera) {
      await el.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
      await pausa(450);
    }
    const caja = await el.boundingBox();
    if (!caja) throw new Error(`no se ve: ${objetivo}`);
    await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2, { steps: 16 });
    await pausa(150);
    await el.click();
    await pausa(ms);
  };
  /**
   * Abrir un desplegable y elegir una opción. Si la lista se abre antes de
   * que hayan llegado sus datos (los clientes de la soumission), sale vacía y
   * no se rellena sola: se cierra y se vuelve a abrir.
   */
  const elegir = async (desplegable, opcion, ms = 500) => {
    const el = typeof desplegable === "string" ? pagina.locator(desplegable).first() : desplegable;
    const op = pagina.getByRole("option", { name: opcion, exact: true });
    for (let intento = 0; intento < 4; intento++) {
      await tocar(el, 400);
      if (await op.first().isVisible().catch(() => false)) return tocar(op.first(), ms);
      await op.first().waitFor({ timeout: 2500 }).catch(() => {});
      if (await op.first().isVisible().catch(() => false)) return tocar(op.first(), ms);
      await pagina.keyboard.press("Escape");
      await pausa(1200);
    }
    throw new Error(`no aparece la opción «${opcion}» en el desplegable`);
  };
  /**
   * Escribir en un campo. `rapido`: cuando ya se ha visto teclear una vez y
   * repetirlo sólo alarga el vídeo, el texto entra de golpe.
   */
  const escribir = async (objetivo, texto, { rapido = false } = {}) => {
    await tocar(objetivo, rapido ? 80 : 150);
    // Lo que hubiera se sustituye: un campo numérico vacío vuelve a «0» y lo
    // tecleado salía detrás («0120»).
    await pagina.keyboard.press("Control+A");
    if (rapido) await pagina.keyboard.insertText(texto);
    else await pagina.keyboard.type(texto, { delay: 32 });
    await pausa(rapido ? 120 : 350);
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
  /**
   * Llevar una barra deslizante a un valor. Pulsarla en el centro la pone a
   * la mitad, así que se enfoca, se lleva al principio y se avanza a teclado,
   * con el puntero encima para que se vea quién la mueve.
   */
  const deslizar = async (objetivo, valor) => {
    const el = typeof objetivo === "string" ? pagina.locator(objetivo).first() : objetivo;
    await el.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
    await pausa(400);
    const caja = await el.boundingBox();
    if (caja) await pagina.mouse.move(caja.x + 8, caja.y + caja.height / 2, { steps: 18 });
    await el.focus();
    await pagina.keyboard.press("Home");
    for (let i = 0; i < valor; i++) { await pagina.keyboard.press("ArrowRight"); await pausa(55); }
    await pausa(500);
  };
  return { pagina, idioma, BASE, pausa, decir, callar, tarjeta, gancho, soltarGancho, capitulo, resaltar, ir, navegar, entrar, api, tocar, elegir, escribir, deslizar, bajar };
}

async function grabar(nombre, idioma) {
  const guion = (await import(path.join(AQUI, "guiones", `${nombre}.mjs`))).default;
  const formato = FORMATOS[guion.formato ?? "horizontal"];
  // Las voces antes de abrir el navegador: pedir una en mitad de la grabación
  // deja un silencio de un segundo con la pantalla quieta.
  if (guion.textos?.[idioma]) for (const f of frasesDe(guion.textos[idioma])) voz(idioma, f);
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
    // Lo que el guion necesite del teléfono: la ubicación para fichar, la
    // hora del día que cuenta la historia.
    ...(guion.contexto?.(idioma) ?? {}),
  });
  await contexto.addInitScript(puntero);
  // El idioma de la interfaz, el mismo que guarda el selector de idioma.
  await contexto.addInitScript((l) => { try { localStorage.setItem("fsm-language", l); } catch {} }, idioma);
  const inicio = { t0: Date.now(), primeraPintada: null, frases: [], capitulos: [], audios: [], vozHasta: 0 };
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
  const util = herramientas(pagina, idioma, inicio);
  try {
    await guion.pasos(util);
  } catch (err) {
    fallo = err;
  }
  // El último fotograma se queda en pantalla lo que dure la última pausa: el
  // screencast sólo manda fotogramas cuando algo cambia.
  const fin = Date.now() / 1000;
  await cdp.send("Page.stopScreencast").catch(() => {});
  // Lo que se hace ya sin cámara: sobre todo, cambiar los códigos de acceso
  // que han salido en pantalla, para que el que se ve en el vídeo no abra
  // nada. Va también cuando el guion falla a medias.
  if (guion.despues && util) {
    try { await guion.despues(util); } catch (e) { console.error(`  (después de «${nombre}»: ${e.message})`); }
  }
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

  // La narración, cada frase en su sitio, sobre el vídeo.
  if (inicio.audios.length) {
    const conVoz = path.join(salida, `.${nombre}.voz.mp4`);
    const entradas = inicio.audios.flatMap((a) => ["-i", a.archivo]);
    const retrasos = inicio.audios.map((a, i) => `[${i + 1}:a]adelay=${Math.round(Math.max(0, a.t - desde) * 1000)}:all=1[a${i}]`);
    const filtro = `${retrasos.join(";")};${inicio.audios.map((_, i) => `[a${i}]`).join("")}amix=inputs=${inicio.audios.length}:normalize=0:dropout_transition=0,apad[voz]`;
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mp4, ...entradas, "-filter_complex", filtro, "-map", "0:v", "-map", "[voz]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", conVoz]);
    fs.renameSync(conVoz, mp4);
  }

  // Los subtítulos, con los tiempos del vídeo ya recortado.
  const t = (epoca) => Math.max(0, Math.min(dur, epoca - desde));
  const srtTiempo = (s) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  const frases = inicio.frases.map((f) => ({ ini: t(f.ini), fin: t(f.fin ?? fin), texto: f.texto })).filter((f) => f.fin - f.ini > 0.3);
  fs.writeFileSync(
    path.join(salida, `${nombre}.srt`),
    frases.map((f, i) => `${i + 1}\n${srtTiempo(f.ini)} --> ${srtTiempo(f.fin)}\n${f.texto}\n`).join("\n")
  );

  // Título, descripción, capítulos y etiquetas para YouTube.
  const yt = guion.youtube?.[idioma];
  if (yt) {
    const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    // YouTube sólo enseña capítulos si el primero está en 0:00, hay al menos
    // tres y ninguno dura menos de diez segundos: si no se cumple, mejor
    // ninguno que una lista que YouTube ignora.
    let caps = inicio.capitulos.map((c) => ({ t: Math.floor(t(c.t)), titulo: c.titulo }));
    if (caps.length) caps[0].t = 0;
    const validos = caps.length >= 3 && caps.every((c, i) => (i + 1 < caps.length ? caps[i + 1].t : dur) - c.t >= 10);
    const enlace = `https://logiciel-construction.com/${idioma}/?utm_source=youtube&utm_medium=video&utm_campaign=${nombre}`;
    const prueba = { fr: "👉 Essai gratuit de 30 jours, sans carte :", it: "👉 Prova gratuita di 30 giorni, senza carta:", es: "👉 Prueba gratuita de 30 días, sin tarjeta:", en: "👉 30-day free trial, no card:" }[idioma];
    const capTitulo = { fr: "⏱️ Chapitres", it: "⏱️ Capitoli", es: "⏱️ Capítulos", en: "⏱️ Chapters" }[idioma];
    const texto = [
      `TITRE / TITOLO (máx. 100):\n${yt.titulo}`,
      "",
      "DESCRIPTION / DESCRIZIONE:",
      yt.descripcion.trim(),
      "",
      `${prueba} ${enlace}`,
      ...(validos ? ["", capTitulo, ...caps.map((c) => `${mmss(c.t)} ${c.titulo}`)] : []),
      "",
      // La voz de Piper (SIWIS) es CC BY 4.0: se puede usar citándola.
      // La de Paola es CC0 y no lo pide.
      ...(process.env.PIPER_MODELO?.includes("siwis") ? ["Voix : corpus SIWIS (CC BY 4.0), synthèse Piper.", ""] : []),
      yt.hashtags.map((h) => `#${h}`).join(" "),
      "",
      `TAGS / ETIQUETAS:\n${yt.etiquetas.join(", ")}`,
      "",
      `Subtítulos: sube ${nombre}.srt en «Subtítulos» (idioma: ${idioma === "fr" ? "francés (Canadá)" : idioma}).`,
      "",
    ].join("\n");
    fs.writeFileSync(path.join(salida, `${nombre}.txt`), texto);
  }
  console.log(`✓ ${path.relative(RAIZ, mp4)} — ${Math.round(dur)} s${errores.length ? ` (avisos de la página: ${errores.length})` : ""}`);
}

const [, , que, idioma = "it"] = process.argv;
if (!que) {
  console.error("Uso: node scripts/videos/grabar.mjs <guion|--todos> <idioma>");
  process.exit(1);
}
const lista = que === "--todos" ? fs.readdirSync(path.join(AQUI, "guiones")).filter((f) => f.endsWith(".mjs") && !f.endsWith("-comun.mjs")).map((f) => f.slice(0, -4)).sort() : [que];
let mal = 0;
for (const nombre of lista) {
  try { await grabar(nombre, idioma); } catch (e) { mal++; console.error(`✗ ${e.message}`); }
}
process.exit(mal ? 1 : 0);
