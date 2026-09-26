# Mudar el producto a otra cuenta de Stripe

Qué hay montado en la cuenta de cobros, qué lo recrea solo y qué hay que
hacer a mano. Escrito el 24 de septiembre de 2026, cuando la cuenta canadiense
resultó inservible —Stripe exige que el representante resida en el país de la
cuenta y que el banco de pagos sea de allí—, y completado el 26 con la foto
exacta de la cuenta vieja, el día que se abrió la nueva en **España**, que es
donde están los documentos del titular.

**El país de una cuenta de Stripe no se cambia nunca.** Mudarse es abrir otra y
rehacer lo de abajo. Por eso esto existe: para que rehacerlo sea media hora y
no una tarde de descubrir por partes lo que faltaba.

## Qué cambia con una cuenta española y qué no

- **Los contratistas no notan nada.** Cada uno tiene su propia cuenta de Stripe
  canadiense, con su panel y su banco (`createConnectedAccount` en
  `server/api.ts`: `country: "ca"`, `dashboard: "full"`, comisiones y pérdidas
  a cargo de Stripe). El dinero de sus clientes les llega directo, en CAD. Que
  la plataforma esté en España no lo toca.
- **La suscripción se sigue cobrando en CAD**, con los mismos precios. Stripe
  la liquida en euros a la cuenta española y cobra la conversión.
- **Interac** es cosa de las cuentas canadienses de los contratistas, no de la
  nuestra: una cuenta española no puede ofrecerlo.

## La cuenta vieja, tal como estaba

`acct_1U3L60Coxo1rqCJc`, Canadá, nombre «SaaS Gestión Comstruccion y Reformas»
(sic). Nunca llegó a activarse (`account_create_activation_required`).

| Qué | Cuántos | Detalle |
|---|---|---|
| Cobros | 0 | Nunca entró dinero |
| Suscripciones | 0 | |
| Cuentas conectadas | 0 | Ningún contratista llegó a conectar |
| Clientes | 1 | `cus_VHG2iFjKFMpFEz`, TA MAISON EST MA MAISON inc — ver abajo |
| Cupones | 0 | |
| Productos | 2 | Chantier (`prod_VHBRwSKJiaOaHb`) y Entreprise (`prod_VHBR3wwC2kSyk2`), con `metadata.plan` |
| Precios | 4 | Los de la tabla de abajo, `tax_behavior: exclusive` |
| Portal del cliente | 1 | `bpc_1UILGwCoxo1rqCJceR0iClsQ` |
| Webhooks | 3 | Dos vivos a `/api/public/stripe/webhook` y uno apagado al despliegue viejo de easypanel.host |
| Métodos de pago | | Tarjeta, Apple Pay, Google Pay y Link |

Los dos webhooks vivos eran uno por origen: uno para **nuestra** suscripción
(creado a mano: `checkout.session.completed`, `invoice.payment_succeeded`,
`invoice.payment_failed`, `customer.subscription.updated`,
`customer.subscription.deleted`) y otro para las cuentas conectadas
(`checkout.session.completed`, `account.updated`). El alta automática sólo
creaba el segundo; desde el 26 crea los dos.

## Lo que se recrea solo

### Productos, precios y portal

```bash
STRIPE_SECRET_KEY=sk_live_… node --experimental-strip-types scripts/stripe-precios.mjs --dry   # mirar
STRIPE_SECRET_KEY=sk_live_… node --experimental-strip-types scripts/stripe-precios.mjs         # hacer
```

Deja los **2 productos**, los **4 precios** y el **portal del cliente**, igual
que en la cuenta vieja. Se puede correr las veces que haga falta: si algo ya
está y coincide, no lo toca.

Los precios salen de `shared/planes.ts`, que es la única fuente. No se copian
de la cuenta vieja a mano, porque un `lookup_key` mal escrito no da error —
deja la pasarela contestando que no hay precio activo, y eso se descubre
cuando alguien intenta pagar.

| Plan | Mes | Año | Claves |
|---|---|---|---|
| Chantier | 99 CAD | 990 CAD | `chantier_mes`, `chantier_ano` |
| Entreprise | 249 CAD | 2490 CAD | `entreprise_mes`, `entreprise_ano` |

El portal deja cancelar al final del periodo (con motivo), cambiar de plan con
prorrateo, actualizar la tarjeta, los datos de facturación y el número de
impuestos, y ver las facturas. Vuelve a `/suscripcion`.

### Los webhooks

Con la clave nueva ya puesta en el entorno:

```
POST /api/stripe/webhook/provision
```

Crea **dos** destinos contra `…/api/public/stripe/webhook` —`@self` para la
suscripción del negocio, `@accounts` para los cobros de los contratistas— y
guarda sus dos secretos en `platform_config`. Los eventos los vigila
`scripts/check-webhook-events.py`.

Los secretos del entorno y los guardados **se suman**: un
`STRIPE_WEBHOOK_SECRET` viejo en Easypanel no impide que los nuevos
verifiquen. Pero sobran, y conviene quitarlos (abajo).

### El cliente de la suscripción

