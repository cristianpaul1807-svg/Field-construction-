# Arquitectura

## Qué es este sistema

Una plataforma todo-en-uno para gestionar una empresa de construcción en
Canadá: desde que un cliente potencial escribe por primera vez, hasta que la
última factura está cobrada.

Lo que la distingue de un CRM genérico es que entiende cómo se cobra una obra
en Canadá — impuestos por provincia, retención sobre los pagos parciales,
órdenes de cambio — y que el cliente final y los trabajadores entran sin
necesitar correo ni contraseña.

## Las cuatro puertas de entrada

Un solo despliegue sirve a cuatro tipos de usuario, y cada uno se autentica
distinto. Esto es lo primero que hay que entender.

```
                        ┌──────────────────────────┐
   dueño / oficina ───▶ │  Panel del negocio       │  sesión Supabase Auth
                        │  (todo el menú)          │  (correo + contraseña)
                        └──────────────────────────┘

                        ┌──────────────────────────┐
   cliente final  ───▶  │  Portal del cliente      │  código de acceso
                        │  /portal                 │  o sesión Supabase
                        └──────────────────────────┘

                        ┌──────────────────────────┐
   trabajador     ───▶  │  App de campo (PWA)      │  solo código de acceso
                        │  /campo                  │  (sin correo ni clave)
                        └──────────────────────────┘

                        ┌──────────────────────────┐
   desconocido    ───▶  │  Chat público            │  sin autenticación
                        │  /c/tu-negocio           │
                        └──────────────────────────┘
```

**Por qué los códigos de acceso.** Un trabajador de obra no va a mantener una
contraseña, y pedirle un correo a un cliente para que vea el avance de su
cocina es una barrera que no aporta nada. El negocio genera un código, lo
comparte por donde ya habla con esa persona, y con eso entra. El código se
guarda en la base de datos como un hash SHA-256 (`access_token_hash`), nunca
en claro.

## Piezas

```
client/            React + Vite. Todo lo que se ve.
  src/pages/         una pantalla por entrada del menú
  src/components/    piezas compartidas (diálogos, chat, mapa, layout)
  src/i18n/locales/  es.json / en.json / fr.json / it.json
  src/lib/api.ts     useApi() y apiFetch(): el único sitio que pone el token

server/            Express. Toda la lógica y el acceso a datos.
  api.ts             ~137 rutas
  supabaseAuth.ts    los tres middlewares de autenticación
  supabaseAdmin.ts   cliente con service role (salta RLS)
  documents.ts       generación de PDF (presupuestos y facturas)
  stripe.ts          cliente de Stripe
  flowMessages.ts    textos del bot del chat público, en 4 idiomas

docs/              esta carpeta
```

No hay base de datos local ni archivos de migración. El esquema vive en el
proyecto de Supabase y se cambia con las herramientas MCP de Supabase — ver
[desarrollo/base-de-datos.md](desarrollo/base-de-datos.md).

## Multi-tenant: cómo un negocio no ve al otro

Cada tabla lleva `business_id`. La separación **no** depende de que el código
acuerde filtrar: la impone Postgres con Row Level Security.

```sql
using (business_id = private.current_business_id())
```

`private.current_business_id()` resuelve el negocio a partir de `auth.uid()`,
que viene de la sesión de quien llama. Las rutas del panel usan
`req.supabase`, un cliente que lleva esa misma sesión, así que la política se
aplica sola.

**La excepción:** un trabajador o un cliente que entró por código no tiene
`auth.uid()`. Esas rutas usan `getSupabaseAdmin()` — que salta RLS — y por eso
filtran a mano con `.eq("business_id", …)` y comprueban la propiedad de cada
fila antes de tocarla. Si escribes una ruta así, ese filtro es obligatorio: es
lo único que separa un negocio de otro en ese camino.

## El orden de las rutas importa

En `server/api.ts` hay una línea que parte el archivo en dos:

```ts
apiRouter.use(requireBusinessAuth);
```

- **Arriba:** rutas públicas (`/public/*`), del portal del cliente
  (`/client-portal/*`), del trabajador (`/worker/*`) y de autenticación. Cada
  una trae su propio middleware si lo necesita.
- **Abajo:** el panel del negocio. Todo lo que caiga aquí exige sesión de
  negocio.

Registrar una ruta de cliente por debajo de esa línea la rompe con un 401
silencioso. Ya pasó una vez. Cuando añadas una ruta, comprueba de qué lado
cae:

```bash
node -e "
const fs=require('fs'); const s=fs.readFileSync('dist/index.js','utf8');
const gate=s.indexOf('requireBusinessAuth);');
const i=s.indexOf('\"/tu/ruta\"');
console.log(i<0?'NO EXISTE':(i<gate?'pública/cliente':'panel del negocio'));
"
```

## De dónde saca el navegador su configuración

Las variables `VITE_*` se congelan dentro del bundle **en el momento de
compilar**. En un servidor que inyecta variables de entorno solo en tiempo de
ejecución, eso significa que quedarían vacías para siempre y ningún reinicio
lo arreglaría.

Por eso el arranque hace esto:

1. `client/src/main.tsx` llama a `loadSupabaseConfig()` antes de montar la app.
2. Si el bundle trae valores compilados, los usa.
3. Si no, pide `GET /api/public/config` al servidor, que lee sus propias
   variables de entorno en ese instante.
4. Solo entonces importa `App` dinámicamente, para que nada toque el cliente
   de Supabase antes de que exista la configuración.

Si esa configuración falta, la app no monta y se ve una pantalla de error de
configuración. `GET /api/health` dice exactamente cuál falta.

## Los cuatro idiomas

Inglés, francés, italiano y español, en todo el sistema. Los textos de la
interfaz viven en `client/src/i18n/locales/`. Los textos del bot del chat
público viven en `server/flowMessages.ts` — están en el servidor, y no en el
bundle, porque cada frase se guarda como un mensaje real en la conversación:
la transcripción conserva el idioma en el que se habló, igual que una
conversación entre personas.

Ver [desarrollo/idiomas.md](desarrollo/idiomas.md).
