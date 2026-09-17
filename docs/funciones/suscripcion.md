# Suscripción: lo que el negocio nos paga a nosotros

**Dónde:** Ajustes → Suscripción (`/suscripcion`)
**Código:** `client/src/pages/Suscripcion.tsx`, las rutas `/suscripcion/*` en
`server/api.ts`, `shared/planes.ts`

---

## No confundirla con Ajustes → Pagos

Son lo contrario y las dos son Stripe, que es exactamente por qué se confunden.

| | Ajustes → **Pagos** | Ajustes → **Suscripción** |
|---|---|---|
| Quién paga | El cliente del contratista | El contratista |
| A quién llega | Al contratista | A nosotros |
| Qué cuenta de Stripe | La **conectada** del negocio (Connect) | La nuestra, de plataforma |
| En el código | `{ stripeAccount: … }` en la llamada | **sin** `stripeAccount` |

Esa última fila es la que importa. El cobro de una factura lleva
`{ stripeAccount: account.stripe_account_id }`, que es lo que hace que el
dinero caiga en la cuenta del contratista. **Nuestra suscripción no lo lleva**,
y no puede llevarlo: si lo hiciera, le estaríamos pagando al contratista su
propia suscripción.

---

## Cómo se usa

En Ajustes → Suscripción. Quien no tiene nada contratado ve los dos planes con
un interruptor de mes/año; quien ya paga ve en qué está, cuándo se renueva, y
un botón que abre el portal de Stripe.

**Cambiar de plan, cambiar la tarjeta, cancelar y descargar facturas no se
hacen aquí.** Se hacen en el portal de Stripe. Ya está traducido a los cuatro
idiomas, con sus confirmaciones y sus reglas de prorrateo, y cada una de esas
pantallas escrita por nosotros sería una forma más de equivocarnos con el
dinero de alguien.

### Los 30 días

Van dentro de la suscripción de Stripe (`trial_period_days`), no en una fecha
nuestra. Así es Stripe quien cuenta los días y quien cobra el día 31 solo. Si
los contáramos nosotros haría falta un trabajo que alguien tiene que acordarse
de correr todas las noches, y el día que no corra no cobra nadie.

Durante la prueba el estado es `trialing` y **el plan está entero**: es lo que
promete el sitio.

---

## Los precios

Dos productos en Stripe, cuatro precios:

| Plan | Al mes | Al año | Clave de búsqueda |
|---|---|---|---|
| Chantier | 99 $ CAD | 990 $ CAD | `chantier_mes`, `chantier_ano` |
| Entreprise | 249 $ CAD | 2 490 $ CAD | `entreprise_mes`, `entreprise_ano` |

**Pagar el año sale dos meses gratis.** Diez por doce y no un porcentaje: «paga
diez meses, usa doce» se explica en una frase. Un 20 % dejaría el Chantier en
950,40 $, un número que nadie retiene.

### Por qué por clave de búsqueda y no por identificador

El servidor le pide a Stripe el precio por su `lookup_key`, no por su
`price_1UGd4T…`.

Un identificador hay que guardarlo en una variable de entorno, es distinto en
la cuenta de pruebas y en la real, y el día que alguien cambie un precio en
Stripe —que obliga a **crear uno nuevo**, porque los precios no se editan— la
variable seguiría apuntando al viejo y se seguiría cobrando lo de antes sin que
nada fallara. La clave de búsqueda se mueve al precio nuevo y aquí no hay nada
que tocar.

