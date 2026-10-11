/* Lo único que lleva de JavaScript el sitio de presentación.
 *
 * Nada de lo que hay aquí hace falta para leer la página ni para que Google la
 * indexe: el HTML llega entero y el CSS lo pinta. Por eso la clase `js` se
 * pone desde dentro — si el script no corre, no se pone, y el contenido se
 * queda visible donde siempre estuvo.
 */
document.documentElement.classList.add("js");

/* ---------- Entrada al hacer scroll ---------- */
(function () {
  var entran = document.querySelectorAll(".aparece");
  if (!entran.length) return;
  var quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (quieto || !("IntersectionObserver" in window)) {
    entran.forEach(function (el) { el.classList.add("visible"); });
    return;
  }
  var vigia = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("visible");
      vigia.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  entran.forEach(function (el) { vigia.observe(el); });
})();

/* ---------- El vídeo que avanza con el scroll ----------
 *
 * Copiado del motor de Ta Maison, con lo que allí se aprendió en producción:
 *
 * - El vídeo no se pausa nunca. Safari pinta su botón de reproducir encima de
 *   cualquier vídeo pausado, llegue como llegue a ese estado; la única forma
 *   de que no salga es tenerlo «reproduciendo» a velocidad 0. Si el navegador
 *   lo pausa solo (cambio de pestaña, ahorro de batería), se vuelve a cebar.
 * - El scroll es lo único que mueve el fotograma: `currentTime` en un
 *   `requestAnimationFrame`, como mucho uno por pantalla pintada.
 *
 * El archivo (`data-src`) no se pide hasta que la sección está a una pantalla
 * y media: son 6 MB que no tiene por qué pagar quien no baja hasta aquí. Si
 * el navegador no puede con él, el tramo se apaga y queda el reproductor
 * normal, en vez de seis pantallas de póster quieto. */
(function () {
  var tramos = document.querySelectorAll(".scrub");
  if (!tramos.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  tramos.forEach(function (tramo) {
    var video = tramo.querySelector(".scrub-video");
    var completo = tramo.nextElementSibling;
    if (!video || !video.dataset.src) return;
    var relleno = tramo.querySelector(".relleno");
    var cue = tramo.querySelector(".scrub-cue");
    var listo = false;
    var duracion = 0;
    var pendiente = false;

    tramo.classList.add("activo");

    function apagar() {
      tramo.classList.remove("activo");
      document.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
    }

    function cebar() {
      var p = video.play();
      var congelar = function () { video.playbackRate = 0; };
      if (p && typeof p.then === "function") {
        p.then(congelar).catch(function () { try { video.currentTime = 0.01; } catch (e) {} });
      } else {
        congelar();
      }
    }

    function pintar() {
      pendiente = false;
      var caja = tramo.getBoundingClientRect();
      var total = tramo.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      var avance = Math.min(Math.max(-caja.top, 0), total) / total;
      if (listo && duracion && caja.top < window.innerHeight && caja.bottom > 0) {
        video.currentTime = avance * duracion;
      }
      if (relleno) relleno.style.width = avance * 100 + "%";
      if (cue) cue.style.opacity = avance < 0.04 ? 1 : 0;
    }

    function alMover() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(pintar);
    }

    video.addEventListener("loadedmetadata", function () {
      listo = true;
      duracion = video.duration;
      cebar();
      pintar();
    });
    video.addEventListener("pause", function () { if (listo) cebar(); });
    video.addEventListener("error", apagar);

    var vigia = new IntersectionObserver(function (entradas) {
      if (!entradas.some(function (e) { return e.isIntersecting; })) return;
      vigia.disconnect();
      video.src = video.dataset.src;
      video.load();
    }, { rootMargin: "150% 0px 150% 0px" });
    vigia.observe(tramo);

    document.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    pintar();

    // «Con el audio»: el reproductor normal, debajo, y arrancado por el
    // propio toque, que es lo que deja al navegador sonar.
    var boton = completo && completo.querySelector(".ver-con-audio");
    var normal = completo && completo.querySelector(".video-producto video");
    if (boton && normal) {
      boton.addEventListener("click", function () {
        completo.classList.add("abierto");
        boton.hidden = true;
        var p = normal.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
        normal.focus();
      });
    }
  });
})();

