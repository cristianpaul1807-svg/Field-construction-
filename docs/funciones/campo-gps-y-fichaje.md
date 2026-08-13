# GPS y fichaje

---

## GPS y rutas

**Dónde:** menú → Campo → GPS y rutas
**Código:** `client/src/pages/GpsRouting.tsx`,
`client/src/components/TileMap.tsx` · Ruta: `GET /api/gps`

### Para qué sirve

Dónde está tu gente. El mapa dibuja los fichajes de las **últimas 24 horas**,
cada uno con su marcador:

- **👷 con el nombre encima**: sigue en obra (fichó entrada y no ha salido).
- **📍 en gris**: ya fichó salida. Es historia, no posición actual.
- **Marcador en ámbar**: va atrasado — tenía un trabajo programado que ya
  debería haber empezado y no lo ha fichado.

### Moverse por el mapa

Funciona como cualquier mapa al que estés acostumbrado:

| Gesto | Qué hace |
|---|---|
| Arrastrar | Mueve el mapa |
| Rueda del ratón | Acercar / alejar |
| Pellizcar con dos dedos | Acercar / alejar en el móvil |
| Botones **+** / **−** | Lo mismo, sin gestos |

La primera vez que cargan las posiciones el mapa se **encuadra solo** para que
entren todas. A partir de ahí no vuelve a moverse por su cuenta: si te has
acercado a una obra concreta, la actualización automática cada pocos segundos
no te devuelve la vista al punto de partida.

El zoom llega hasta el nivel 19, que es detalle de portal.

### La ficha del trabajador

Pulsa un marcador y debajo del mapa se abre su ficha:

- **Qué está haciendo**: la obra y el tipo de trabajo del fichaje abierto.
- **Tiempo en obra**: cuánto lleva desde que fichó entrada, contando en vivo.
- **Desde**: la hora exacta de entrada.
- **Su día**: los trabajos que tiene programados hoy. Los ya cubiertos salen
  tachados; los que debían haber empezado y siguen sin fichar salen en ámbar.

Arrastrar el mapa **no** abre la ficha del marcador que quede debajo del dedo:
sólo cuenta el toque que no se ha movido.

A la derecha, **Activos ahora** (quién está en obra según su estado) y
**Check-in recientes**, con un enlace para abrir cada posición en un mapa
completo.

### El mapa siempre se ve

Un mapa que desaparece cuando no hay nada que enseñar parece roto. Por eso hay
tres estados, y sólo el último es una pantalla sin mapa:

| Situación | Qué ves |
|---|---|
| Hay fichajes de las últimas 24 h | El mapa encuadrado sobre ellos |
| No hay ninguno hoy | El mapa con **las últimas posiciones conocidas**, una por persona, en gris y con un aviso de que son historia |
| Nunca ha fichado nadie | El mapa abierto sobre **la dirección de tu empresa** |
| No hay dirección guardada | Un aviso pidiéndote que la añadas en Configuración → Datos de la empresa |

Las posiciones antiguas nunca se disfrazan de actuales: salen apagadas, con
📍 en vez de casco, con la fecha junto a la hora, y con un aviso arriba del
mapa. Saber dónde estuvo alguien el viernes es útil; creer que está ahí ahora,
no.

### La dirección de la empresa, en el mapa

La dirección que guardas en Configuración se convierte en coordenadas la
primera vez que se abre esta pantalla, usando **Nominatim** — el geocodificador
de OpenStreetMap, sin clave y sin factura, la misma fuente que las teselas. El
resultado se guarda en tu negocio y no se vuelve a pedir, salvo que cambies la
dirección.

Si la dirección no se encuentra, no se inventa un punto: el mapa se queda sin
centro y te lo dice.

### Si no cargan las imágenes

Las teselas vienen de un servidor externo. Cuando no cargan (sin conexión, una
red que las bloquea, el servidor caído) aparece un aviso en la parte alta del
mapa diciendo que **las posiciones siguen siendo correctas** — porque lo son:
salen de los fichajes, no del servidor de mapas. Cada tesela se reintenta una
vez antes de darse por perdida.

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

Una tesela que no carga se queda en fondo liso en vez de mostrar un icono de
imagen rota; si no carga ninguna, sale el aviso descrito arriba.

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

---

## Las 8 horas y las extra

**Código:** `server/workTime.ts`

### La regla

**El día laboral son 8 horas.** Cuando un turno llega a la octava hora del
día, el sistema **parte el fichaje en ese instante**: la parte ordinaria se
cierra ahí y nace un segundo registro, marcado como extra, que empieza en ese
mismo minuto y termina cuando el trabajador ficha salida.

