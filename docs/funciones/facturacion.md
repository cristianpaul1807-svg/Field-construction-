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

El número se pone solo. No hay que escribirlo ni se puede cambiar.

---

## El número de factura

Formato **`2026-0001`**: año completo y correlativo de cuatro cifras, por
negocio, reiniciando cada 1 de enero.

Una factura de Quebec tiene que llevar número, y la serie tiene que ser
correlativa y sin huecos — es de lo primero que mira Revenu Québec. Antes no
había ninguno: el PDF imprimía `INV-1BE0A42A`, los primeros dígitos del
identificador interno. Único sí, correlativo no.

- Se emite **al crear la factura**, desde un disparador de la base, y ya no se
  mueve. Sale en la lista, en el PDF y en el portal del cliente, y es el número
  que el cliente pone en la transferencia.
- **No hay huecos** porque una factura no se borra nunca: anular pone el estado
  en *cancelado* y la fila se queda donde está, con su número. Una factura que
  desaparece de la serie es exactamente lo que un inspector va a preguntar.
- Cada negocio tiene su propia serie.

### Y el del presupuesto

Formato **`EST-2026-0001`**, con la misma mecánica: contador por negocio y
año, puesto por un disparador al crear la fila, y ya inamovible.

Un presupuesto no es un documento fiscal y nadie obliga a numerarlo. Se hace
igualmente porque la factura que sale de él sí lo lleva, y tener los dos
documentos del mismo trato numerados con criterios distintos —uno correlativo,
el otro derivado del identificador— convierte en trabajo manual algo tan
corriente como *"mándame otra vez el presupuesto que te acepté"*.

El prefijo `EST-` no es adorno: sin él, el presupuesto y la factura del mismo
año se llamarían los dos `2026-0004`.

**El archivo se llama como el número.** El PDF de la `2026-0004` se guardaba
como `INV-1BE0A42A.pdf`, y en la carpeta del contable no había forma de
emparejarlos sin abrirlos uno por uno. Ahora el nombre lo dicta el servidor
—que es quien conoce el número— y el navegador lo respeta.

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

## Cobrado fuera del software

**Marcar cobrada** en la fila de la factura. Se elige el medio, el día y, si
hace falta, una referencia (número de cheque o de transferencia).

La tarjeta **no se puede elegir a mano**. Ese medio lo escribe el webhook y
significa que hay un cargo de verdad detrás; dejarlo elegible desde el panel
sería poder inventarse un cobro con tarjeta, y el informe del contable dejaría
de valer para lo único que sirve.

Pasa exactamente lo mismo que con la tarjeta, porque es el mismo código:
`registrarCobro()` en `server/api.ts` lo usan el webhook y esta ruta. La
factura se cierra, el cobro se escribe en `payments` con su `method`, la
petición del chat deja de decir «pendiente», y si era la factura final, la obra
pasa a completada.

**Por qué existe.** Hasta que se añadió, la única forma de que una factura
llegara a `pagado` era que el cliente metiera la tarjeta en su portal. En
construcción en Quebec la mayor parte se cobra por transferencia Interac o con
un cheque en la obra: esas facturas se quedaban pendientes para siempre, los
totales de la pantalla mentían, y ninguna obra llegaba a completarse, porque
ese paso cuelga del cobro de la factura final.

| Ruta | Qué hace |
|---|---|
| `POST /api/invoices/:id/register-payment` | `{ method, paidAt?, reference? }` |

Rechaza una factura ya pagada (`invoice_already_paid`) y una anulada
(`cancelled_invoice_not_payable`). Cobrar dos veces no cierra la obra dos
veces: `registrarCobro()` devuelve `false` si ya estaba cobrada, que es lo
que también protege de los reintentos del webhook.

---

## Descargar el PDF

**Descargar factura** en cualquier fila. Sale en el idioma del panel, con tu
cabecera, tus números de TPS/TVQ y el desglose completo. Ver
[documentos-pdf.md](documentos-pdf.md).

---

## Corregir una factura emitida

**Nota de crédito** en la fila de la factura. Se escribe el motivo y, si sólo
se corrige una parte, el importe; en blanco se anula entera.

Una factura emitida **no se borra ni se edita**. Se corrige con una nota de
crédito y las dos se quedan en los libros — eso no es una preferencia nuestra,
es cómo tiene que poder reconstruirse un ejercicio meses después. El botón sale
también sobre una factura **pagada**, que es justo el caso en el que anularla
ya no es una opción.

| Qué | Cómo |
|---|---|
| Número | `NC-2026-0001`, contador propio por año |
| Impuestos | En la misma proporción y **a las tasas de la factura original**, no a las de hoy |
| Entera | Deja la factura en `cancelado` |
| Parcial | La factura sigue viva por la diferencia |
| Tope | No se puede acreditar más de lo que queda por acreditar |

El PDF lleva impreso a qué factura corrige, por qué, y **la línea de retención**.
Sin ella el papel no cuadra: el total de una factura con retención no es el
subtotal más los impuestos, y quien lo lea pensará que la nota está mal.