/* ---------- Selector de idioma ----------
 *
 * El desplegable es un `<details>`, así que se abre y se cierra sin esto. Lo
 * único que añade el script es cerrarlo al pulsar fuera o con Escape, que es
 * lo que la gente espera de un menú y `<details>` no hace solo. */
(function () {
  var caja = document.querySelector(".idiomas");
  if (!caja) return;
  document.addEventListener("click", function (e) {
    if (caja.open && !caja.contains(e.target)) caja.open = false;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && caja.open) { caja.open = false; caja.querySelector("summary").focus(); }
  });
})();

/* ---------- El formulario ----------
 *
 * Los textos vienen en `data-*` del propio formulario, que es lo que genera
 * `construir.mjs` en el idioma de la página. Así este archivo es uno solo para
 * los cuatro idiomas y no hay ningún texto escrito aquí que se quede sin
 * traducir. */
(function () {
  var form = document.getElementById("formulario");
  if (!form) return;
  var boton = document.getElementById("enviar");
  var salida = document.getElementById("resultado");
  var d = form.dataset;

  function decir(clase, texto) {
    salida.className = "resultado " + clase;
    salida.textContent = texto;
    salida.hidden = false;
  }

  /* Si no se pudo enviar, «escríbenos directamente» sin dirección es un
     callejón. Se pide el buzón al servidor y se ofrece el enlace de verdad,
     con lo que la persona ya escribió dentro para que no lo teclee otra vez. */
  function ofrecerCorreo(datos) {
    fetch("/api/public/config")
      .then(function (r) { return r.json(); })
      .then(function (c) {
        var buzon = c && c.supportEmail;
        if (!buzon) return;
        var cuerpo = Object.keys(datos).map(function (k) { return k + ": " + (datos[k] || ""); }).join("\n");
        var a = document.createElement("a");
        a.href = "mailto:" + buzon + "?subject=" + encodeURIComponent(d.asunto) + "&body=" + encodeURIComponent(cuerpo);
        a.textContent = d.abrir + " " + buzon;
        a.style.cssText = "display:inline-block;margin-top:8px;font-weight:600;color:inherit";
        salida.appendChild(document.createElement("br"));
        salida.appendChild(a);
      })
      .catch(function () {});
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var datos = Object.fromEntries(new FormData(form).entries());
    var hayNombre = String(datos.nombre || "").trim();
    var hayContacto = String(datos.telefono || "").trim() || String(datos.correo || "").trim();
    /* El mensaje es lo único que no se puede deducir ni preguntar después sin
       perder un día, así que sin él no se manda. */
    var hayMensaje = String(datos.mensaje || "").trim();
    if (!hayNombre || !hayContacto || !hayMensaje) { decir("resultado-mal", d.faltan); return; }

    boton.disabled = true;
    boton.textContent = d.enviando;
    fetch("/api/public/soporte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (b) {
        if (b && b.ok) {
          form.querySelectorAll("input, textarea, select").forEach(function (c) { c.value = ""; });
          decir("resultado-ok", d.enviado);
        } else {
          decir("resultado-mal", d.fallo);
          ofrecerCorreo(datos);
        }
      })
      .catch(function () {
        decir("resultado-mal", d.fallo);
        ofrecerCorreo(datos);
      })
      .finally(function () {
        boton.disabled = false;
        boton.textContent = d.enviar;
      });
  });
})();

/* ---------- Selector mensual / anual ---------- */
(function () {
  var toggle = document.querySelector(".periodo-toggle");
  if (!toggle) return;
  var botones = toggle.querySelectorAll("[data-periodo]");
  var planes = document.querySelectorAll(".plan");

  function cambiar(periodo) {
    botones.forEach(function (b) {
      b.classList.toggle("activo", b.getAttribute("data-periodo") === periodo);
      b.setAttribute("aria-selected", b.getAttribute("data-periodo") === periodo ? "true" : "false");
    });
    planes.forEach(function (plan) {
      var mes = plan.querySelector(".dato-mes");
      var ano = plan.querySelector(".dato-ano");
      if (!mes || !ano) return;
      if (periodo === "ano") {
        mes.hidden = true;
        ano.hidden = false;
      } else {
        mes.hidden = false;
        ano.hidden = true;
      }
    });
  }

  botones.forEach(function (b) {
    b.addEventListener("click", function () { cambiar(b.getAttribute("data-periodo")); });
  });
})();
