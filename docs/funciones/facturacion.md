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

## Un orden de cobro que funciona

1. **Depósito** al aceptar el presupuesto — el porcentaje que tengas en
   Configuración, 30% por defecto. Aparece impreso en el propio presupuesto,
   así que el cliente ya lo sabía al firmar.
2. **Pagos parciales** por hitos, con retención.
3. **Pago final** al terminar. Sin retención: aquí se libera.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/invoices` | La lista |
| `POST /api/invoices` | Crear (calcula impuesto y retención) |
| `POST /api/invoices/:id/checkout-link` | Enlace de pago |
| `GET /api/invoices/:id/pdf` | El PDF |
| `POST /api/client/invoices/:id/checkout` | Pago desde el portal |
| `POST /api/public/stripe/webhook` | Confirmación de Stripe |

En `invoices`: `subtotal`, `tax_amount`, `tax_breakdown` (jsonb con el
desglose por impuesto), `holdback_amount`, y `amount` — que es **lo que
realmente se cobra**, ya neto de retención. Si añades otro camino para emitir
facturas, respeta esa relación o el cobro dejará de cuadrar con el documento.
