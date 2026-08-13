# Pagos con Stripe

**Dónde:** menú → Configuración → Pagos
**Código:** `client/src/pages/SettingsPayments.tsx`, `server/stripe.ts`

---

## Cómo funciona el dinero

Cada negocio conecta **su propia cuenta de Stripe**. Los cobros se hacen
directamente contra esa cuenta (*direct charges*), así que **el dinero, las
comisiones, las disputas y los depósitos bancarios son tuyos**, no de esta
plataforma. Esta no es intermediaria de tus cobros: solo los origina en tu
nombre.

### Quién paga las comisiones de Stripe

La cuenta conectada, siempre. La plataforma no cobra ninguna comisión propia
(`application_fee`) y no aparece en la factura de Stripe de nadie.

Esto **no es lo que hace Stripe por defecto** y por eso está escrito así en el
código. Crear una cuenta con `type: "express"` equivale a
`controller.fees.payer = "application"`, que pone la comisión de proceso de
cada cobro a cargo de la plataforma. Las cuentas se crean con las propiedades
`controller` explícitas:

```
controller.fees.payer            = "account"   // la cuenta conectada paga
controller.losses.payments       = "stripe"
controller.requirement_collection = "stripe"
controller.stripe_dashboard.type = "express"   // o "full" si Stripe rechaza esa combinación
```

Ver `createConnectedAccount()` en `server/api.ts`. **No hay respaldo hacia la
opción por defecto**: si Stripe rechaza todas las combinaciones seguras, la
conexión falla con un error. Fallar al conectar se arregla; pagar las
comisiones de otros en silencio, no.

Quién paga se fija al crear la cuenta y **no se puede cambiar después**. Por eso
se guarda en `stripe_connected_accounts.fees_payer` y la pantalla de Pagos lo
dice: una cuenta creada de la forma antigua hay que reemplazarla, no editarla.

---

## Conectar tu cuenta

1. Configuración → **Pagos**.
2. **Conectar con Stripe**. Te lleva al alta de Stripe.
3. Rellena lo que te pide Stripe: datos del negocio, número de empresa,
   cuenta bancaria y verificación de identidad. Esto es de Stripe, no del
   sistema — nadie más ve esos datos.
4. Al terminar, vuelves solo y el estado pasa a **Activa**.

Si te quedas a medias, el estado queda en **Pendiente** y puedes retomarlo con
el mismo botón. Stripe guarda lo que ya rellenaste.

### Los estados

| Estado | Qué significa |
|---|---|
| **Activa** | Puedes cobrar y recibir depósitos |
| **Pendiente** | Falta terminar el alta |
| **Restringida** | Stripe pide documentación adicional. Entra a tu panel de Stripe |

---

## Cobrar

Una vez activa, hay dos caminos y ambos llevan al mismo pago:

- **Tú mandas el enlace.** Facturación → **Copiar enlace de pago** → se lo
  pegas al cliente.
- **El cliente paga solo** desde su portal, sin que le mandes nada.

Cuando el pago se confirma, la factura pasa sola a `pagado`.

---

## El webhook

Es la pieza que le dice a la aplicación que un pago se completó. Sin él, el
cliente paga pero la factura sigue apareciendo pendiente.

**Configurarlo en Stripe** (Developers → Webhooks):

- Endpoint: `https://tu-dominio/api/public/stripe/webhook`
- Evento: `checkout.session.completed`
- Copia el *signing secret* (`whsec_…`) y ponlo como `STRIPE_WEBHOOK_SECRET`
  en tu hosting.

> **La ruta completa, no el dominio.** Esto ya pasó: el endpoint estaba puesto
> como `https://tu-dominio/` a secas. Esa URL devuelve la página web, así que
> Stripe recibía un 200 y se quedaba tan tranquilo mientras **ningún pago se
> marcaba como pagado**. Un webhook mal apuntado no da error en ningún sitio;
> sólo deja de funcionar en silencio.

