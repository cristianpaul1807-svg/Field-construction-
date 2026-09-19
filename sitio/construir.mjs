/**
 * Genera el sitio de presentación en los cuatro idiomas.
 *
 *     node sitio/construir.mjs
 *
 * Cuatro idiomas por siete páginas son veintiocho ficheros. Escritos a mano se
 * desincronizan en la primera semana: alguien corrige una frase en francés y
 * las otras tres se quedan diciendo lo de antes, sin que nada falle. Aquí el
 * texto vive en `textos/` y la forma en este archivo, y **si a un idioma le
 * falta una clave la construcción se para** — la misma disciplina que el panel.
 *
 * Los legales no se escriben aquí: salen de `client/src/i18n/locales/*.json`,
 * que es donde ya viven para la aplicación. Dos copias de una política de
 * privacidad es una que alguien va a olvidar actualizar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import fr from "./textos/fr.mjs";
import en from "./textos/en.mjs";
import es from "./textos/es.mjs";
import it from "./textos/it.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const SALIDA = path.join(AQUI, "publico");
const DOMINIO = "https://logiciel-construction.com";

/**
 * La tipografía francesa, aplicada al texto y no al HTML.
 *
 * En francés el espacio antes de `? ! ; :` y dentro de las comillas es
 * **insecable**, y el navegador no lo sabe: parte la línea ahí. El titular de
 * soporte salía como «Un problème» / «? On répond», con el signo solo al
 * principio del renglón. Es el error que un francófono de Quebec ve antes que
 * cualquier otra cosa de la página, y la Loi 96 no va sólo de traducir.
 *
 * Se aplica al texto tal y como sale de `textos/fr.mjs`, no al HTML montado:
 * un reemplazo sobre el documento entero acabaría metiendo un espacio
 * insecable dentro de un `style` o de un `!important` y rompiendo el CSS sin
 * que nada avise. Aquí sólo pasan frases.
 *
 * ` ` es el espacio fino insecable, que es el que corresponde a `? ! ;` y
 * a los millares; ` ` es el normal insecable, que es el de `:` y el de
 * las unidades — `10 %`, `5 000 $`.
 */
function tipografiaFrancesa(texto) {
  return texto
    .replace(/ ([?!;])/g, " $1")
    .replace(/ :/g, " :")
    .replace(/ ([%$])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/ »/g, " »")
    // El separador de millares: «5 000» no puede partirse en dos renglones.
    .replace(/(\d) (\d{3})/g, "$1 $2");
}

function conTipografia(valor) {
  if (typeof valor === "string") return tipografiaFrancesa(valor);
  if (Array.isArray(valor)) return valor.map(conTipografia);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, conTipografia(v)]));
  }
  return valor;
}

/**
 * Las direcciones se quedan como están.
 *
 * No son texto que nadie lee: son la dirección. Un espacio insecable dentro de
 * `fonctionnalites` no llegaría a pasar —no hay espacios—, pero dejarlo
 * explícito evita que alguien meta mañana un slug con un signo y se encuentre
 * con una página que no abre.
 */
const frances = { ...conTipografia(fr), rutas: fr.rutas, codigo: fr.codigo, lang: fr.lang };

/** El francés manda: es la lengua del mercado y la que exige la Loi 96. */
const IDIOMAS = [frances, en, es, it];
const REFERENCIA = frances;

const PRECIOS = {
  chantier:   { mes: 99,  ano: 990 },
  entreprise: { mes: 249, ano: 2490 },
};

/**
 * A dónde lleva «probar 30 días».
 *
 * A crear la cuenta, no al formulario de contacto. El botón dice «sin tarjeta»
 * y eso promete entrar ahora mismo; llevar a un formulario donde se deja el
 * teléfono y se espera una llamada es prometer una cosa y hacer otra — y para
 * un contratista que mira esto entre dos obras, esperar es no volver.
 *
 * El formulario de contacto no desaparece ni se queda huérfano: sigue a un
 * clic desde el pie de todas las páginas, y ahí tiene sentido propio, porque
 * ofrece algo que el alta automática no puede — que le metamos sus tres
 * últimas obras con él.
 */
const REGISTRO = "/negocio/acceso";

// ---------- Paridad ----------

function claves(objeto, prefijo = "") {
  const salida = [];
  for (const [k, v] of Object.entries(objeto)) {
    const n = prefijo ? `${prefijo}.${k}` : k;
    if (Array.isArray(v)) {
      salida.push(`${n}[]${v.length}`);
      v.forEach((x, i) => {
        if (x && typeof x === "object") salida.push(...claves(x, `${n}.${i}`));
      });
    } else if (v && typeof v === "object") {
      salida.push(...claves(v, n));
    } else {
      salida.push(n);
    }
  }
  return salida;
}

function comprobarParidad() {
  const base = new Set(claves(REFERENCIA));
  const fallos = [];
  for (const idioma of IDIOMAS) {
    if (idioma === REFERENCIA) continue;
    const suyas = new Set(claves(idioma));
    for (const k of base) if (!suyas.has(k)) fallos.push(`${idioma.codigo}: falta ${k}`);
    for (const k of suyas) if (!base.has(k)) fallos.push(`${idioma.codigo}: sobra ${k}`);
  }
  if (fallos.length) {
    console.error("Los idiomas no están a la par:\n" + fallos.map((f) => `  · ${f}`).join("\n"));
    console.error(
      "\nLa longitud de una lista cuenta: si el francés tiene cuatro razones,\n" +
        "los otros tres también, o la página sale coja en un idioma y entera en otro."
    );
    process.exit(1);
  }
}