Salen en su propio archivo del contable (*Notas de crédito*), no restadas de
las facturas. Un libro enseña las dos cosas: lo que se facturó y lo que se
corrigió. Restarlas por dentro cuadraría el total y borraría la corrección.

| Ruta | Qué hace |
|---|---|
| `GET /api/credit-notes?invoiceId=` | Lista |
| `POST /api/credit-notes` | `{ invoiceId, reason, amount? }` |
| `GET /api/credit-notes/:id/pdf` | El documento |

---

## QuickBooks

Si el negocio tiene QuickBooks conectado (Configuración → QuickBooks), **todo
documento contable se manda solo en cuanto existe**. No hay nada que pulsar.

| Qué | Cuándo sale | Función |
|---|---|---|
| Cliente | Antes que cualquier documento suyo | `enviarCliente` |
| Presupuesto | Al mandarlo al cliente | `enviarPresupuesto` |
| Factura | Al emitirla | `enviarFactura` |
| Nota de crédito | Al crearla | `enviarNotaDeCredito` |
| Cobro | Al registrarse — Stripe, a mano o por etapas | `enviarPago` |
| Gasto | Al apuntarlo | `enviarGasto` |

**El cobro es el que faltaba.** Con las facturas sincronizadas pero los cobros
no, la contabilidad de allí enseñaba todo pendiente de pagar mientras el dinero
ya estaba en la cuenta. Va como `Payment` enganchado a su factura por
`LinkedTxn`, que es lo que la cierra allí.

Lo que **no** se manda, y por qué:

- **Las nóminas.** La nómina de QuickBooks es otro producto, de pago y con su
  propia alta. Nuestras horas salen en la exportación para el contable.
- **Los acuerdos de trabajo.** Un contrato no es un asiento contable. Se
  descarga y se manda por mensajería; en los libros no pinta nada.

Automático **no quiere decir mudo**. Cada envío deja su rastro en
`quickbooks_links`, y la fila de la factura dice una de tres cosas:

| En la fila | Qué pasó |
|---|---|
| *En QuickBooks* | Llegó |
| *No llegó a QuickBooks* + el motivo + **Reintentar** | Falló |
| Nada | Ese negocio no usa QuickBooks |

### Lo que no llegó

`GET /api/quickbooks/pending` junta todo lo que falló, de los seis tipos, y lo
enseña en Configuración → QuickBooks. Es la única pantalla que contesta «¿está
mi contabilidad al día?».

Cada fila dice **qué hacer**, no qué contestó Intuit. `comoArreglarlo()` mira la
respuesta y la reduce a una de siete causas —falta un código de impuesto usable
en ventas, falta una cuenta, número duplicado, conexión caducada, lo cambiaron
allí mientras subía, falta algo de lo que depende, o no lo sabemos— y cada una
tiene su frase en los cuatro idiomas (`quickbooks.fix.*`).

La respuesta literal de QuickBooks **sigue estando**, plegada detrás de *Ver el
detalle técnico*. Enseñarla de primeras era pedirle a un contratista que
interprete un `Business Validation Error`; esconderla del todo nos dejaba sin
lo único que sirve para arreglarlo cuando nos escriben.

*Reintentar todo* va **de uno en uno, a propósito**: un cobro no puede subir
antes que su factura ni una factura antes que su cliente, y veinte llamadas a la
vez a Intuit es como se consigue que te limite y fallen las veinte.

**Nada de esto puede tumbar una emisión.** El envío va en segundo plano: la
factura se emite aquí pase lo que pase con Intuit, porque ya es válida y quien
la acaba de crear no tiene por qué esperar a QuickBooks ni ver un error suyo.

Lo que se manda con cuidado:

- **El cliente primero.** QuickBooks rechaza una factura de un cliente que no
  conoce, y el error no dice que falte el cliente. Se busca por nombre antes de
  crearlo, para no dejarle dos fichas del mismo cliente a quien ya lo tenía.
- **El impuesto no se manda calculado.** Se manda el código de la provincia y
  lo calcula QuickBooks. Mandar nuestro total daría impuesto sobre impuesto, y
  los libros tienen que cuadrar con **sus** reglas, que son las que mira el
  contable.
- **Nuestro número va como `DocNumber`**, para que las dos contabilidades
  hablen del mismo papel. Sin eso, casar una factura de aquí con una de allí es
  comparar importes a ojo.
- **Una factura anulada no se manda.** Allí no existe; crearla para anularla
  acto seguido deja dos apuntes donde no debería haber ninguno.

`quickbooks_links` es lo que impide duplicar: un reintento sobre algo ya
enviado no vuelve a crearlo.

### Y lo que cambian allí

Al abrir la facturación se pide a QuickBooks lo que haya cambiado, con freno
de cinco minutos en el servidor — «todo siempre igual» no puede costar una
llamada a Intuit por cada recarga.

**Lo nuestro no se sobrescribe con lo suyo, y es una decisión.** La factura la
emitimos aquí y es la que el cliente tiene en la mano; si alguien cambia el
importe allí, el equivocado puede ser cualquiera de los dos, y elegir en
silencio es la peor de las opciones.

