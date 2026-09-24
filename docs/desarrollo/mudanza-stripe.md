# Mudar el producto a otra cuenta de Stripe

Qué hay montado en la cuenta de cobros, qué lo recrea solo y qué hay que
hacer a mano. Escrito el 24 de septiembre de 2026, cuando la cuenta canadiense
resultó inservible —Stripe exige que el representante resida en el país de la
cuenta y que el banco de pagos sea de allí— y hubo que plantearse abrirla en
Italia, que es donde el negocio está de verdad.

**El país de una cuenta de Stripe no se cambia nunca.** Mudarse es abrir otra y
rehacer lo de abajo. Por eso esto existe: para que rehacerlo sea media hora y
no una tarde de descubrir por partes lo que faltaba.

## Lo que se recrea solo

```bash
STRIPE_SECRET_KEY=sk_live_… node --experimental-strip-types scripts/stripe-precios.mjs --dry   # mirar
STRIPE_SECRET_KEY=sk_live_… node --experimental-strip-types scripts/stripe-precios.mjs         # hacer
```

Deja los **2 productos**, los **4 precios** y el **portal del cliente**. Se
puede correr las veces que haga falta: si algo ya está y coincide, no lo toca.

Los precios salen de `shared/planes.ts`, que es la única fuente. No se copian
de la cuenta vieja a mano, porque un `lookup_key` mal escrito no da error —
deja la pasarela contestando que no hay precio activo, y eso se descubre
cuando alguien intenta pagar.

| Plan | Mes | Año | Claves |
|---|---|---|---|
| Chantier | 99 CAD | 990 CAD | `chantier_mes`, `chantier_ano` |
| Entreprise | 249 CAD | 2490 CAD | `entreprise_mes`, `entreprise_ano` |

Todos en **CAD** y con `tax_behavior: exclusive`. El portal deja cancelar al
final del periodo, cambiar de plan con prorrateo, actualizar la tarjeta y ver
las facturas.

## Lo que recrea el propio servidor

Con la clave nueva ya puesta en el entorno:

```
POST /api/stripe/webhook/provision
```

Registra el webhook contra `…/api/public/stripe/webhook` y guarda su secreto.
Los eventos que el producto sabe atender los vigila
`scripts/check-webhook-events.py`; registrar de más es ruido y registrar de
menos deja facturas sin marcar pagadas.

## Lo que hay que hacer a mano, en el panel de Stripe

Nada de esto tiene API que sirva, o depende de una revisión de Stripe:

1. **Activar la cuenta.** Datos del negocio, identidad del representante y
   banco. Aquí es donde se atascó la canadiense: el representante tiene que
   residir en el país de la cuenta, y el banco ser de ese país.
2. **Darse de alta en Connect.** Sin esto no se pueden crear cuentas
   conectadas, y el error que sale —`account_create_activation_required`— no
   dice que falte esto.
3. **La voz del extracto**: `LOGICIEL CONSTRUCTION` (21 caracteres, cabe en
   los 22 que permiten las redes) y la abreviada `LOGICIEL`.
4. **Los datos de asistencia**: correo de soporte —el mismo que
   `SUPPORT_EMAIL`, no otro—, y las tres direcciones:
   - Asistencia: `https://logiciel-construction.com/fr/support`
   - Privacidad: `https://logiciel-construction.com/fr/confidentialite`
   - Condiciones: `https://logiciel-construction.com/fr/conditions`

   **Con `/fr/`.** Sin el idioma delante esas rutas caen en el armazón de la
   aplicación y sirven el index, así que enseñan una pantalla vacía donde
   debería estar la política. El portal las tenía mal hasta hoy.
5. **Los métodos de pago.** Como mínimo tarjeta. En Canadá conviene mirar
   Interac, que es con lo que paga la mayoría y cuesta mucho menos.

## Después

```
STRIPE_SECRET_KEY=…        # la nueva
STRIPE_WEBHOOK_SECRET=…    # lo devuelve el provision
```

En Easypanel, y reiniciar. Y quitar `STRIPE_CONNECT_PAUSED` si estaba puesto,
que es lo que mantiene apagado el botón de conectar mientras dura la mudanza.

Luego, **un pago de verdad**. No se da por buena una cuenta de cobros hasta
que un cargo real ha entrado, el webhook ha llegado, el estado se ha escrito y
el dinero ha salido al banco. Las cuatro cosas, en ese orden.

## Lo que no se muda

Los clientes, las suscripciones y las cuentas conectadas **no se pueden mover**
entre cuentas de Stripe. Quien estuviera pagando tendría que volver a
suscribirse, y cada contratista conectado tendría que repetir su alta entera,
datos bancarios incluidos.

Por eso una mudanza se hace cuando la cuenta está vacía y no después. El 24 de
septiembre de 2026 lo estaba: cero cobros, cero suscripciones y cero cuentas
conectadas.