// ---------- Utilidades ----------

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Sólo `**negrita**`. Nada más, a propósito: el texto no es un lenguaje. */
const fuerte = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const url = (idioma, pagina) => {
  const trozo = idioma.rutas[pagina];
  return `/${idioma.codigo}${trozo ? `/${trozo}` : "/"}`.replace(/\/$/, idioma.rutas[pagina] ? "" : "/");
};

// ---------- Piezas ----------

/**
 * El casco. Es el mismo archivo del que salen los iconos de la aplicación
 * (`assets/logo-source.png` → `scripts/build-icons.mjs`), así que el icono
 * que el trabajador tiene en la pantalla del teléfono y la marca de la
 * cabecera son el mismo dibujo y no dos parecidos.
 *
 * Con medidas escritas en el propio `<img>` para que el navegador reserve el
 * hueco antes de bajarlo: sin eso la cabecera da un salto al cargar y empuja
 * el titular hacia abajo cuando ya se estaba leyendo.
 */
const LOGO = `<img class="mark" src="/sitio/logo.png" width="192" height="192" alt="" decoding="async">`;

/**
 * Las tres caras que se ven antes de bajar la página: el titular y el texto.
 * Se piden por delante para que no haya el parpadeo de leer media frase con
 * la letra de reserva y verla cambiar de golpe. Las demás —negritas,
 * seminegritas— llegan cuando toque, que es más abajo.
 */
const PRECARGA = [
  "plus-jakarta-sans-800-latin.woff2",
  "public-sans-400-latin.woff2",
  "public-sans-600-latin.woff2",
]
  .map((f) => `<link rel="preload" href="/sitio/fuentes/${f}" as="font" type="font/woff2" crossorigin>`)
  .join("\n");

const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

const ICONOS = {
  chantier: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V8l7-5 7 5v13M10 21v-6h4v6"/></svg>`,
  clientes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>`,
  dinero: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>`,
  cumplimiento: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
};

function marca(idioma) {
  return `<a class="marca" href="${url(idioma, "inicio")}">
      ${LOGO}
      <span class="nombre">Logiciel Construction<small>${esc(idioma.marca.sub)}</small></span>
    </a>`;
}

/**
 * El selector de idioma.
 *
 * `<details>` y no un menú con JavaScript: se abre y se cierra sin script, y
 * si el script no corre sigue funcionando. Cada opción apunta a **la misma
 * página en el otro idioma**, no a su portada — mandar a alguien al inicio
 * por cambiar de idioma es perderle lo que estaba leyendo.
 */
function selectorIdioma(idioma, pagina) {
  const opciones = IDIOMAS.map(
    (otro) =>
      `<a href="${url(otro, pagina)}" hreflang="${otro.codigo}" lang="${otro.codigo}"${
        otro.codigo === idioma.codigo ? ' aria-current="true"' : ""
      }>${esc(otro.nombre)}<span class="codigo">${otro.codigo}</span></a>`
  ).join("\n        ");

  return `<details class="idiomas">
      <summary aria-label="${esc(idioma.nav.idioma)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        ${esc(idioma.codigo.toUpperCase())}
      </summary>
      <div class="idiomas-lista">
        ${opciones}
      </div>
    </details>`;
}

function cabecera(idioma, pagina) {
  const item = (p, texto) =>
    `<a href="${url(idioma, p)}"${pagina === p ? ' aria-current="page"' : ""}>${esc(texto)}</a>`;
  return `<header class="cabecera">
  <div class="envoltura">
    ${marca(idioma)}
    <nav class="menu">
      ${item("funciones", idioma.nav.funciones)}
      ${item("ccq", idioma.nav.ccq)}
      ${item("precios", idioma.nav.precios)}
      ${selectorIdioma(idioma, pagina)}
      <a href="/iniciar-sesion" class="boton boton-secundario">${esc(idioma.nav.entrar)}</a>
      <a href="${REGISTRO}" class="boton boton-principal solo-ancho">${esc(idioma.nav.probar)}</a>
    </nav>
  </div>
</header>`;
}

function pie(idioma) {
  const l = (p, texto) => `<li><a href="${url(idioma, p)}">${esc(texto)}</a></li>`;
  return `<footer class="pie">
  <div class="envoltura">
    <div class="pie-rejilla">
      <div>
        ${marca(idioma)}
        <p style="max-width:34ch;margin-top:14px">${esc(idioma.pie.tagline)}</p>
      </div>
      <div>
        <h4>${esc(idioma.pie.producto)}</h4>
        <ul>
          ${l("funciones", idioma.nav.funciones)}
          ${l("precios", idioma.nav.precios)}
          ${l("ccq", idioma.nav.ccq)}
        </ul>
      </div>
      <div>
        <h4>${esc(idioma.pie.empezar)}</h4>
        <ul>
          <li><a href="${REGISTRO}">${esc(idioma.pie.ensayo)}</a></li>
          ${l("contacto", idioma.nav.hablar)}
          <li><a href="/iniciar-sesion">${esc(idioma.nav.entrar)}</a></li>
        </ul>
      </div>
      <div>
        <h4>${esc(idioma.pie.legal)}</h4>
        <ul>
          ${l("privacidad", legalTitulo(idioma, "privacy"))}
          ${l("condiciones", legalTitulo(idioma, "terms"))}
        </ul>
      </div>
    </div>
    <div class="abajo">
      <span>${esc(idioma.pie.derechos)}</span>
      <span>${esc(idioma.pie.hecho)}</span>
    </div>
  </div>
</footer>`;
}

