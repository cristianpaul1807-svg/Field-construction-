# Proyectos

**Dónde:** menú → Proyectos → Proyectos
**Código:** `client/src/pages/Projects.tsx`, `ProjectDetail.tsx`

---

## Para qué sirve

Un proyecto es la obra. Todo lo demás cuelga de aquí: presupuesto, gastos,
fotos, documentos, agenda, órdenes de trabajo y órdenes de cambio.

La lista muestra una tarjeta por obra, con su estado, su avance y cuánto
llevas gastado de lo presupuestado. Pulsa una para entrar al hub.

---

## Crear un proyecto

**Automáticamente**, cuando se acepta un presupuesto. Es lo normal, y no hay
que hacer nada.

**A mano**, si la obra no vino de un presupuesto:

1. **Nuevo proyecto**.
2. Elige el cliente y ponle nombre.
3. Tipo de obra y fechas si las sabes.
4. **Crear proyecto**.

---

## Estado y avance

Los dos los ve tu cliente en su portal. Mantenerlos al día es lo que evita la
llamada de "¿cómo va lo mío?".

1. Entra al proyecto → **Editar estado y avance**.
2. Estado: planificación, en progreso, pausado, completado.
3. Avance: la barra, de 0 a 100 en saltos de 5.
4. **Guardar**.

---

## Las pestañas del hub

**Resumen.** Avance, equipo asignado, presupuesto vs. gastado, fechas. A la
derecha, tres accesos: enviar una actualización (lleva al chat), ver la
ubicación (abre la dirección en un mapa) y el PDF del presupuesto.

**Presupuesto.** Las líneas del presupuesto vinculado, y el botón para
descargar el PDF.

**Gastos.** Presupuestado vs. real por categoría, con la desviación. El
detalle está en [control-de-costos.md](control-de-costos.md).

**Documentos.** Contratos, permisos y planos ([guía](documentos-y-fotos.md)).

**Fotos.** Las de la obra, con su marca de visible al cliente o interna.

**Órdenes de cambio.** Ver abajo.

**Agenda.** Los eventos de este proyecto ([guía](agenda.md)).

---

## Órdenes de cambio

*(en francés **avenant**, en inglés **change order**)*

### Por qué existen

Una obra deja de parecerse a su presupuesto la primera vez que el cliente pide
algo extra. Sin un registro, o te comes el coste o discutes al final. La orden
de cambio es ese registro: qué se añade, cuánto cuesta, y quién lo aprobó.

**Escríbela antes de hacer el trabajo.** Ese es todo el valor.

### Crear una

1. Proyecto → pestaña **Órdenes de cambio** → **Nueva orden de cambio**.
2. Título ("Añadir isla de cocina") y descripción de qué cambia y por qué.
3. Importe, **antes de impuestos**. Puede ser **negativo** si se quita trabajo
   del alcance — un crédito es tan orden de cambio como un extra.
4. **Crear**. Nace en `borrador`.

### El ciclo

| Estado | Qué significa |
|---|---|
| `borrador` | La estás escribiendo. El cliente no la ve |
| `enviado` | Se la mandaste. Ahora puede decidir |
| `aprobado` | Aceptada — cuenta en el total del proyecto |
| `rechazado` | No la quiso |

Pásala a **enviado** con el selector de su fila. En cuanto lo hagas, le
aparece en su portal con dos botones: **Aprobar** y **Rechazar**.

Que tú marques "aprobado" en tu pantalla es una nota. Que lo pulse el cliente
es el acuerdo. Por eso el portal existe.

### Qué cambia al aprobarse

El importe se suma al total del proyecto y al presupuesto contra el que se
mide el gasto real, tanto en el hub como en Control de costos. Sin eso, cada
obra con extras parecería estar pasada de presupuesto cuando no lo está.

Las fechas (`sent_at`, `decided_at`) las pone el servidor en la transición, no
el cliente: así el historial no se puede retrasar.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/projects` · `/:id` | Lista y hub |
| `POST /api/projects` | Crear |
| `PATCH /api/projects/:id` | Estado, avance, nombre, tipo, fechas |
| `GET · POST · PATCH · DELETE /api/change-orders` | Órdenes de cambio |
| `GET /api/client-portal/change-orders` | Las del cliente |
| `POST /api/client-portal/change-orders/:id/decide` | Su decisión |

`progress_percent` se valida entre 0 y 100 en el servidor, y `status` contra
una lista blanca. Un valor fuera de rango devuelve 400, no un 500 desde la
base de datos.
