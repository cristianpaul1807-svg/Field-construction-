# Órdenes de trabajo

**Dónde:** menú → Campo → Órdenes de trabajo
**Código:** `client/src/pages/WorkOrders.tsx` · Rutas: `/api/work-orders`

---

## Para qué sirve

Una orden de trabajo es una tarea concreta asignada a una persona concreta:
"instalar los azulejos del baño, Marc, prioridad alta". Es el nivel de detalle
que hay entre "el proyecto va por el 40%" y lo que alguien tiene que hacer
mañana por la mañana.

No confundir con:

- **[Agenda](agenda.md)** — cuándo se hace algo, en un calendario.
- **[Órdenes de cambio](proyectos.md#órdenes-de-cambio)** — trabajo extra que
  el cliente pidió y que cambia el precio.

Una orden de trabajo es **qué hay que hacer y quién lo hace**.

---

## Crear una

1. **Nueva orden de trabajo**.
2. **Proyecto**.
3. **Título**: la tarea, escrita como se la dirías a la persona ("Instalar
   azulejos del baño"). Evita títulos vagos como "seguir con el baño".
4. **Descripción**, opcional: medidas, material, cualquier detalle que evite
   una llamada.
5. **Prioridad**: baja, media o alta.
6. **Asignar a**: un empleado o un subcontratista. Puede quedar sin asignar
   si todavía no sabes quién.
7. **Crear orden**.

En cuanto se asigna, la persona la ve en su app de campo
([guía](equipo.md#la-app-del-trabajador)).

---

## Moverla de estado

El selector está **en la propia tarjeta**, no escondido detrás de un diálogo.
Mover una orden es lo que más se hace en esta pantalla, y se hace desde un
móvil, en obra.

| Estado | Qué significa |
|---|---|
| `pendiente` | Todavía no se ha empezado |
| `en_progreso` | Alguien está en ello |
| `completada` | Hecha |

El cambio se guarda al momento.

---

## Prioridades

Sirven cuando hay más trabajo del que cabe en el día:

- **Alta** — bloquea a otros, o el cliente está esperando.
- **Media** — el trabajo normal.
- **Baja** — cuando haya hueco.

Si todo es alta, nada es alta.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/work-orders` | La lista |
| `POST /api/work-orders` | Crear |
| `PATCH /api/work-orders/:id` | Estado, prioridad, título, descripción |

Una orden puede tener asignado **un empleado o un subcontratista, no ambos**:
la tabla lo permite solo así, y por eso el selector de la pantalla codifica el
tipo dentro del valor (`emp:…` / `sub:…`) y el servidor rellena exactamente
uno de los dos campos.

`status` y `priority` se validan contra una lista blanca en el servidor. Un
valor inventado devuelve 400 con un mensaje claro, en vez de un 500 desde la
restricción de la base de datos.
