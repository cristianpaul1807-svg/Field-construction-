# Panel

**Dónde:** menú → Panel (la pantalla de inicio)
**Código:** `client/src/pages/Dashboard.tsx` · Ruta: `GET /api/reports`

---

## Para qué sirve

Es la primera pantalla al entrar. Responde a cuatro preguntas de un vistazo:
cuánto trabajo hay abierto, cuánto dinero está pendiente, qué necesita una
decisión tuya hoy, y quién te ha escrito.

Todo lo que se ve son datos reales del negocio. No hay ninguna cifra de
ejemplo.

---

## Qué muestra

**Las tarjetas de arriba**

| Tarjeta | De dónde sale |
|---|---|
| Proyectos activos | Proyectos que no están `completado` |
| Presupuestos pendientes | Presupuestos en `enviado` o `pendiente_aprobacion` |
| Ingresos del mes | Facturas pagadas este mes |
| Nuevos contactos | Clientes con estado `nuevo` |

**Ingresos vs. gastos.** Serie mensual construida a partir de las fechas
reales de pagos y de gastos. No es un agregado guardado ni una serie de
ejemplo: si el gráfico está vacío, es que todavía no hay pagos ni gastos
registrados, y eso también es información.

**Conversaciones del chat público.** Quién ha escrito por tu enlace público y
en qué punto del flujo está. Cada una lleva a la conversación completa.

**Presupuestos por aprobar.** Los que esperan una decisión tuya. Llevan
directamente al constructor de presupuestos.

**Próximas visitas.** Lo siguiente en la agenda.

---

## Qué hacer desde aquí

El panel es el punto de partida, no un sitio donde se trabaja:

- Un presupuesto pendiente → **Presupuestos** ([guía](presupuestos.md))
- Una conversación nueva → **Comunicación** ([guía](comunicacion.md))
- Cobros pendientes → **Facturación** ([guía](facturacion.md))

---

## Si algo está vacío

Un panel vacío casi siempre significa que el negocio es nuevo, no que algo
falle. El orden natural para empezar a llenarlo:

1. **Configuración → Datos de la empresa**: nombre, licencia RBQ, provincia y
   números de TPS/TVQ. Sin esto, los PDF salen sin cabecera.
2. **Materiales**: carga tu catálogo de precios.
3. **CRM**: da de alta un cliente, o comparte tu enlace público y espera al
   primero.
4. **Presupuestos**: haz el primero.

Si en vez de vacío ves un error de carga, ve a
[../desarrollo/solucion-de-problemas.md](../desarrollo/solucion-de-problemas.md).