function cierre(idioma, { h2, p, cta, ctaHref, cta2, cta2Href }) {
  return `<section class="seccion">
    <div class="envoltura">
      <div class="cierre">
        <h2>${esc(h2)}</h2>
        <p>${esc(p)}</p>
        <div class="acciones">
          <a href="${ctaHref}" class="boton boton-principal">${esc(cta)}</a>
          ${cta2 ? `<a href="${cta2Href}" class="boton boton-secundario">${esc(cta2)}</a>` : ""}
        </div>
      </div>
    </div>
  </section>`;
}

function preguntas(lista) {
  return `<div class="preguntas">
        ${lista
          .map(
            (x) => `<details class="pregunta">
          <summary>${esc(x.q)}</summary>
          <div class="respuesta">${x.a.map((p) => `<p>${fuerte(p)}</p>`).join("")}</div>
        </details>`
          )
          .join("\n        ")}
      </div>`;
}

function documento(idioma, pagina, { meta, cuerpo, jsonLd = [], estiloExtra = "" }) {
  const alternos = IDIOMAS.map(
    (otro) => `<link rel="alternate" hreflang="${otro.lang}" href="${DOMINIO}${url(otro, pagina)}">`
  ).join("\n");
  return `<!doctype html>
<html lang="${idioma.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-title" content="logiciel-construction">
<meta name="mobile-web-app-capable" content="yes">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.desc)}">
<link rel="canonical" href="${DOMINIO}${url(idioma, pagina)}">
${alternos}
<link rel="alternate" hreflang="x-default" href="${DOMINIO}${url(REFERENCIA, pagina)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${idioma.lang.replace("-", "_")}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.desc)}">
<meta property="og:url" content="${DOMINIO}${url(idioma, pagina)}">
<meta name="theme-color" content="#1546A0">
<link rel="icon" href="/icons/favicon.ico" sizes="any">
<link rel="icon" href="/sitio/logo.png" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/sitio/estilo.css">
${PRECARGA}
${estiloExtra}
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body>
${cabecera(idioma, pagina)}
<main>
${cuerpo}
</main>
${pie(idioma)}
<script src="/sitio/sitio.js" defer></script>
</body>
</html>
`;
}

// ---------- Las páginas ----------