El resultado son dos filas cuyos tiempos suman exactamente el turno que se
trabajó, con el corte en el momento en que se cruzó.

Ejemplo: entra a las 07:00 y sale a las 17:30.

| Registro | Horas | Tipo |
|---|---|---|
| 07:00 → 15:00 | 8 h | Normales |
| 15:00 → 17:30 | 2,5 h | Extra |

### Cuenta el día entero, no el turno

Las 8 horas se cuentan **por persona y por día**, no por fichaje. Si alguien
trabaja 6 h por la mañana y vuelve por la tarde, su segundo turno pasa a extra
a las 2 h, no a las 8. Sólo las horas normales gastan el presupuesto del día:
las extra ya están por encima de él.

### Por qué se parte al fichar salida

No hay un temporizador esperando a que den las 8 h. El corte se hace en el
momento del check-out, que es la primera vez que se sabe cuánto duró el turno.
El resultado es idéntico y no depende de que haya un proceso vivo.

Si el reparto falla por lo que sea, **el fichaje se cierra igual**. Estar
fichado no es contabilidad: la alternativa sería dejar a alguien atrapado en el
reloj.

### Dónde se ve

- En **Check-in / Check-out**, el registro extra aparece como una entrada más,
  identificable por su hora de inicio.
- En **Nóminas**, la fila del periodo separa horas normales de horas extra, y
  el desglose del trabajador las trata por separado.
- En **Planificado vs. real** (abajo) tienen su propia columna.

---

## Planificado vs. real

**Dónde:** menú → Campo → Check-in → pestaña *Planificado vs. real*
**Código:** `client/src/components/WorkerPerformancePanel.tsx`,
`server/workTime.ts` · Ruta: `GET /api/reports/worker-performance`

### Para qué sirve

Es la comparación que un jefe de obra hace de cabeza y nadie escribe: lo que
tenías programado para cada persona frente a lo que fichó de verdad.

Eliges el periodo (por defecto, los últimos 14 días) y por cada trabajador
salen cuatro números:

| Número | Qué es |
|---|---|
| **Planificado** | Horas que tenía en la agenda |
| **Trabajado** | Horas normales fichadas |
| **Extra** | Horas por encima de las 8 del día |
| **Diferencia** | Trabajado + extra − planificado |

Más una etiqueta: **cubrió sus N trabajos**, o **N de M trabajos sin nadie
encima**.

### Tres números, no una nota

No hay un "% de eficiencia" único a propósito. Una cuadrilla que trabajó más
horas de las planificadas y otra que se saltó un trabajo caerían en la misma
nota, y son dos conversaciones opuestas: una es una obra que se alargó, la
otra es un trabajo que no se hizo.

La diferencia sólo se destaca en color cuando pasa de **una hora** en
cualquier sentido. Por debajo de eso es redondeo y tráfico, no un patrón.

### Qué cuenta como "sin nadie encima"

Un trabajo programado cuya ventana pasó **sin ningún fichaje que la solape**.
Si alguien estuvo, aunque fuera parte del rato, no cuenta como perdido: ya
estuvo allí, y que no cubriera todo el rato se ve en las horas.

Si alguien no tenía nada programado, la etiqueta no sale — no hay nada contra
lo que comparar y un badge vacío sólo sería ruido.

### Por dentro

Cruza `schedule_events` (lo planificado: `start_time`, `end_time`, y a quién
está asignado) con `time_entries` cerrados en el mismo periodo. Los turnos
marcados `overtime` van a su columna; el resto, a horas normales.

---

## Por dentro (fichaje)

| Ruta | Qué hace |
|---|---|
| `GET /api/time-entries` | Los fichajes del negocio |
| `PATCH /api/time-entries/:id/approve` | Aprobar |
| `GET /api/reports/worker-performance` | Planificado vs. real |
| `POST /api/worker/time-entries/check-in` | Entrada (desde la app) |
| `POST /api/worker/time-entries/:id/check-out` | Salida (parte a las 8 h) |
| `POST /api/worker/time-entries/switch-project` | Cambio de obra (también parte) |

Tabla `time_entries`, con `check_in_lat` / `check_in_lng` y sus equivalentes
de salida. Son las mismas coordenadas que dibuja el mapa de GPS. Las columnas
`overtime` (booleano) y `split_from` (el fichaje del que nació) marcan la parte
extraordinaria.

La aprobación es optimista en la pantalla: se marca al instante y se revierte
si el servidor falla. En una lista de treinta fichajes, esperar una respuesta
por cada clic haría la tarea insoportable.
