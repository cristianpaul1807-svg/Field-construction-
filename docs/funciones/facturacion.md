# Facturación

**Dónde:** menú → Finanzas → Facturación
**Código:** `client/src/pages/Invoicing.tsx` · Rutas: `/api/invoices`

---

## Para qué sirve

Emitir facturas, mandar el enlace de pago y ver quién debe. El impuesto se
calcula solo según tu provincia, y la retención se aplica sola si la tienes
configurada.

Arriba, tres cifras: **cobrado**, **pendiente y vencido**, y **número de
facturas**.

---

## Crear una factura

1. **Nueva factura**.
2. **Cliente**.
3. **Tipo**:
   - **Depósito** — para arrancar la obra.
   - **Pago parcial** — un avance a mitad.
   - **Pago final** — el cierre.
4. **Monto antes de impuestos**. Escribe el subtotal; el impuesto lo pone el
   sistema.
5. **Descripción**, opcional pero recomendable: es lo que se imprime como
   concepto en el PDF.
6. Antes de guardar ves el desglose: subtotal, impuesto y total.
7. **Crear factura**.

---

## Impuestos y retención, en una línea

- El **impuesto** sale de la provincia que tengas en Configuración → Datos de
  la empresa. En Quebec, TPS 5% + TVQ 9,975%. Detalle completo en
  [impuestos-canada.md](impuestos-canada.md).
- La **retención** se descuenta de los depósitos y pagos parciales, no del
  pago final — porque el final es justo donde se libera lo retenido.

El importe que se cobra es:

```
subtotal + impuesto − retención
```

El impuesto se calcula sobre el **valor completo del trabajo**; solo el pago
se reduce por la retención. Si la factura lleva retención, la fila de la lista
lo indica debajo del importe.

---

## Cobrar

1. **Copiar enlace de pago** en la fila de la factura.
2. Pégaselo al cliente por donde ya habláis.
3. Paga con tarjeta. Al confirmarse, la factura pasa sola a `pagado`.

El cliente también puede pagar desde su portal sin que le mandes nada:
[clientes.md](clientes.md#portal-del-cliente).

Requiere tener Stripe conectado: [pagos-stripe.md](pagos-stripe.md).

---

## Descargar el PDF

**Descargar factura** en cualquier fila. Sale en el idioma del panel, con tu
cabecera, tus números de TPS/TVQ y el desglose completo. Ver
[documentos-pdf.md](documentos-pdf.md).

---

## Estados

| Estado | Qué significa |
|---|---|
| `pendiente` | Emitida, sin cobrar |
| `pagado` | Cobrada — lo marca Stripe, no tú |
| `vencido` | Pasó la fecha de vencimiento |
| `cancelado` | Anulada |

El paso a `pagado` lo hace el **webhook de Stripe**. Si un pago se completó y
la factura sigue pendiente, el problema es el webhook, no el cobro: ver
[pagos-stripe.md](pagos-stripe.md#el-webhook).

---

## El plan de pagos

**Dónde:** Configuración → Pagos → *Cómo cobras una obra*
**Código:** `server/paymentPlans.ts`, `client/src/components/PaymentPlanEditor.tsx`

Nadie cobra una obra de una sola vez. El plan son etapas, cada una con un
nombre, un porcentaje y **cuándo se factura sola**. Por defecto, sin configurar
nada:

| Etapa | % | Se factura |
|---|---|---|
| Depósito inicial | 50 | Al aceptar el presupuesto |
| Avance de obra | 25 | Al empezar la obra (primer fichaje) |
| Entrega final | 25 | Al confirmar el trabajo |

Puedes cambiarlo: añadir etapas, quitarlas, mover los porcentajes. **Tienen que
sumar 100%** — el botón de guardar no se activa hasta que suman, porque una
etapa mal calculada no se ve hasta que llega a un cliente.

Los momentos que puedes elegir son los estados del
[orden de ejecución](proyectos.md#el-orden-de-ejecución), más *Cuando yo lo
diga* para las etapas que son una decisión tuya.

### Cuándo se copia y cuándo no

El plan de Configuración es **una plantilla**. Cada obra se lleva su propia
copia al aceptar el presupuesto. Si mañana cambias la plantilla, las obras en
marcha no se tocan: lo que acordaste en marzo no puede cambiar porque editaste
un ajuste en junio.

### Sobre qué se calcula

Sobre el total del presupuesto aceptado **más las órdenes de cambio
aprobadas**. Si el cliente aprueba $4.000 de trabajo extra, la etapa del 50%
pasa de $5.000 a $7.000 — el extra no se queda sin facturar esperando a que
alguien se dé cuenta.

### Facturar antes de tiempo

En el hub del proyecto, cada etapa sin facturar tiene **Facturar ahora**. Para
el cliente que quiere pagar ya, o el depósito que cobraste de palabra.

Una etapa nunca se factura dos veces: en cuanto tiene factura, deja de estar
disponible.

### Qué ve el cliente

El mismo plan en su portal, sin el botón. Solo las etapas ya facturadas
muestran importe: poner una cifra delante del cliente antes de emitirla sería
prometer un número que nadie ha acordado.

---

## La retención en el plan

La última etapa se emite como **pago final**, que es la que no lleva retención
— es donde se libera la retenida en las anteriores. Por eso el orden de las
etapas importa: la última es la que cierra.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/invoices` | La lista |
| `POST /api/invoices` | Crear (calcula impuesto y retención) |
| `POST /api/invoices/:id/checkout-link` | Enlace de pago |
| `GET /api/invoices/:id/pdf` | El PDF |
| `POST /api/client/invoices/:id/checkout` | Pago desde el portal |
| `GET/PUT /api/payment-plan` | La plantilla del negocio |
| `GET /api/projects/:id/payment-milestones` | El plan de una obra |
| `POST /api/projects/:id/payment-milestones/:mid/bill` | Facturar una etapa a mano |
| `POST /api/public/stripe/webhook` | Confirmación de Stripe |

En `invoices`: `subtotal`, `tax_amount`, `tax_breakdown` (jsonb con el
desglose por impuesto), `holdback_amount`, y `amount` — que es **lo que
realmente se cobra**, ya neto de retención. Si añades otro camino para emitir
facturas, respeta esa relación o el cobro dejará de cuadrar con el documento.
