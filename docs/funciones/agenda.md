# Agenda

**Dónde:** menú → Campo → Agenda
**Código:** `client/src/pages/Scheduling.tsx`,
`client/src/components/ScheduleEventDialog.tsx` · Rutas: `/api/schedule-events`

---

## Para qué sirve

El calendario del proyecto: visitas, llamadas, reuniones, inicios de obra y
fechas de entrega, en una vista de día por horas.

Requiere tener un proyecto seleccionado en el selector de la barra superior.

---

## Añadir algo

1. **Agregar**, o pulsa directamente sobre la hora que quieras.
2. Elige el modo:
   - **Trabajo asignado** — anclado a una persona. Cuenta para la proyección
     del proyecto y le aparece en su app de campo.
   - **Nota manual** — un recordatorio tuyo. No se le asigna a nadie.
3. **Título**.
4. Si es trabajo asignado: **trabajador** (empleado o subcontratista).
5. **Tipo**: visita, llamada, reunión, inicio de obra o entrega.
6. **Fecha**, **hora** y **duración aproximada**.
7. **Notas**, opcional.
8. **Guardar**.

Los eventos de trabajo salen coloreados por trabajador, así que de un vistazo
se ve si has puesto a la misma persona en dos sitios a la vez.

---

## De dónde salen los eventos

**A mano**, aquí.

**Del presupuesto.** En el constructor de presupuestos puedes montar la
proyección de trabajo — quién hace qué y cuándo — mientras todavía es un plan.
**Al aceptarse el presupuesto, todo eso se vuelca aquí de golpe.** No hay que
volver a planificar. Ver
[presupuestos.md](presupuestos.md#proyección-de-trabajo).

**De una cita del chat público.** Si un visitante pidió cita, la confirmas
desde el panel y se crea el evento. Ver
[chat-publico.md](chat-publico.md#citas).

---

## Quién lo ve

Un evento de **trabajo asignado** aparece en la app de campo de esa persona,
en su vista de hoy y de la semana. Una **nota manual** es solo tuya.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/schedule-events` | Los eventos, filtrables por proyecto |
| `POST /api/schedule-events` | Crear |
| `GET /api/worker/schedule` | Lo que ve el trabajador |
| `POST /api/estimates/:id/accept` | Vuelca la proyección al calendario |

Tabla `schedule_events`, con `assigned_employee_id` **o**
`assigned_subcontractor_id` — nunca los dos. El selector codifica el tipo
dentro del valor y el servidor rellena solo el campo que corresponde.

`type` guarda su slug en español (`visita`, `inicio`, `fin`) y se traduce al
mostrarlo con `t(\`scheduling.types.${type}\`)`. Si añades un tipo nuevo, añade
su clave en los cuatro idiomas o la pantalla mostrará el slug crudo — ver
[../desarrollo/idiomas.md](../desarrollo/idiomas.md).