| Lo que pasa allí | Lo que hacemos |
|---|---|
| Cambian el importe | La fila dice *«En QuickBooks pone X y aquí Y»*. Decide el contratista |
| La borran | La fila lo dice. Aquí sigue emitida |
| La marcan pagada | **Se toma.** Es información que aquí no existía |

El cobro que viene de allí pasa por `registrarCobro()`, el mismo sitio que el
de Stripe y el de la mano: la factura se cierra, la obra avanza si era la
final, y la petición del chat deja de decir «pendiente».

---

## Estados

| Estado | Qué significa |
|---|---|
| `pendiente` | Emitida, sin cobrar |
| `pagado` | Cobrada — la marca Stripe, o tú con *Marcar cobrada* |
| `vencido` | Pasó la fecha de vencimiento |
| `cancelado` | Anulada |

Con tarjeta, el paso a `pagado` lo hace el **webhook de Stripe**. Si un pago se
completó y la factura sigue pendiente, el problema es el webhook, no el cobro:
ver [pagos-stripe.md](pagos-stripe.md#el-webhook). Todo lo demás se apunta a
mano, arriba.

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
[orden de ejecución](proyectos.md#el-orden-de-ejecución) hasta *Al confirmar el
trabajo*, más *Cuando yo lo diga* para las etapas que son una decisión tuya.

No se puede elegir *al cerrar la obra*, y es a propósito: una obra pasa a
**completado** cuando se cobra la factura final, así que una etapa esperando a
eso cobraría después de haber cobrado. Si todas esperasen a eso, no se
facturaría nada, no se cobraría nada y la obra no se cerraría nunca. *Al
confirmar el trabajo* es el momento real de "está hecho, cobra el resto".

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

## Cobros por el chat

**Dónde:** Finanzas → Facturación → *Cobros por chat*

El plan de pagos cubre las etapas acordadas al firmar. Esto es todo lo demás:
el extra que aprobó el cliente el martes, un parcial adelantado, el depósito de
una obra que nunca tuvo plan formal.

Eliges cliente, obra, **qué es** ese dinero y **cuánto**:

- **Qué es**: *parte del proyecto* o *trabajo extra*. Sin esta distinción los
  reportes no pueden separar una obra que se pasó de presupuesto de una que
  simplemente creció — que son problemas opuestos con respuestas opuestas.
- **Cuánto**: una cantidad exacta, o un **% del proyecto**. El porcentaje sigue
  siendo porcentaje hasta que se envía, así que una orden de cambio aprobada
  entre medias mueve el importe. Resolverlo al crearlo cobraría el contrato
  viejo.

Le llega al cliente **como un mensaje en su chat, con su botón de pagar**. Paga
sin salir de la conversación, y el hilo queda como registro de lo que se pidió y
lo que se pagó.

### Programarlo

Deja la fecha vacía y sale ahora. Ponle fecha y espera a ese día.

No hay un proceso corriendo en segundo plano: lo pendiente sale cuando alguien
usa la aplicación — tú abriendo la lista, o el propio cliente entrando a su
portal, que es justamente cuando quiere verse. Puede llegar unos minutos tarde,
nunca días. Y siempre puedes darle a **Enviar ahora**.

### Necesita Stripe

Un cobro por el chat es un botón de pagar; sin Stripe ese botón no lleva a
ningún sitio. Si no lo tienes conectado la pestaña te lo dice y te señala lo que
sí funciona: emitir la factura normal y mandar su PDF por el chat. **La función
es opcional**, como todo lo de Stripe.

### Cancelar

Una petición programada se cancela sin más. Una ya enviada se marca cancelada,
no se borra: la factura y el mensaje ya existen delante del cliente, y hacer
como que nunca pasó los dejaría huérfanos.

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
| `GET/POST /api/payment-requests` | Cobros por chat |
| `POST /api/payment-requests/:id/send` | Enviar uno programado ya |
| `DELETE /api/payment-requests/:id` | Cancelarlo |
| `POST /api/public/stripe/webhook` | Confirmación de Stripe |

En `invoices`: `subtotal`, `tax_amount`, `tax_breakdown` (jsonb con el
desglose por impuesto), `holdback_amount`, y `amount` — que es **lo que
realmente se cobra**, ya neto de retención. Si añades otro camino para emitir
facturas, respeta esa relación o el cobro dejará de cuadrar con el documento.

Los números viven en la base, no en las rutas — igual que los de obra, y por
la misma razón: se factura desde más de un sitio (a mano, por etapa, por
cobro programado) y una fila creada por un camino nuevo se quedaría sin número
sin que nadie lo notara hasta que faltara en la serie.

| Objeto | Qué hace |
|---|---|
| `pon_numero_factura()` | `before insert` en `invoices` → `2026-0001` |
| `pon_numero_presupuesto()` | `before insert` en `estimates` → `EST-2026-0001` |
| `siguiente_numero(negocio, serie)` | El contador, en una sola sentencia |

Las series son `'factura-<año>'` y `'presupuesto-<año>'` en `numero_counters`.
A las dos funciones se les ha retirado el `EXECUTE` de `anon` y
`authenticated`: tienen privilegios y quedarían llamables por REST. El
disparador se ejecuta igual, que no pasa por ahí.