Cada precio lleva además `metadata.plan`, que es de donde sale el plan al
guardar. Ver más abajo por qué eso y no otra cosa.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /suscripcion` | En qué anda, para la pantalla |
| `POST /suscripcion/checkout` | Abre la pasarela de Stripe |
| `POST /suscripcion/portal` | Abre el portal de Stripe |

Están **debajo** de `requireBusinessAuth` y su área es `ajustes`: un jefe de
obra no cancela la suscripción de la que cuelga toda la cuadrilla.

### El cliente de Stripe se guarda

`stripe_customer_id` en `businesses`, con índice único. Sin guardarlo, un
negocio que vuelve a pagar nace como cliente nuevo: dos clientes, dos
suscripciones, y el contratista pagando dos veces sin que nada falle por
ninguna parte.

### El plan sale del precio, nunca de lo que pidió el navegador

Quien elige en la pantalla manda un `plan`, y ese `plan` acaba en los metadatos
de la sesión. Pero eso es **lo que alguien pidió**; lo que de verdad se le está
cobrando es el precio que quedó en la suscripción.

Si un día no coinciden —un cambio de plan hecho desde el portal de Stripe, que
nunca pasa por nuestra pantalla— el que vale es el precio. Fiarse de lo otro
sería abrirle a alguien un plan que no paga.

### Los eventos, en `stripeWebhookSetup.ts`

```
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed
```

**Sin ellos nada de esto sirve para nada**: `subscription_plan` se quedaría en
el que tenía para siempre. Alguien pagaría Entreprise y seguiría sin ver las
nóminas, y alguien que cancela las seguiría viendo un año.

Van en el mismo endpoint que los de Connect, no en uno nuevo: una sola
verificación de firma y una sola dirección que dar de alta en Stripe. Se
distinguen porque los de Connect llegan etiquetados con la cuenta de origen.

**Añadir un evento a esa lista no basta** para un despliegue que ya tiene su
endpoint creado: Stripe guarda la lista en el suyo. Hay que volver a
provisionarlo o añadirlo a mano en el panel de Stripe.

### Un impago no cierra el sistema

`invoice.payment_failed` apunta `past_due` y **no toca el plan**.

Stripe reintenta durante días, y la mayoría de estos son una tarjeta caducada,
no alguien que se va. Cerrarle el sistema a un contratista el primer día de
impago, con sus facturas dentro, por una tarjeta que sólo hay que renovar, es
cómo se pierde a un cliente que no quería irse. Cuando Stripe se rinde de
verdad manda `customer.subscription.deleted`, y ahí sí.

Al cancelar **no se borra el cliente de Stripe**: si vuelve, tiene que
reengancharse a lo suyo y no nacer como cliente nuevo con una segunda
suscripción al lado.

---

## Qué pasa cuando se acaba

Tres estados, y los decide **una sola función** (`accesoDe`, en
`shared/planes.ts`) que usan el servidor y la pantalla. Si cada lado decidiera
por su cuenta acabarían discrepando, y discrepan de la peor manera: el panel
enseña las pantallas y cada cosa que se toca devuelve un error.

| Estado | Cuándo | Qué se puede hacer |
|---|---|---|
| `activo` | Pagando, en los 30 días de Stripe, o en `pilot` | Todo lo del plan |
| `prueba` | Sin contratar, con la prueba viva | Todo, y se avisa de los días que quedan |
| `bloqueado` | Prueba vencida y nada contratado | Sólo pagar, entrar, escribirnos y llevarse los datos |

La prueba empieza a contar **en el alta** (`trial_ends_at`), no el día que
alguien se acuerde. El valor por defecto de la columna es `pilot`, que no
caduca: un negocio que se da de alta solo entra con `prueba`, o tendríamos a
todo el mundo usándolo gratis para siempre sin que nada fallara.

### `pilot` no caduca

Es el plan de la casa — Néstor y quien venga detrás como cliente de
referencia. No hay suscripción que mirar porque no paga.

### Un impago no bloquea

`past_due` sigue siendo acceso. Stripe reintenta durante días y la mayoría son
una tarjeta caducada. Cuando Stripe se rinde de verdad, la suscripción pasa a
`canceled` y el bloqueo cae por su propio peso.

### Bloqueado no es secuestrado

Con el acceso bloqueado siguen abiertas cuatro familias de rutas, y ninguna es
caridad:

- **`suscripcion`** — por donde se sale del bloqueo. Sin ella sería una puerta
  cerrada sin cerradura.
- **`auth`** — poder entrar y salir. Bloquear el inicio de sesión dejaría a
  alguien sin poder ni llegar a la pantalla de pago.
- **`soporte`** — poder preguntar qué pasa.
- **`export`** y `GET /suscripcion/mis-datos` — **llevarse sus datos**. Sus
  facturas, sus horas y su informe de la CCQ son suyos, no nuestros, y la Ley
  25 dice lo mismo. Y en lo práctico: un contratista al que le encerramos sus
  facturas un día 30 no vuelve nunca y lo cuenta; uno que puede sacarlas y
  marcharse a veces se lo piensa y se queda.

`mis-datos` manda las tablas del negocio en un JSON, sin dar formato. No es un
informe bonito: es el dato. Lo que **no** va son las credenciales —los
enganches de QuickBooks y de Stripe— porque no son datos suyos, son llaves
nuestras.

### El trabajador y el cliente no se bloquean

El bloqueo está debajo de `requireBusinessAuth`, así que las rutas del
trabajador y del portal del cliente no pasan por él. Es a propósito: quien no
ha pagado es el jefe, y dejar sin fichar a una cuadrilla que no puede
arreglarlo castiga a quien no tiene la culpa — y borra las horas de ese día,
que son de ellos.

### Se avisa antes

La pantalla dice los días que quedan mientras la prueba está viva. Enterarse el
día 30 de que se para el sistema es enterarse el peor día posible.

## Quién factura, y por qué no se cobran impuestos

**Facturamos desde Italia a empresas de Quebec.** Eso decide dos cosas del
producto, y por eso está escrito aquí y no sólo en la cabeza de alguien.

**El precio es el precio.** Un servicio prestado a una empresa de fuera de la
UE queda fuera del ámbito del IVA italiano, y la empresa canadiense se
autoliquida lo suyo. Al contratista se le cobra exactamente lo que pone: 99 o
249. El sitio decía «impuestos aparte» y era falso — se corrigió en los cuatro
idiomas.

Los precios se crearon con `tax_behavior: "exclusive"`, que hoy no añade nada
porque no hay ningún impuesto configurado, y es lo correcto **si algún día** se
pasa a cobrarlos. `tax_behavior` no se puede cambiar en un precio existente, así
que dejarlo así ahorra rehacerlos.

`tax_id_collection` sigue encendido en la pasarela, y no es decorativo: que el
contratista ponga su número de TPS/TVQ en la factura es justo lo que documenta
por qué no se le cobró impuesto.

**Y hace falta poder facturar.** En Italia no se emiten facturas recurrentes sin
partita IVA. Esto no es una decisión de código y bloquea el primer cobro más que
cualquier otra cosa de esta página — Stripe se activa en un día, esto no.

Nada de esto es asesoramiento fiscal: es lo que se asumió al construirlo, para
que quien lo revise con un contable sepa qué mirar.

### Se cobra en CAD y se liquida en EUR

El precio está en dólares canadienses porque el mercado es Quebec y pedirle a
un contratista de allá que pague en euros es una fricción que no hace falta.
Stripe convierte al liquidar y cobra su comisión de cambio. Se asume a
propósito: vale más que la conversión.

## Comprobar

```bash
node --experimental-strip-types scripts/prueba-suscripcion/mapeo.mjs
```

Veintinueve comprobaciones: el mapeo de Stripe sobre **respuestas reales de la
API** copiadas tal cual, y quién se queda fuera con cada combinación de estado
y fecha.
Eso no es un detalle: el fallo que esta prueba encontró la primera vez fue
justo el de inventarse el objeto. `current_period_end` ya no está en la
suscripción sino dentro del artículo, y leyéndolo del sitio de siempre la fecha
de renovación se guardaba vacía — con un objeto escrito a mano habría pasado la
prueba sin enterarse.

---

## Lo que falta antes de cobrar de verdad

**Está montado contra el *sandbox*.** Para cobrar hacen falta tres cosas que no
son código:

1. **Activar la cuenta de Stripe** con los datos de quien factura.
2. **Poder facturar.** Ver abajo — es lo que más tarda y no es código.
3. **Crear los cuatro precios en la cuenta real.** No a mano:

   ```bash
   STRIPE_SECRET_KEY=sk_live_… node --experimental-strip-types scripts/stripe-precios.mjs
   ```

   Se puede correr las veces que haga falta. Si el precio ya está y cuesta lo
   mismo, no toca nada; si cuesta otra cosa, crea el nuevo y le traslada la
   clave de búsqueda, dejando el viejo vivo para quien ya lo pagaba —los
   precios de Stripe no se editan, cambiar 99 por 109 es crear otro—. Con
   `--dry` dice lo que haría sin escribir nada.

   Hacerlo a mano en el panel sale mal una de cada tres veces, y la forma de
   salir mal no da ningún error: un precio sin su `lookup_key` deja la pasarela
   contestando que no encuentra el precio, y un `metadata.plan` mal escrito
   deja cobrando de verdad sin abrirle el plan a quien pagó.

4. **Volver a provisionar el webhook** (`POST /api/stripe/webhook/provision`).
   Stripe guarda la lista de eventos en su endpoint: uno creado antes de esto
   sigue mandando sólo los dos de Connect, y el plan del negocio no cambiaría
   nunca al pagar.

Lo del día 31 ya está resuelto, arriba: se bloquea el panel y quedan abiertas
la suscripción, el acceso, el soporte y la descarga de los datos.