Cada negocio guarda su `stripe_customer_id`, y en la cuenta nueva ese cliente
no existe. Desde el 26 el servidor lo comprueba antes de usarlo y, si Stripe
contesta «No such customer», crea otro (`clienteSigueEnStripe`). Las cuentas
conectadas hacen lo mismo desde antes. No hace falta tocar la base de datos.

## Lo que hay que hacer a mano, en el panel de Stripe

Nada de esto tiene API que sirva, o depende de una revisión de Stripe:

1. **Activar la cuenta.** Datos del negocio, identidad del representante y
   banco del país de la cuenta.
2. **Darse de alta en Connect** y terminar su paso de la guía de
   configuración, **«Scegli il modello di business»**: Piattaforma, no
   Marketplace. Sin ese paso Stripe contesta
   `account_create_activation_required` —«Your account must be activated»—
   aunque la cuenta ya cobre, y el enlace que da dice que todo está activado.
   En la cuenta española costó una tarde: desde el móvil el enlace de la guía
   lleva a la página de productos, y sólo se pudo completar desde el
   ordenador.
3. **La voz del extracto**: `LOGICIEL CONSTRUCTION` (21 caracteres, cabe en
   los 22 que permiten las redes) y la abreviada `LOGICIEL`.
4. **Los datos de asistencia**: correo de soporte —el mismo que
   `SUPPORT_EMAIL`, no otro—, y las tres direcciones:
   - Asistencia: `https://logiciel-construction.com/fr/support`
   - Privacidad: `https://logiciel-construction.com/fr/confidentialite`
   - Condiciones: `https://logiciel-construction.com/fr/conditions`

   **Con `/fr/`.** Sin el idioma delante, hasta el 25 caían en el armazón de
   la aplicación y enseñaban una pantalla vacía. Ahora redirigen, pero la
   dirección buena es la que lleva el idioma.
5. **Los métodos de pago**: tarjeta, Apple Pay, Google Pay y Link, como la
   vieja. La suscripción pide sólo tarjeta de todos modos.
6. **No activar «Managed Payments»** («Lascia fare a noi»). Cobra un 3,5 % más
   por transacción y convierte a Stripe en el vendedor de la suscripción, que
   no es como está hecho esto.

## Después

En Easypanel, y reiniciar:

```
STRIPE_SECRET_KEY=…        # la nueva, sk_live_…
```

y **quitar** `STRIPE_CONNECT_PAUSED` si estaba puesto —es lo que mantiene
apagado el botón de conectar mientras dura la mudanza— y `STRIPE_WEBHOOK_SECRET`,
que era de la cuenta vieja: los nuevos los guarda el provision.

Luego, en la base de datos, fuera los secretos viejos antes de provisionar:

```sql
delete from platform_config where key = 'stripe_webhook_secrets';
```

Y entonces el provision, y el script de precios.

Por último, **un pago de verdad**. No se da por buena una cuenta de cobros
hasta que un cargo real ha entrado, el webhook ha llegado, el estado se ha
escrito y el dinero ha salido al banco. Las cuatro cosas, en ese orden.

## La cuenta nueva, tal como quedó el 26

`acct_1UJxtKQ1ch2EiV8e`, España, moneda de liquidación EUR. Montado por el
conector de Stripe y no por el script, porque la clave no pasa por aquí:

| Qué | Id |
|---|---|
| Chantier | `prod_VKddb6ckFwLbyU` — `chantier_mes` `price_1UJyMmQ1ch2EiV8emhnIFK7K`, `chantier_ano` `price_1UJyMqQ1ch2EiV8ebVxZ41eF` |
| Entreprise | `prod_VKddzIap85EXrY` — `entreprise_mes` `price_1UJyMxQ1ch2EiV8eAxtiS2XR`, `entreprise_ano` `price_1UJyN4Q1ch2EiV8elmxGa9We` |
| Portal | `bpc_1UJyNIQ1ch2EiV8eor01Uh9S`, con las direcciones legales en `/fr/` |
| Webhook de la suscripción | `we_1UJyNTQ1ch2EiV8ebBey9beH` |
| Webhook de Connect | `we_1UJyNdQ1ch2EiV8eSSLrZcHR` |

Los dos secretos están en `platform_config` y sustituyen a los tres de la
cuenta vieja. El `stripe_customer_id` del negocio de Néstor
(`cus_VHG2iFjKFMpFEz`, de la cuenta vieja) se vació a mano el mismo día,
porque la clave se cambió antes de desplegar `clienteSigueEnStripe`.

## La cuenta vieja

Cuando la nueva cobre: apagar sus dos webhooks vivos, para que no quede nada
apuntando a producción desde una cuenta que ya no es la nuestra, y cerrarla
desde su panel. No tiene dinero, ni clientes que paguen, ni contratistas.

## Lo que no se muda

Los clientes, las suscripciones y las cuentas conectadas **no se pueden mover**
entre cuentas de Stripe. Quien estuviera pagando tendría que volver a
suscribirse, y cada contratista conectado tendría que repetir su alta entera,
datos bancarios incluidos.

Por eso una mudanza se hace cuando la cuenta está vacía y no después. El 26 de
septiembre de 2026 lo estaba: cero cobros, cero suscripciones y cero cuentas
conectadas.
