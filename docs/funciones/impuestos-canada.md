# Impuestos canadienses y retención

**Código:** `computeInvoiceTax()` en `server/api.ts`, tabla `canada_tax_rates`
**Se configura en:** Configuración → Datos de la empresa

---

## Cómo se calcula el impuesto

El sistema mira la **provincia** de tu negocio y aplica la tasa que
corresponde. No hay que recordar nada de memoria ni hacer la cuenta a mano.

Canadá tiene tres esquemas distintos:

| Esquema | Provincias | Qué se cobra |
|---|---|---|
| **GST + PST/QST** | QC, BC, SK, MB | Dos impuestos separados, cada uno en su línea |
| **HST** | ON, NB, NS, PE, NL | Uno solo, armonizado |
| **Solo GST** | AB, NT, NU, YT | 5% federal |

**Quebec**, que es el mercado principal:

```
TPS (GST federal)      5,000 %
TVQ (QST provincial)   9,975 %
```

Se calculan **por separado**, cada uno sobre el subtotal, y aparecen en dos
líneas distintas en la factura. No se suman en una sola tasa del 14,975%:
para la contabilidad del cliente son dos impuestos con dos números de
inscripción distintos.

### Cambiar tu provincia

Configuración → Datos de la empresa → **Provincia**. Las facturas nuevas usan
la tasa nueva; las ya emitidas conservan la suya, porque guardan su propio
desglose en `tax_breakdown`.

---

## Números de inscripción: obligatorios

En Quebec, una factura sin los números de TPS y TVQ es una factura que el
contador de tu cliente te devuelve.

Configuración → Datos de la empresa → *Datos para presupuestos y facturas*:

| Campo | Formato |
|---|---|
| Número de TPS/GST | `123456789 RT0001` |
| Número de TVQ/QST | `1234567890 TQ0001` |
| Licencia RBQ | `RBQ 5812-3456-01` |

Los tres se imprimen en la cabecera de cada presupuesto y cada factura. Si los
dejas vacíos, el documento sale sin ellos.

---

## La retención (retenue / holdback)

### Qué es

En Canadá se retiene un porcentaje de cada pago parcial hasta que la obra
termina y pasa el plazo de reclamaciones. **En Quebec lo habitual es el 10%.**

No es una penalización: es la garantía del cliente de que vas a terminar y de
que los subcontratistas van a cobrar.

### Cómo activarla

Configuración → Datos de la empresa → **Retención por defecto (%)**.

Déjala en **0** si no la aplicas. Ponla en **10** para el estándar de Quebec.

### Cómo funciona

- **Depósitos y pagos parciales**: se retiene el porcentaje. El cliente paga
  menos de lo facturado, y la factura lo dice.
- **Pago final**: **no** se retiene. El pago final es justo donde se libera lo
  retenido — aplicarla ahí sería retener el mismo dinero dos veces.

El cálculo:

```
retención = subtotal × %retención
a cobrar  = subtotal + impuesto − retención
```

El impuesto va sobre el **valor completo del trabajo**. La retención afecta
solo al pago, no a lo que se debe al fisco.

### Dónde se ve

- **En la factura (PDF)**: una línea negativa llamada *Retenue / Holdback*
  justo antes del total, para que el cliente vea el importe facturado y el
  importe a pagar, y exactamente en cuánto difieren.
- **En el presupuesto (PDF)**: una frase que anuncia el porcentaje desde el
  principio, para que nadie se sorprenda con la primera factura.
- **En la lista de Facturación**: debajo del importe.

---

## Un ejemplo completo

Obra en Montreal. Pago parcial de 10.000 $ antes de impuestos, con 10% de
retención:

```
Subtotal                        10 000,00 $
TPS (5 %)                          500,00 $
TVQ (9,975 %)                      997,50 $
Retención (10 % de 10 000)      −1 000,00 $
─────────────────────────────────────────────
A PAGAR                         10 497,50 $
```

Los 1.000 $ retenidos se cobran en el pago final, que no lleva retención.

---

## Por dentro

`canada_tax_rates` tiene una fila por provincia con `gst_rate`, `pst_rate`,
`hst_rate` y la bandera `is_hst`. Es una tabla de referencia fija, con RLS
activado y lectura pública: **las escrituras solo pasan por service role**,
porque sin eso cualquiera con la clave anónima podría reescribir las tasas con
las que se calcula cada factura del sistema.

`computeInvoiceTax()` devuelve el importe total y un desglose que se guarda
en la factura:

```json
{ "province": "QC", "gst": 500.00, "pst": 997.50 }
```

Guardar el desglose (y no solo la tasa) es lo que permite que una factura
antigua siga imprimiéndose correctamente después de que cambien las tasas o de
que muevas tu negocio de provincia.

Redondeo: `Math.round(x * 100) / 100`, una sola vez, sobre cada impuesto por
separado.