function paginaInicio(idioma) {
  const t = idioma.inicio;
  const e = t.escena;
  return documento(idioma, "inicio", {
    meta: t.meta,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Logiciel Construction",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        inLanguage: idioma.lang,
        description: t.meta.desc,
        areaServed: { "@type": "AdministrativeArea", name: "Québec, Canada" },
        offers: [
          { "@type": "Offer", name: "Chantier", price: String(PRECIOS.chantier.mes), priceCurrency: "CAD" },
          { "@type": "Offer", name: "Entreprise", price: String(PRECIOS.entreprise.mes), priceCurrency: "CAD" },
        ],
      },
    ],
    cuerpo: `  <section class="portada">
    <div class="envoltura">
      <p class="sobretitulo">${esc(t.sobretitulo)}</p>
      <h1>${esc(t.h1)}</h1>
      <p class="entradilla">${esc(t.entradilla)}</p>
      <div class="acciones">
        <a href="${REGISTRO}" class="boton boton-principal">${esc(t.cta)}
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="${url(idioma, "funciones")}" class="boton boton-secundario">${esc(t.cta2)}</a>
      </div>
      <p class="bajo-acciones">${esc(t.bajo)}</p>

      <div class="escena">
        <div class="flotante f-gps aparece">
          <h4>${esc(e.gpsTitulo)}</h4>
          <div style="height:96px;border-radius:10px;background:var(--superficie-2);position:relative;overflow:hidden;margin-bottom:10px">
            <svg viewBox="0 0 260 96" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">
              <path d="M0 74 L54 60 L96 66 L150 34 L204 42 L260 20" fill="none" stroke="var(--azul)" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="150" cy="34" r="7" fill="var(--azul)"/><circle cx="150" cy="34" r="13" fill="var(--azul)" opacity=".18"/>
            </svg>
          </div>
          <div class="mini-fila"><span>${esc(e.gpsQuien)}</span><span class="pastilla pastilla-verde">${esc(e.gpsEstado)}</span></div>
          <div class="mini-fila"><span>${esc(e.gpsLlegada)}</span><span class="val">7 h 04</span></div>
        </div>

        <div class="flotante f-nomina aparece">
          <h4>${esc(e.nominaTitulo)}</h4>
          <div class="mini-fila"><span>${esc(e.nominaNormales)}</span><span class="val">1 120,00 $</span></div>
          <div class="mini-fila"><span>${esc(e.nominaExtra)}</span><span class="val">252,00 $</span></div>
          <div class="mini-fila"><span>${esc(e.nominaRetenciones)}</span><span class="val">−112,84 $</span></div>
          <div class="mini-total"><span>${esc(e.nominaNeto)}</span><span class="val">1 259,16 $</span></div>
        </div>

        <div class="flotante f-factura aparece">
          <h4>${esc(e.facturaTitulo)}</h4>
          <div class="mini-fila"><span>${esc(e.facturaTrabajos)}</span><span class="val">5 000,00 $</span></div>
          <div class="mini-fila"><span>${esc(e.facturaTps)}</span><span class="val">250,00 $</span></div>
          <div class="mini-fila"><span>${esc(e.facturaTvq)}</span><span class="val">498,75 $</span></div>
          <div class="mini-fila"><span>${esc(e.facturaRetencion)}</span><span class="val">−500,00 $</span></div>
          <div class="mini-total"><span>${esc(e.facturaPagar)}</span><span class="val">5 248,75 $</span></div>
        </div>

        <div class="flotante f-integra aparece">
          <h4>${esc(e.integraTitulo)}</h4>
          <div class="logos-integra">
            <span class="logo-chip"><svg viewBox="0 0 24 24" fill="none" stroke="var(--verde)" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M15 9.5a3.5 3.5 0 1 0 0 5M9 14.5a3.5 3.5 0 1 1 0-5" stroke-linecap="round"/></svg>QuickBooks</span>
            <span class="logo-chip"><svg viewBox="0 0 24 24" fill="none" stroke="var(--azul)" stroke-width="2.2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>${esc(e.integraTarjeta)}</span>
          </div>
          <p style="font-size:14px;color:var(--tinta-2);margin-top:11px">${esc(e.integraPie)}</p>
        </div>

        <div class="escena-centro">
          <div class="telefono-marco" aria-hidden="true">
            <div class="telefono-boton telefono-boton-silencio"></div>
            <div class="telefono-boton telefono-boton-volumen telefono-boton-volumen-1"></div>
            <div class="telefono-boton telefono-boton-volumen telefono-boton-volumen-2"></div>
            <div class="telefono-boton telefono-boton-encendido"></div>
          </div>
          <div class="pantalla">
            <div class="telefono-isla" aria-hidden="true"><span></span></div>
            <div style="background:var(--azul);color:#fff;padding:17px 15px 15px">
              <p style="font-size:12px;opacity:.82;margin-bottom:3px">${esc(e.telFecha)}</p>
              <p style="font-family:var(--display);font-size:22px;font-weight:800;line-height:1.1;letter-spacing:-.03em">${esc(e.telObra)}</p>
            </div>
            <div style="padding:14px;display:grid;gap:10px;flex:1">
              <div style="border:1px solid var(--linea);border-radius:12px;padding:12px">
                <p style="font-size:12px;color:var(--apagado);margin-bottom:5px">${esc(e.telEnCurso)}</p>
                <p style="font-weight:600;font-size:15px">${esc(e.telTarea)}</p>
                <p style="font-size:13px;color:var(--tinta-2);margin-top:4px">${esc(e.telGente)}</p>
              </div>
              <div style="border:1px solid var(--linea);border-radius:12px;padding:12px">
                <p style="font-size:12px;color:var(--apagado);margin-bottom:5px">${esc(e.telHoy)}</p>
                <p style="font-weight:600;font-size:15px">${esc(e.telHora)}</p>
                <p style="font-size:13px;color:var(--verde);margin-top:4px">${esc(e.telFichado)}</p>
              </div>
              <div style="margin-top:auto;background:var(--senal);color:#fff;border-radius:12px;padding:13px;text-align:center;font-weight:600;font-size:15px">${esc(e.telFoto)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="seccion seccion-clara">
    <div class="envoltura">
      <div class="encabezado-seccion">
        <p class="sobretitulo">${esc(t.cifrasSobre)}</p>
        <h2>${esc(t.cifrasH2)}</h2>
        <p class="entradilla">${esc(t.cifrasEntradilla)}</p>
      </div>
      <div class="cifras">
        ${t.cifras
          .map((c) => `<div class="cifra-caja aparece"><p class="valor">${esc(c.valor)}</p><p class="etiqueta">${esc(c.etiqueta)}</p></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section class="seccion">
    <div class="envoltura">
      <div class="encabezado-seccion">
        <p class="sobretitulo">${esc(t.razonesSobre)}</p>
        <h2>${esc(t.razonesH2)}</h2>
      </div>
      <div class="razones">
        ${t.razones
          .map((r, i) => `<div class="razon aparece"><p class="cifra">0${i + 1}</p><h3>${esc(r.t)}</h3><p>${esc(r.p)}</p></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section class="seccion seccion-oscura">
    <div class="envoltura">
      <div class="encabezado-seccion">
        <p class="sobretitulo">${esc(t.remplazaSobre)}</p>
        <h2>${esc(t.remplazaH2)}</h2>
        <p class="entradilla">${esc(t.remplazaEntradilla)}</p>
      </div>
      <div class="rejilla rejilla-3">
        ${t.remplaza
          .map(
            (x, i) =>
              `<div class="tarjeta"><div class="icono">${ICONOS[["chantier", "dinero", "clientes"][i]]}</div><h3>${esc(x.t)}</h3><p>${esc(x.p)}</p></div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section class="seccion seccion-clara">
    <div class="envoltura">
      <div class="rejilla rejilla-2" style="margin-top:0;align-items:center;gap:44px">
        <div>
          <p class="sobretitulo">${esc(t.idiomasSobre)}</p>
          <h2 style="margin-top:11px">${esc(t.idiomasH2)}</h2>
          <p class="entradilla" style="margin-top:16px">${esc(t.idiomasP1)}</p>
          <p class="entradilla" style="margin-top:14px">${esc(t.idiomasP2)}</p>
        </div>
        <div class="rejilla rejilla-2" style="margin-top:0;gap:12px">
          ${IDIOMAS.map(
            (o) => `<div class="tarjeta" style="padding:19px"><h4>${esc(o.nombre)}</h4><p style="font-size:15px;margin-top:6px">${esc(o.inicio.ejemploTarea)}</p></div>`
          ).join("\n          ")}
        </div>
      </div>
    </div>
  </section>

  <section class="seccion">
    <div class="envoltura estrecho">
      <p class="sobretitulo">${esc(t.preguntasSobre)}</p>
      <h2 style="margin-top:11px">${esc(t.preguntasH2)}</h2>
      ${preguntas(t.preguntas)}
    </div>
  </section>

${cierre(idioma, {
  h2: t.cierreH2,
  p: t.cierreP,
  cta: t.cierreCta,
  ctaHref: REGISTRO,
  cta2: t.cierreCta2,
  cta2Href: url(idioma, "precios"),
})}`,
  });
}

function paginaFunciones(idioma) {
  const t = idioma.funciones;
  return documento(idioma, "funciones", {
    meta: t.meta,
    cuerpo: `  <section class="portada" style="padding-bottom:0">
    <div class="envoltura">
      <p class="sobretitulo">${esc(t.sobretitulo)}</p>
      <h1 style="font-size:clamp(34px,5.4vw,58px);max-width:18ch">${esc(t.h1)}</h1>
      <p class="entradilla" style="margin-top:20px">${esc(t.entradilla)}</p>
    </div>
  </section>

  <section class="seccion" style="padding-top:24px">
    <div class="envoltura">
      ${t.bloques
        .map(
          (b) => `<div class="bloque">
        <div class="bloque-rejilla">
          <div>
            <div class="icono">${ICONOS[b.icono]}</div>
            <h2 style="font-size:clamp(26px,3.2vw,35px)">${esc(b.t)}</h2>
            <p class="entradilla" style="margin-top:14px">${esc(b.p)}</p>
          </div>
          <ul class="lista-limpia">
            ${b.items
              .map(
                (i) =>
                  `<li>${CHECK}<span><strong>${esc(i.t)}</strong>${esc(i.p)}${
                    i.enlace ? ` <a href="${url(idioma, i.enlace)}" style="color:var(--azul)">${esc(i.enlaceTexto)}</a>.` : ""
                  }</span></li>`
              )
              .join("\n            ")}
          </ul>
        </div>
      </div>`
        )
        .join("\n      ")}
    </div>
  </section>

  <section class="seccion seccion-oscura">
    <div class="envoltura">
      <div class="encabezado-seccion">
        <p class="sobretitulo">${esc(t.noSobre)}</p>
        <h2>${esc(t.noH2)}</h2>
      </div>
      <div class="rejilla rejilla-3">
        ${t.no.map((x) => `<div class="tarjeta"><h4>${esc(x.t)}</h4><p style="margin-top:9px">${esc(x.p)}</p></div>`).join("\n        ")}
      </div>
    </div>
  </section>

${cierre(idioma, {
  h2: t.cierreH2,
  p: t.cierreP,
  cta: t.cierreCta,
  ctaHref: REGISTRO,
  cta2: t.cierreCta2,
  cta2Href: url(idioma, "precios"),
})}`,
  });
}

function paginaCcq(idioma) {
  const t = idioma.ccq;
  return documento(idioma, "ccq", {
    meta: t.meta,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: idioma.lang,
        mainEntity: t.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    cuerpo: `  <section class="portada" style="padding-bottom:0">
    <div class="envoltura">
      <p class="sobretitulo">${esc(t.sobretitulo)}</p>
      <h1 style="font-size:clamp(32px,4.8vw,54px);max-width:21ch">${esc(t.h1)}</h1>
      <p class="entradilla" style="margin-top:20px">${esc(t.entradilla)}</p>
    </div>
  </section>

  <section class="seccion">
    <div class="envoltura">
      <article class="prosa">
        <h2>${esc(t.h2ccq)}</h2>
        <p>${fuerte(t.pccq)}</p>
        <h3>${esc(t.h3fecha)}</h3>
        <p>${fuerte(t.pfecha1)}</p>
        <p>${fuerte(t.pfecha2)}</p>
        <h3>${esc(t.h3semana)}</h3>
        <p>${fuerte(t.psemana)}</p>
        <h3>${esc(t.h3oficio)}</h3>
        <p>${fuerte(t.poficio1)}</p>
        <p>${fuerte(t.poficio2)}</p>
        <div class="aviso"><p>${fuerte(t.avisoCcq1)}</p><p>${fuerte(t.avisoCcq2)}</p></div>

        <h2>${esc(t.h2retencion)}</h2>
        <p>${fuerte(t.pretencion)}</p>
        <h3>${esc(t.h3error)}</h3>
        <p>${fuerte(t.perror)}</p>
        <div class="tabla-scroll">
          <table>
            <thead><tr><th>${esc(t.tablaCabecera)}</th><th>${esc(t.tablaMonto)}</th></tr></thead>
            <tbody>
              ${t.tabla.map(([a, b]) => `<tr><td>${fuerte(a)}</td><td class="n">${fuerte(b)}</td></tr>`).join("\n              ")}
            </tbody>
          </table>
        </div>
        <p>${fuerte(t.polvidar)}</p>

        <h2>${esc(t.h2taxes)}</h2>
        <div class="tabla-scroll">
          <table>
            <thead><tr>${t.taxesCab.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
            <tbody>
              ${t.taxes.map((f) => `<tr><td>${esc(f[0])}</td><td class="n">${esc(f[1])}</td><td>${esc(f[2])}</td></tr>`).join("\n              ")}
            </tbody>
          </table>
        </div>
        <p>${fuerte(t.ptaxes1)}</p>
        <p>${fuerte(t.ptaxes2)}</p>

        <h2>${esc(t.h2resto)}</h2>
        <p>${fuerte(t.presto)}</p>
        <ul>${t.resto.map((x) => `<li>${fuerte(x)}</li>`).join("")}</ul>
        <p>${fuerte(t.prestoCierre)}</p>

        <div class="aviso"><p>${fuerte(t.descargo)}</p></div>
      </article>
    </div>
  </section>

${cierre(idioma, {
  h2: t.cierreH2,
  p: t.cierreP,
  cta: t.cierreCta,
  ctaHref: REGISTRO,
  cta2: t.cierreCta2,
  cta2Href: url(idioma, "funciones"),
})}`,
  });
}

function paginaPrecios(idioma) {
  const t = idioma.precios;
  const plan = (p, precios, destacado) => `<div class="plan${destacado ? " destacado" : ""}">
          ${destacado ? `<span class="insignia">${esc(t.destacado)}</span>` : ""}
          <h3>${esc(p.nombre)}</h3>
          <p class="para">${esc(p.para)}</p>
          <div class="precio dato-mes">${precios.mes} $<span class="u">${esc(t.mes)}</span></div>
          <div class="precio dato-ano" hidden>${precios.ano} $<span class="u">${esc(t.ano)}</span><span class="ahorro">${esc(t.ahorro)}</span></div>
          <p class="pie-nota">${esc(p.limite)}</p>
          <ul>${p.items.map((i) => `<li>${CHECK}<span>${fuerte(i)}</span></li>`).join("")}</ul>
          <a href="${REGISTRO}" class="boton ${destacado ? "boton-principal" : "boton-secundario"}">${esc(t.probar)}</a>
        </div>`;

  return documento(idioma, "precios", {
    meta: t.meta,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Logiciel Construction",
        description: t.meta.desc,
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "CAD",
          lowPrice: String(PRECIOS.chantier.mes),
          highPrice: String(PRECIOS.entreprise.ano),
          offerCount: 4,
        },
      },
    ],
    cuerpo: `  <section class="portada" style="padding-bottom:0">
    <div class="envoltura">
      <p class="sobretitulo">${esc(t.sobretitulo)}</p>
      <h1 style="font-size:clamp(34px,5.4vw,58px);max-width:17ch">${esc(t.h1)}</h1>
      <p class="entradilla" style="margin-top:20px">${esc(t.entradilla)}</p>
    </div>
  </section>

  <section class="seccion" style="padding-top:36px">
    <div class="envoltura">
      <div class="periodo-toggle" role="tablist" aria-label="${esc(t.periodoLabel)}">
        <button type="button" role="tab" class="activo" data-periodo="mes">${esc(t.mesBoton)}</button>
        <button type="button" role="tab" data-periodo="ano">${esc(t.anoBoton)}<span class="etiqueta-ahorro">${esc(t.ahorro)}</span></button>
      </div>
      <div class="planes">
        ${plan(t.chantier, PRECIOS.chantier, false)}
        ${plan(t.entreprise, PRECIOS.entreprise, true)}
      </div>
      <div class="rejilla rejilla-3" style="margin-top:44px">
        ${t.extras.map((x) => `<div class="tarjeta"><h4>${esc(x.t)}</h4><p style="margin-top:10px">${esc(x.p)}</p></div>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="seccion seccion-clara">
    <div class="envoltura estrecho">
      <p class="sobretitulo">${esc(t.compararSobre)}</p>
      <h2 style="margin-top:11px">${esc(t.compararH2)}</h2>
      <p class="entradilla" style="margin-top:16px">${esc(t.compararP1)}</p>
      <p class="entradilla" style="margin-top:14px">${esc(t.compararP2)}</p>
      ${preguntas(t.preguntas)}
    </div>
  </section>

${cierre(idioma, { h2: t.cierreH2, p: t.cierreP, cta: t.cierreCta, ctaHref: REGISTRO })}`,
  });
}

function paginaContacto(idioma) {
  const t = idioma.contacto;
  return documento(idioma, "contacto", {
    meta: t.meta,
    cuerpo: `  <section class="seccion">
    <div class="envoltura">
      <div class="rejilla rejilla-2" style="margin-top:0;gap:48px;align-items:start">
        <div>
          <p class="sobretitulo">${esc(t.sobretitulo)}</p>
          <h1 style="font-size:clamp(32px,4.6vw,52px);margin-top:12px;max-width:15ch">${esc(t.h1)}</h1>
          <p class="entradilla" style="margin-top:18px">${esc(t.entradilla)}</p>

          <!-- El bot primero y el formulario después, y en ese orden en la
               página: el bot contesta ahora y nosotros mañana. Ponerlos al
               revés sería cambiarle a alguien una respuesta inmediata por una
               espera de un día, y encima quedándonos el trabajo. -->
          <div class="tarjeta" style="padding:22px;margin-top:30px;border-color:var(--azul);background:var(--azul-claro)">
            <h4>${esc(t.primeroTitulo)}</h4>
            <p style="margin-top:8px;font-size:15.5px;color:var(--tinta-2)">${esc(t.primeroP)}</p>
            <a href="/" class="boton boton-secundario" style="margin-top:16px">${esc(t.primeroCta)}</a>
          </div>

          <div class="rejilla" style="grid-template-columns:1fr;gap:12px;margin-top:22px">
            ${t.ventajas.map((v) => `<div class="tarjeta" style="padding:19px"><h4>${esc(v.t)}</h4><p style="margin-top:7px;font-size:15.5px">${esc(v.p)}</p></div>`).join("\n            ")}
          </div>
        </div>

        <div class="tarjeta" style="padding:clamp(22px,4vw,34px)">
          <h2 style="font-size:26px">${esc(t.formTitulo)}</h2>
          <p style="color:var(--tinta-2);margin-top:9px;font-size:15.5px">${esc(t.formEntradilla)}</p>
          <form id="formulario" style="margin-top:22px" novalidate
                data-faltan="${esc(t.faltan)}" data-enviado="${esc(t.enviado)}" data-fallo="${esc(t.fallo)}"
                data-abrir="${esc(t.abrirCorreo)}" data-asunto="${esc(t.asuntoCorreo)}"
                data-enviar="${esc(t.enviar)}" data-enviando="${esc(t.enviando)}">
            <div class="campo"><label for="nombre">${esc(t.campoNombre)}</label><input id="nombre" name="nombre" type="text" autocomplete="name" required></div>
            <div class="campo"><label for="empresa">${esc(t.campoEmpresa)}</label><input id="empresa" name="empresa" type="text" autocomplete="organization"></div>
            <div class="dos-campos">
              <div class="campo"><label for="telefono">${esc(t.campoTelefono)}</label><input id="telefono" name="telefono" type="tel" autocomplete="tel" inputmode="tel"></div>
              <div class="campo"><label for="correo">${esc(t.campoCorreo)}</label><input id="correo" name="correo" type="email" autocomplete="email" inputmode="email"></div>
            </div>
            <div class="campo">
              <label for="mensaje">${esc(t.campoMensaje)}</label>
              <textarea id="mensaje" name="mensaje" placeholder="${esc(t.mensajePlaceholder)}" required></textarea>
            </div>
            <button type="submit" class="boton boton-principal" id="enviar">${esc(t.enviar)}</button>
            <div id="resultado" hidden></div>
            <p class="pie-nota">${esc(t.privacidadNota)} <a href="${url(idioma, "privacidad")}" style="color:var(--azul)">${esc(t.privacidadEnlace)}</a>.</p>
          </form>
        </div>
      </div>
    </div>
  </section>`,
  });
}

// ---------- Legales, desde los idiomas de la aplicación ----------

let LOCALES = null;
function locales() {
  if (LOCALES) return LOCALES;
  LOCALES = {};
  for (const idioma of IDIOMAS) {
    const ruta = path.join(RAIZ, "client/src/i18n/locales", `${idioma.codigo}.json`);
    LOCALES[idioma.codigo] = JSON.parse(fs.readFileSync(ruta, "utf-8")).legal;
  }
  return LOCALES;
}

const legalTitulo = (idioma, cual) =>
  locales()[idioma.codigo][cual === "privacy" ? "privacyTitle" : "termsTitle"];

function paginaLegal(idioma, cual) {
  const L = locales()[idioma.codigo];
  const pagina = cual === "privacy" ? "privacidad" : "condiciones";
  const titulo = legalTitulo(idioma, cual);
  const lead = cual === "privacy" ? L.privacyLead : L.termsLead;
  const secciones = L[cual === "privacy" ? "privacy" : "terms"];

  return documento(idioma, pagina, {
    meta: { title: `${titulo} — Logiciel Construction`, desc: lead },
    cuerpo: `  <section class="portada" style="padding-bottom:0">
    <div class="envoltura estrecho">
      <p class="sobretitulo">${esc(L.updated.replace("{{date}}", L.updatedOn))}</p>
      <h1 style="font-size:clamp(32px,4.6vw,52px);margin-top:10px">${esc(titulo)}</h1>
      <p class="entradilla" style="margin-top:18px">${esc(lead)}</p>
    </div>
  </section>

  <section class="seccion">
    <div class="envoltura estrecho">
      <article class="prosa">
        ${secciones
          .map((s) => `<h2 id="${esc(s.id)}">${esc(s.title)}</h2>\n        ${s.body.map((p) => `<p>${fuerte(p)}</p>`).join("\n        ")}`)
          .join("\n        ")}
        <div class="aviso" style="margin-top:44px">
          <p><strong>${esc(idioma.legal.titular)}</strong></p>
          <p>${esc(L.holder)}<br>${esc(L.address)}<br><a href="mailto:${esc(L.email)}" style="color:var(--azul)">${esc(L.email)}</a></p>
        </div>
        <p style="margin-top:32px"><a href="${url(idioma, "inicio")}" style="color:var(--azul);font-weight:600">← ${esc(idioma.legal.volver)}</a></p>
      </article>
    </div>
  </section>`,
  });
}

// ---------- Escribir ----------

function escribir() {
  comprobarParidad();
  fs.rmSync(SALIDA, { recursive: true, force: true });

  const rutas = [];
  for (const idioma of IDIOMAS) {
    const dir = path.join(SALIDA, idioma.codigo);
    fs.mkdirSync(dir, { recursive: true });

    const paginas = [
      ["inicio", paginaInicio(idioma)],
      ["funciones", paginaFunciones(idioma)],
      ["ccq", paginaCcq(idioma)],
      ["precios", paginaPrecios(idioma)],
      ["contacto", paginaContacto(idioma)],
      ["privacidad", paginaLegal(idioma, "privacy")],
      ["condiciones", paginaLegal(idioma, "terms")],
    ];

    for (const [nombre, html] of paginas) {
      const fichero = `${idioma.rutas[nombre] || "index"}.html`;
      fs.writeFileSync(path.join(dir, fichero), html);
      rutas.push({ ruta: url(idioma, nombre), fichero: `${idioma.codigo}/${fichero}` });
    }
  }

  // El mapa que lee el servidor. Generado, para que añadir una página no
  // obligue a acordarse de tocar `server/index.ts`.
  fs.writeFileSync(path.join(SALIDA, "rutas.json"), JSON.stringify(rutas, null, 2) + "\n");

  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    ["inicio", "funciones", "ccq", "precios", "contacto", "privacidad", "condiciones"]
      .map((p) =>
        IDIOMAS.map(
          (idioma) =>
            `  <url>\n    <loc>${DOMINIO}${url(idioma, p)}</loc>\n` +
            IDIOMAS.map((o) => `    <xhtml:link rel="alternate" hreflang="${o.lang}" href="${DOMINIO}${url(o, p)}"/>\n`).join("") +
            `  </url>`
        ).join("\n")
      )
      .join("\n") +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(SALIDA, "sitemap.xml"), sitemap);

  fs.writeFileSync(
    path.join(SALIDA, "robots.txt"),
    `User-agent: *\nAllow: /\n\n# El panel, el portal y la app del trabajador no se indexan: son pantallas\n# detrás de credenciales y en los resultados de búsqueda no le sirven a nadie.\nDisallow: /api/\nDisallow: /campo\nDisallow: /portal\n\nSitemap: ${DOMINIO}/sitemap.xml\n`
  );

  for (const f of ["estilo.css", "sitio.js", "logo.png"]) fs.copyFileSync(path.join(AQUI, f), path.join(SALIDA, f));

  // Las letras se copian enteras y sin lista escrita a mano: añadir un peso
  // nuevo en `estilo.css` no puede depender de que alguien se acuerde de
  // nombrarlo también aquí, porque el fallo sería una página que pinta bien
  // en local y con la letra de reserva en producción.
  fs.rmSync(path.join(SALIDA, "fuentes"), { recursive: true, force: true });
  fs.cpSync(path.join(AQUI, "fuentes"), path.join(SALIDA, "fuentes"), { recursive: true });

  comprobarEnlaces(rutas);
  console.log(`sitio ok — ${rutas.length} páginas en ${IDIOMAS.length} idiomas, ${IDIOMAS.map((i) => i.codigo).join(" ")}`);
}

/**
 * Ningún botón puede llevar a una página que no existe.
 *
 * Con cuatro idiomas y direcciones distintas en cada uno —`/fr/tarifs` y
 * `/es/precios` son la misma página— un enlace mal puesto no falla: lleva al
 * catch-all de la aplicación, que devuelve el panel con un 200. Nadie se
 * entera hasta que un contratista pulsa «Tarifs» y aterriza en una pantalla de
 * inicio de sesión.
 */
function comprobarEnlaces(rutas) {
  const validas = new Set(rutas.map((r) => r.ruta));
  const deLaAplicacion = rutasDeLaAplicacion();
  // Lo que no es una página tiene que ser un archivo que exista de verdad. Se
  // comprueba en el disco en vez de llevar una lista de excepciones escrita a
  // mano: una lista hay que acordarse de ampliarla, y olvidarse significa o
  // bien un aviso falso, o bien —peor— apuntar a una fuente que no se copió y
  // que en producción sale como letra de reserva sin que nadie se entere.
  const donde = (camino) =>
    camino.startsWith("/sitio/")
      ? path.join(SALIDA, camino.slice("/sitio/".length))
      : path.join(RAIZ, "client", "public", camino.slice(1));

  const rotos = [];
  let paginas = 0;
  let ficheros = 0;

  for (const idioma of IDIOMAS) {
    const dir = path.join(SALIDA, idioma.codigo);
    for (const fichero of fs.readdirSync(dir)) {
      const html = fs.readFileSync(path.join(dir, fichero), "utf-8");
      // `href` y `src`: el logo entra por `src`, y una imagen que falta se ve
      // igual de mal que un enlace roto.
      for (const [, destino] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (/^(https?:|mailto:|#|data:)/.test(destino)) continue;
        if (validas.has(destino) || deLaAplicacion.has(destino)) {
          paginas += 1;
          continue;
        }
        ficheros += 1;
        if (!fs.existsSync(donde(destino))) rotos.push(`${idioma.codigo}/${fichero} → ${destino}`);
      }
    }
  }

  if (rotos.length) {
    console.error("Enlaces que no llevan a ninguna parte:\n" + [...new Set(rotos)].map((r) => `  · ${r}`).join("\n"));
    process.exit(1);
  }
  console.log(`enlaces ok — ${paginas} a páginas que existen, ${ficheros} a archivos que están`);
}

/**
 * Las direcciones de la aplicación a las que el sitio puede mandar gente.
 *
 * El sitio ya no lleva sólo a `/`: el botón de «probar 30 días» lleva a crear
 * la cuenta. Eso es un enlace que sale del sitio y entra en la aplicación, y
 * si esa pantalla se renombra el botón no falla — cae al catch-all y devuelve
 * el panel con un 200, que es la misma trampa de siempre.
 *
 * Así que se leen del router de verdad en vez de escribirlas aquí. Sólo las
 * públicas: las del panel están detrás de la sesión y mandar a un desconocido
 * a una de ellas es mandarle a un inicio de sesión que no pidió.
 */
function rutasDeLaAplicacion() {
  const app = fs.readFileSync(path.join(RAIZ, "client", "src", "App.tsx"), "utf-8");
  // `Router()` es lo que hay antes de que el panel tome el control; las rutas
  // del panel viven en su propio componente, más arriba del archivo.
  const router = app.slice(app.indexOf("function Router("));
  const encontradas = [...router.matchAll(/<Route\s+path=\{"([^"]+)"\}/g)].map((m) => m[1]);
  const publicas = new Set(encontradas.filter((r) => !r.includes(":")));

  if (!publicas.has(REGISTRO)) {
    console.error(`El sitio manda a ${REGISTRO} y esa pantalla ya no está en el router de la aplicación.`);
    process.exit(1);
  }
  return publicas;
}

escribir();
