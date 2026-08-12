# GPS y fichaje

---

## GPS y rutas

**Dónde:** menú → Campo → GPS y rutas
**Código:** `client/src/pages/GpsRouting.tsx`,
`client/src/components/TileMap.tsx` · Ruta: `GET /api/gps`

### Para qué sirve

Dónde está tu gente. El mapa dibuja los fichajes de las **últimas 24 horas**:

- **Punto de color**: sigue en obra (fichó entrada y no ha salido).
- **Punto gris**: ya fichó salida. Es historia, no posición actual.

Pulsa un punto y ves quién es, en qué obra y a qué hora fichó.

A la derecha, **Activos ahora** (quién está en obra según su estado) y
**Check-in recientes**, con un enlace para abrir cada posición en un mapa
completo.

### De dónde salen las posiciones

De los fichajes de la app del trabajador, que piden la ubicación al fichar.
No hay seguimiento continuo: el sistema sabe dónde estaba alguien **cuando
fichó**, no dónde está ahora mismo. Es lo que hace falta para verificar
asistencia, y no convierte el móvil de nadie en un rastreador.

Si el mapa está vacío, es que todavía nadie ha fichado hoy.

### Sin clave de API, sin factura

El mapa se dibuja con teselas de **OpenStreetMap**. No necesita clave de
Google Maps ni ninguna librería de mapas: es una rejilla de imágenes
posicionada con las matemáticas de Web Mercator, y unos marcadores encima.

Antes esta pantalla era un recuadro gris que prometía funcionar "cuando el
negocio configure su clave" — es decir, una factura que pagar antes de que la
pantalla sirviera para algo.

Si una tesela no carga (sin conexión, o el servidor de OSM va lento), esa
casilla se queda en fondo liso en vez de mostrar un icono de imagen rota.

---

## Check-in / Check-out

**Dónde:** menú → Campo → Check-in
**Código:** `client/src/pages/CheckIn.tsx` · Rutas: `/api/time-entries`

### Para qué sirve

Es la nómina: quién trabajó, dónde, cuántas horas, y si tú las apruebas.

Cada registro muestra el trabajador, la obra, la ubicación del fichaje, la
hora de entrada, la de salida y **las horas trabajadas** ya calculadas. Sin
esa cuenta hecha, aprobar horas sería restar dos marcas de tiempo a mano.

### Aprobar horas

1. Revisa el registro: ¿cuadra la obra?, ¿cuadran las horas?
2. **Aprobar horas**.
3. Pasa a *Aprobado*.

Un fichaje sin salida aparece como **En curso**: el trabajador todavía no ha
cerrado. No se pueden aprobar horas de un turno abierto, porque todavía no se
sabe cuántas son.

### Facturable o no

El trabajador marca al fichar si las horas son facturables. Sirve para separar
el tiempo que se le cobra al cliente del que no (traslados, taller,
reparaciones de garantía).

### Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/time-entries` | Los fichajes del negocio |
| `PATCH /api/time-entries/:id/approve` | Aprobar |
| `POST /api/worker/time-entries/check-in` | Entrada (desde la app) |
| `POST /api/worker/time-entries/:id/check-out` | Salida |
| `POST /api/worker/time-entries/switch-project` | Cambio de obra |

Tabla `time_entries`, con `check_in_lat` / `check_in_lng` y sus equivalentes
de salida. Son las mismas coordenadas que dibuja el mapa de GPS.

La aprobación es optimista en la pantalla: se marca al instante y se revierte
si el servidor falla. En una lista de treinta fichajes, esperar una respuesta
por cada clic haría la tarea insoportable.
