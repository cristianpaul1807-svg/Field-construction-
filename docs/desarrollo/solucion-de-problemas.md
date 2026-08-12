# Solución de problemas

Diagnóstico antes que suposiciones. Cada apartado empieza por el síntoma que
se ve, no por la causa.

---

## No puedo iniciar sesión

Es tres problemas distintos con la misma apariencia. Distínguelos en este
orden:

**1. ¿Contesta el servidor?**

```bash
curl -s https://tu-dominio/api/health | python3 -m json.tool
```

Si `ok` es `false`, el problema es de configuración, no de tu cuenta. Ver
[despliegue.md](despliegue.md#síntomas-y-causas).

**2. ¿Contesta una ruta pública?**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://tu-dominio/api/public/config
```

Un 500 aquí demuestra que el fallo es del backend, no de la sesión: esta ruta
ni siquiera mira quién llama.

**3. ¿Apuntan el navegador y el servidor al mismo proyecto?**

Compara `supabaseProjectRef` de `/api/health` con `supabaseUrl` de
`/api/public/config`. Si difieren, el frontend está autenticándose contra una
base de datos y el backend consultando otra.

> **La lógica que se corrigió aquí:** antes, cualquier fallo de la API dejaba
> el "persona" en `none` y mandaba al registro. Alguien con una cuenta
> perfectamente válida terminaba en la pantalla de crear cuenta, como si su
> cuenta hubiera desaparecido. Ahora solo un **401** significa "esta sesión ya
> no vale"; cualquier otro fallo muestra la pantalla *No pudimos cargar tu
> cuenta*, con un botón de reintentar. Un servidor que no contesta no dice
> nada sobre quién eres.

---

## Una ruta devuelve 401 solo para clientes o trabajadores

Casi seguro que quedó registrada por debajo de
`apiRouter.use(requireBusinessAuth)` en `server/api.ts`.

```bash
npm run build
node -e "
const s=require('fs').readFileSync('dist/index.js','utf8');
const gate=s.indexOf('requireBusinessAuth);');
for (const r of ['\"/client-portal/me\"','\"/tu/ruta\"']) {
  const i=s.indexOf(r);
  console.log(r.padEnd(30), i<0?'NO EXISTE':(i<gate?'pública/cliente ✓':'panel del negocio'));
}"
```

Muévela por encima del comentario *"Everything below this line is the business
panel"*.

---

## Los números no cuadran

**Sumas que salen como texto pegado** (`"1000500"` en vez de `1500`):
`numeric` de Postgres llega como string. Envuélvelo en `Number()`.

**Un gasto no aparece en Control de costos:** los gastos guardan la categoría
como slug (`mano_obra`) y las partidas del presupuesto como nombre
(`Mano de obra`). Comparar los dos directamente hace que **nada** coincida y
que todo parezca dentro de presupuesto. Ambos lados se normalizan con
`canonical()` en la ruta `/cost-tracking`. Si añades una categoría nueva,
añádela también ahí.

**Céntimos que bailan:** redondea una sola vez, en el punto en que el número
se convierte en algo que una persona lee: `Math.round(x * 100) / 100`.

**El total de un proyecto parece bajo:** ¿estás sumando las órdenes de cambio
aprobadas? Ver [../funciones/proyectos.md](../funciones/proyectos.md#órdenes-de-cambio).

---

## Falta un texto o sale el slug crudo

Se ve `en_progreso` en lugar de "En progreso": falta la clave en el grupo de
estados. Ver [idiomas.md](idiomas.md#valores-guardados-se-traducen-al-mostrar-nunca-al-guardar).

Sale bien en español y en inglés no: no se usó
`scripts/i18n-add-keys.py`, que es lo que garantiza la paridad. Ejecuta la
comprobación de paridad de esa misma guía.

---

## Mirar la pantalla de verdad

Compilar sin errores no dice nada sobre si algo se ve bien. En este proyecto,
mirar la pantalla encontró un mapa que no se centraba, una selección larga
que se deseleccionaba sola y un pie de página que caía fuera de la hoja.

```bash
npx vite --host --port 5188
```

Captura automática, con idioma y errores de consola:

```js
// shot.mjs — node shot.mjs
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ locale: "fr-CA", viewport: { width: 1000, height: 700 } });
const p = await ctx.newPage();
p.on("pageerror", e => console.log("ERROR:", e.message.slice(0, 200)));
p.on("requestfailed", r => console.log("FALLÓ:", r.url()));
await p.goto("http://localhost:5188/iniciar-sesion", { waitUntil: "networkidle" });
console.log(await p.evaluate(() => document.body.innerText.slice(0, 300)));
await p.screenshot({ path: "captura.png" });
await b.close();
```

Chromium ya está instalado en `/opt/pw-browsers/chromium`. No ejecutes
`playwright install`.

---

## Revisar un PDF generado

```bash
npx tsx script-que-llama-a-renderEstimatePdf.ts   # escribe el .pdf
```

Y ábrelo como imagen para verlo. Si `pdftoppm` no está:

```bash
apt-get install -y poppler-utils
```

Cosas que solo se ven mirando el PDF: una columna desalineada, un texto que
se sale de la caja, un pie que cae fuera de la hoja, un acento que no existe
en la fuente.

---

## Antes de dar algo por terminado

```bash
npx tsc --noEmit     # en silencio
npm run build        # sin errores
```

Más:

- paridad de idiomas ([idiomas.md](idiomas.md#comprobar-que-todo-está-bien))
- `get_advisors(type: "security")` si tocaste el esquema
- la pantalla, en un navegador
- `/api/health` después de desplegar
