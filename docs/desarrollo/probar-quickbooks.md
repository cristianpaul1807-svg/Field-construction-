# Probar lo que sale hacia QuickBooks

```bash
node scripts/prueba-quickbooks/correr-todo.mjs
```

Comprueba **el documento exacto** que el sistema mandaría a Intuit en cada
paso de una obra —factura, cobro, nota de crédito, gasto, comisión de Stripe,
nómina— sin llamar a Intuit y sin necesitar ninguna clave.

---

## Por qué existe

Los fallos de una integración contable no se ven mirando la pantalla. Una
factura que sale bien y un cobro que sale bien pueden dejar, juntos, el banco
en negativo. Un asiento de nómina descuadrado lo rechaza QuickBooks **entero**
y nadie se entera hasta que el contable pregunta por qué falta un mes.

Y probar contra el sandbox de verdad tiene dos pegas: hace falta una conexión
viva con sus claves, y deja basura en una empresa que luego hay que limpiar.
Esto corre en un segundo, no necesita red y se puede ejecutar cien veces.

**La primera vez que se ejecutó encontró un fallo real:** el asiento de la
nómina cuadraba sólo si el desglose de retenciones sumaba exactamente lo
mismo que los totales de la hoja. Cuando no —una hoja sin líneas, un ajuste a
mano—, salía descuadrado y QuickBooks lo rechazaba.

---

## Cómo funciona

Compila `server/quickbooksSync.ts` —**el módulo de verdad**, el que corre en
producción— y sustituye una sola pieza: `llamar()`, la puerta de salida hacia
Intuit. En vez de enviar, la graba.

Probar una copia del código no probaría nada, así que no hay copia: el
`esbuild` de `correr.mjs` resuelve `./quickbooks` al espía y deja el resto
intacto.

| Archivo | Qué es |
|---|---|
| `correr.mjs` | Compila el módulo real con el espía en lugar de Intuit |
| `stub-quickbooks.js` | El espía. Graba los `POST` y contesta las consultas como un QuickBooks canadiense |
| `admin.js` | Un doble de Supabase: encadena igual y devuelve las filas del caso |
| `obra.mjs` | Una obra entera, de principio a fin |
| `esquinas.mjs` | Los casos raros |
| `correr-todo.mjs` | Lanza las dos y devuelve 1 si algo falla |

Un detalle que costó encontrar y conviene no repetir: el espía se resuelve con
**`external: true`**. Si se empaqueta, acaba duplicado —una copia dentro del
paquete y otra fuera— y las llamadas se graban en la que nadie mira, así que
todo parece no enviarse.

---

## Qué comprueba

**La obra** (`obra.mjs`), con los números de Quebec: 5 000 $ de trabajo, TPS
5 %, TVQ 9,975 %, retención del 10 %.

- La factura lleva **nuestro** número, el importe **sin** impuestos, y el
  código de impuesto en la línea.
- **No** manda `TxnTaxDetail`, y sí `GlobalTaxCalculation: TaxExcluded`.
  Mandar los dos le pide a QuickBooks que cuadre solas dos cosas, y cuando no
  puede contesta que no consiguió calcular el impuesto.
- El cobro es el total **menos la retención** (5 248,75 $), queda enganchado a
  su factura por `LinkedTxn`, y con tarjeta entra en la cuenta bancaria y no
  en fondos sin depositar.
- La nota de crédito y el gasto cuadran.
- El asiento de la nómina **cuadra**, con las retenciones separadas por
  destino y sin impuesto sobre las ventas.
- Quien lleva su nómina en QuickBooks Payroll **no recibe nada**, para no
  contar los salarios dos veces.

**Las esquinas** (`esquinas.mjs`):

- Una nómina cuyo desglose de retenciones no concuerda con sus totales sigue
  produciendo un asiento cuadrado.
- Un subcontratista sale como **compra**, no como nómina.
- Dos cobros parciales llegan como dos cobros sobre **una sola** factura.
- Una factura anulada no se manda.
- Reenviar no duplica.
- Sin código de impuesto, el aviso dice **dónde** arreglarlo.

---

## Añadir un caso

Los casos son datos, no código. En `obra.mjs` está el objeto `filas`: una
entrada por tabla con lo que devolvería Supabase. Cambia los números, añade la
comprobación con `comprobar(...)` y ya está.

Si el caso nuevo necesita una tabla que aún no está, añádela a `filas` — el
doble de Supabase no valida nada, devuelve lo que le pongas.

**Cuidado con los datos de mentira.** La primera versión de esta prueba
«encontró» un asiento descuadrado que no lo estaba: el error era del caso, que
tenía el neto mal calculado y las líneas sin la parte del empleador. Antes de
dar por bueno un fallo, comprueba que el caso es posible en la realidad —
`server/payroll.ts` dice cómo se calcula cada cifra de una hoja.

---

## Lo que esto **no** comprueba

- Que QuickBooks acepte el documento. La forma se comprueba aquí; que Intuit
  esté de acuerdo, sólo se sabe contra un sandbox real.
- Las tasas de impuesto. Aquí el espía contesta con un código canadiense
  ficticio; **quién calcula TPS y TVQ es QuickBooks**, no nosotros. Eso se
  verifica con una factura en un sandbox canadiense.
- La autenticación, el refresco de tokens y los reintentos, que viven en
  `server/quickbooks.ts` y tienen su propia puerta.
