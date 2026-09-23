/**
 * Que la cuenta de Higgsfield responde y devuelve un vídeo.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/reel/prueba.ts
 *
 * Es la generación más barata que sirve de algo: 5 segundos a 720p. **Cuesta
 * dinero cada vez que se corre**, así que no está en la lista de comprobaciones
 * de `CLAUDE.md` — se lanza a mano cuando se cambian las credenciales o cuando
 * algo falla y hay que saber de qué lado está el problema.
 *
 * Las credenciales viven en `.env.local`, que git ignora, y se cargan con el
 * `--env-file` de Node en vez de con una librería: una dependencia menos para
 * leer una línea.
 */

import { config, higgsfield } from "@higgsfield/client/v2";

const credenciales = process.env.HF_CREDENTIALS;
if (!credenciales) {
  console.error("Falta HF_CREDENTIALS en .env.local, con la forma id-de-clave:secreto.");
  console.error("Y hay que arrancar con --env-file=.env.local, o Node no lo lee.");
  process.exit(1);
}

config({ credentials: credenciales });

const resultado = await higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
  input: {
    prompt: "A cinematic scene at sunset",
    duration: 5,
    resolution: "720p",
    aspect_ratio: "16:9",
  },
  withPolling: true,
});

// `completed` sin vídeo también es un fallo. Dar por buena una respuesta por su
// estado sin mirar si trae lo que se pedía es como acabas diciendo que algo
// funciona cuando no ha salido nada.
if (resultado.status === "completed" && resultado.video?.url) {
  console.log("ok — vídeo generado:");
  console.log(resultado.video.url);
  process.exit(0);
}

const porQue =
  resultado.status === "nsfw"
    ? "lo tumbó el filtro de contenido"
    : resultado.status === "failed"
      ? "la generación falló"
      : resultado.status === "completed"
        ? "dijo que terminó pero no vino ningún vídeo"
        : `se quedó en «${resultado.status}»`;

console.error(`No hay vídeo: ${porQue}.`);
console.error(`petición ${resultado.request_id} — estado en ${resultado.status_url}`);
process.exit(1);
