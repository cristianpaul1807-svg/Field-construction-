/* Lo único que lleva de JavaScript el sitio de presentación.
 *
 * Nada de lo que hay aquí es necesario para leer la página ni para que Google
 * la indexe: el HTML llega entero y el CSS lo pinta. Esto sólo añade la
 * entrada al hacer scroll, y por eso se activa marcando `<html class="js">`
 * desde dentro — si el script no corre, la clase no se pone y el contenido se
 * queda visible donde siempre estuvo.
 */
document.documentElement.classList.add("js");

const entran = document.querySelectorAll(".aparece");
if (entran.length) {
  // Sin `IntersectionObserver` —o con el movimiento reducido— se enseña todo de
  // golpe. Una animación que no se puede observar no puede dejar nada escondido.
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (quieto || !("IntersectionObserver" in window)) {
    entran.forEach((el) => el.classList.add("visible"));
  } else {
    const vigia = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("visible");
          vigia.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    entran.forEach((el) => vigia.observe(el));
  }
}
