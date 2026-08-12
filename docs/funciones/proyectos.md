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

## El orden de ejecución

Una obra no es una fila que alguien edita: es una secuencia de cosas que
pasan. El software mueve el estado solo, a partir de esas cosas, y deja
constancia de qué lo movió. Está en `server/lifecycle.ts`.

| Estado | Qué significa | Qué lo dispara |
|---|---|---|
| Planificación | Aceptada, programándose, nadie en obra todavía | Se acepta el presupuesto, o se crea la obra a mano |
| En progreso | Hay gente trabajando | Primer fichaje en obra, o una orden de trabajo que arranca |
| Confirmado | El trabajo está hecho y visto bueno | Se cierra la última orden de trabajo, o el cliente lo confirma desde su portal |
| Completado | No queda nada abierto | Se cobra la factura final |

**Pausado** está fuera de la secuencia. Es una decisión humana — un permiso
que no llega, un cliente que dejó de contestar — así que ningún evento
automático lo levanta. Alguien tiene que decir que la obra se reanudó. Un
fichaje sobre una obra pausada se registra igual, pero no la reactiva.

Hacia atrás nunca va sola. Sí puedes moverla tú a donde quieras (una obra
cerrada que vuelve por garantía, una obra en efectivo que nunca tuvo factura):
el cambio se acepta y queda registrado como manual, con tu nombre y la fecha.

### Los tres flujos de entrada

De dónde vino la obra cambia lo que falta al principio, y por eso se guarda:

| Entró por | Primer paso | Cómo llega |
|---|---|---|
| Chat público | Solicitud recibida por el chat | Un desconocido usa `/c/:slug`; el bot recoge los datos y deja un presupuesto en borrador |
| Portal del cliente | Solicitud desde su portal | Un cliente que ya tiene acceso escribe o acepta desde `/portal` |
| Panel | Obra dada de alta a mano | La creas tú, con o sin presupuesto detrás |

A partir del segundo paso los tres van por el mismo camino: presupuesto
aceptado → trabajo programado → equipo fichando → órdenes terminadas →
factura final emitida → factura final cobrada.

El origen no se pregunta: se hereda del cliente, que ya guarda por dónde
apareció. Una obra que escribes tú para un cliente que llegó por el chat
sigue siendo una obra de chat.

### Dónde se ve

En el hub del proyecto, pestaña **Resumen**: la tarjeta *Orden de ejecución*
lista los pasos, marca los hechos, señala cuál es el siguiente y abajo enseña
el historial de estados con quién y cuándo. El cliente ve la misma lista en su
portal, sin el historial.

Nada de esa tarjeta es pulsable, y es a propósito: un paso se marca haciendo
la cosa, no diciendo que la hiciste.

### Cómo se cierra desde el otro lado

El cliente, desde su portal, tiene **Confirmar que el trabajo está terminado**
mientras la obra está en progreso. No la cierra — la factura final sigue
pendiente — pero deja su visto bueno con fecha, que es la mitad de la discusión
que normalmente no tiene ninguna prueba detrás.

---

## Estado y avance a mano

Los dos los ve tu cliente en su portal.

1. Entra al proyecto → **Editar estado y avance**.
2. Estado: planificación, en progreso, confirmado, completado, pausado.
3. Avance: la barra, de 0 a 100 en saltos de 5.
4. **Guardar**.

El estado que pongas se respeta, pero el orden de ejecución de arriba se sigue
calculando de los datos reales, así que la tarjeta te dirá igualmente qué falta.

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
