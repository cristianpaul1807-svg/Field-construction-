# Reportes

**Dónde:** menú → Finanzas → Reportes
**Código:** `client/src/pages/Reports.tsx` · Ruta: `GET /api/reports`

---

## Para qué sirve

La vista de negocio, no de obra. Control de costos te dice si **este proyecto**
va bien; Reportes te dice si **la empresa** va bien.

---

## Qué muestra

**Ingresos vs. gastos por mes.** Construido a partir de las fechas reales de
los pagos recibidos y de los gastos registrados. No es un agregado guardado ni
una proyección: son hechos.

Cuando las dos líneas se acercan, el margen se está estrechando. Es lo que
conviene mirar antes de aceptar la siguiente obra a precio ajustado.

**Facturación del mes** y **cobros pendientes.** La diferencia entre lo que
has facturado y lo que has cobrado es tu problema de tesorería. Una empresa
puede tener el mejor mes de su historia en facturación y no poder pagar
nóminas.

**Presupuestos por aprobar.** Cuánto dinero está esperando una decisión del
cliente. Si esa cifra crece y no se convierte, el problema está en el
seguimiento, no en la captación.

**Proyectos activos** y su avance.

---

## Cómo leerlo

La lectura útil no es una cifra suelta, sino tres relaciones:

1. **Facturado vs. cobrado.** Si la diferencia crece mes a mes, hay facturas
   que nadie está persiguiendo. Ve a
   [Facturación](facturacion.md) y filtra por vencidas.
2. **Presupuestado vs. gastado**, en agregado. Si casi todas las obras se
   pasan en la misma categoría, el problema está en tus precios de catálogo,
   no en las obras. Se arregla en [Materiales](materiales.md).
3. **Cotizado vs. ganado**, que se ve en las tarjetas del
   [CRM](clientes.md#el-embudo). Muchos `cotizado` y pocos `ganado` es un
   problema de precio o de seguimiento.

---

## Si los gráficos están vacíos

Significa que faltan datos de entrada, no que el reporte falle:

- Sin facturas pagadas no hay línea de ingresos → [Facturación](facturacion.md)
- Sin gastos registrados no hay línea de gastos →
  [Control de costos](control-de-costos.md)

Los gastos son los que más se olvidan, y son justo los que hacen que el
reporte diga la verdad. Un gráfico que solo muestra ingresos no es un reporte
de rentabilidad.

---

## Por dentro

`GET /api/reports` devuelve las series y los agregados ya calculados. La serie
mensual se agrupa en el servidor a partir de `invoices.paid_at` y
`expenses.date`.

Nada de esto está precalculado ni guardado: se consulta cada vez. Con el
volumen de una empresa de construcción eso es holgado, y evita el problema
clásico de un agregado que se queda desactualizado y nadie se entera.
