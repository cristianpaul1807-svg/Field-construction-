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

## Comprobar

```bash
node scripts/prueba-suscripcion/mapeo.mjs
```

Trece comprobaciones sobre **respuestas reales de la API**, copiadas tal cual.
Eso no es un detalle: el fallo que esta prueba encontró la primera vez fue
justo el de inventarse el objeto. `current_period_end` ya no está en la
suscripción sino dentro del artículo, y leyéndolo del sitio de siempre la fecha
de renovación se guardaba vacía — con un objeto escrito a mano habría pasado la
prueba sin enterarse.

---

## Lo que falta antes de cobrar de verdad

**Está montado contra el *sandbox*.** Para cobrar hacen falta tres cosas que no
son código:

1. **Activar la cuenta de Stripe**: datos de la empresa, número de empresa,
   cuenta bancaria canadiense e identificación.
2. **Registrarse para la TPS y la TVQ.** Vendiendo desde Quebec a empresas de
   Quebec, nuestra propia suscripción lleva impuestos — el sitio ya dice
   «impuestos aparte» y los precios están creados con `tax_behavior: exclusive`.
   Sin registro, o se cobra sin impuestos y se deben igual, o hay que corregir
   facturas después.
3. **Volver a crear los cuatro precios en la cuenta real**, con las mismas
   claves de búsqueda y los mismos `metadata.plan`. Si las claves coinciden, en
   el código no hay nada que cambiar.

Y una decisión que no es técnica: **qué pasa el día 31 si no ha pagado**. Hoy
un negocio sin suscripción se queda en el plan que tuviera. La recomendación es
dejar leer y descargar todo pero no crear nada nuevo — cerrarle la puerta a
alguien con sus facturas dentro es cómo se gana una mala reseña que no se
borra.