> **Un solo evento a propósito.** El código maneja `checkout.session.completed`
> y nada más. Suscribirse a los 200 y pico eventos que ofrece Stripe no aporta:
> el resto entra, no hace nada y sale con un 200.

**Comprobar que está bien:**

```bash
curl -s https://tu-dominio/api/health | python3 -m json.tool
```

`stripeWebhookSecretConfigured` tiene que ser `true`.

Eso confirma que hay un secreto, no que sea **el** secreto. Para saber si el
que tiene tu hosting es el mismo que el del endpoint, manda un evento firmado
de un tipo que el manejador ignora — verifica la firma y responde 200 sin tocar
ninguna factura:

```bash
PAYLOAD='{"id":"evt_probe","object":"event","type":"ping","data":{"object":{}}}'
T=$(date +%s)
SIG=$(printf '%s' "$T.$PAYLOAD" | openssl dgst -sha256 -hmac "$STRIPE_WEBHOOK_SECRET" -r | cut -d' ' -f1)
curl -s -X POST https://tu-dominio/api/public/stripe/webhook \
  -H "Stripe-Signature: t=$T,v1=$SIG" -H "Content-Type: application/json" \
  --data-binary "$PAYLOAD"
```

`{"received":true}` significa que la cadena entera funciona. Un 400 con
"No signatures found matching" significa que el secreto no coincide.

> **Detalle técnico que importa:** Stripe firma el cuerpo **crudo** de la
> petición. Por eso esta ruta se monta con `express.raw()` **antes** del
> parser de JSON, en `apiApp`. Si alguna vez se moviera detrás del parser, la
> verificación de firma fallaría siempre y ningún pago se registraría. No la
> muevas.

---

## Modo prueba y modo real

Stripe tiene dos juegos de claves:

| | Secreta | Pública |
|---|---|---|
| Prueba | `sk_test_…` | `pk_test_…` |
| Real | `sk_live_…` | `pk_live_…` |

Prueba y producción no se mezclan: una cuenta conectada en modo prueba no
existe en modo real, y hay que rehacer el alta al cambiar.

Con claves de prueba, la tarjeta `4242 4242 4242 4242` (cualquier fecha futura
y cualquier CVC) simula un pago correcto.

**Antes de cobrarle a un cliente real**, haz una factura pequeña de prueba y
comprueba que llega a `pagado` sola. Es la única forma de saber que el webhook
está bien puesto.

---

## Si algo no va

**"Stripe no está configurado"**
Falta `STRIPE_SECRET_KEY` en el entorno. Ver
[../desarrollo/despliegue.md](../desarrollo/despliegue.md).

**El cliente pagó pero la factura sigue pendiente**
El webhook. Revisa la URL del endpoint, el secreto de firma, y el registro de
intentos en el panel de Stripe — ahí se ve el código de respuesta que devolvió
tu servidor.

**"Tu cuenta está restringida"**
Stripe necesita documentación tuya. Se resuelve en tu panel de Stripe; desde
aquí no se puede hacer nada.

**El enlace de pago no se genera**
La cuenta conectada no está activa todavía. Termina el alta.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/stripe/connect/status` | Estado de la cuenta conectada |
| `POST /api/stripe/connect/onboarding-link` | Enlace de alta |
| `POST /api/stripe/connect/refresh` | Refresca el estado desde Stripe |
| `POST /api/invoices/:id/checkout-link` | Enlace de pago (panel) |
| `POST /api/client/invoices/:id/checkout` | Enlace de pago (portal) |
| `POST /api/public/stripe/webhook` | Confirmación de Stripe |

Todas las llamadas a la API de Stripe en nombre de un negocio pasan la opción
`stripeAccount` con su cuenta conectada. Es lo que hace que el cargo sea suyo
y no de la plataforma. Si escribes una llamada nueva a Stripe y se te olvida
esa opción, el cobro caería en la cuenta equivocada.
