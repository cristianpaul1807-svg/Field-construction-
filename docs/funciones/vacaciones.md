# Vacaciones y ausencias

**Dónde:** Campo → Vacaciones y ausencias (`/time-off`)
**Código:** `client/src/pages/TimeOff.tsx`,
`client/src/components/WorkerScheduleView.tsx`
**Tabla:** `time_off`

Los días que alguien no está: vacaciones, baja, permiso o festivo. Salen en el
calendario del móvil de esa persona y se cuentan aparte de las horas cuando se
prepara la nómina.

---

## Por qué tiene tabla propia

Tiene fechas y sale en el mismo calendario que el trabajo, así que la tentación
es meterlo en `schedule_events`. No cabe:

| `schedule_events` | `time_off` |
|---|---|
| Cuelga de una obra (`project_id`) | No hay obra |
| Dura horas | Dura días enteros |
| No hay nada que aprobar | Alguien tiene que decir que sí |

Alojarlo allí habría obligado a aflojar la tabla del trabajo —`project_id`
nulo, horas que no significan nada, un estado nuevo que el resto de las filas
ignora— para guardar lo que precisamente **no** es trabajo.

---

## Quién lo crea

`requested_by` distingue las dos cosas, porque acaban en la misma tabla:

- **`admin`** — el contratista planifica. Nace **aprobada**: nadie se pide
  permiso a sí mismo para cerrar en agosto.
- **`trabajador`** — el trabajador pide sus días. Nace `planificada` y la
  oficina la aprueba o la rechaza.

---

## Estados

| Estado | Qué significa |
|---|---|
| `planificada` | Pedida, sin contestar |
| `aprobada` | Confirmada |
| `rechazada` | No |

Los botones de aprobar y rechazar **sólo salen sobre lo planificado**. Un
«aprobar» encima de algo ya aprobado es un botón que no hace nada.

---

## Dónde sale

**En el móvil del trabajador**, tres sitios a la vez:

1. Un aviso arriba cuando el día que está mirando cae dentro de una ausencia.
   Sin eso, una agenda vacía no distingue «hoy no hay trabajo» de «hoy son tus
   vacaciones», que es justo la llamada que se quiere evitar.
2. Los días pintados en la rejilla del mes, **con el fondo, no con un punto**.
   Un punto igual que el de un día con una visita se lee como trabajo.
3. Una lista de sus próximos días libres, con *Pendiente* al lado si todavía no
   se los han aprobado.

Sólo ve lo suyo y **no ve lo rechazado**: la ruta filtra por su columna y por
`status <> 'rechazada'`.

**En la nómina**, junto a las horas. Sin esto, unas horas bajas mandan a
revisar los partes; con los días fuera al lado, la mitad de esas revisiones no
hacen falta. Quien estuvo **todo el periodo fuera** aparece igual aunque tenga
cero horas — antes el filtro `hours > 0` lo borraba de la lista justo cuando
más falta hacía verlo.

Los días se **recortan al periodo**: unas vacaciones de julio a agosto cuentan
en la quincena de julio sólo por los días que caen dentro.

---

## Rutas

| Ruta | Qué hace |
|---|---|
| `GET /api/time-off?from=&to=&employeeId=` | Lista. Los rangos se **solapan**, no se comparan enteros |
| `POST /api/time-off` | Crea. Nace aprobada |
| `PATCH /api/time-off/:id/status` | Aprobar o rechazar |
| `DELETE /api/time-off/:id` | Borrar |
| `GET /api/worker/schedule` | Devuelve `timeOff` junto a eventos y órdenes |

---

## Qué suele salir mal

**Unas vacaciones a caballo de dos meses no salen en uno de ellos.** El filtro
compara `end_date >= from` y `start_date <= to` precisamente para que salgan en
los dos. Si alguien lo cambia a comparar sólo `start_date`, desaparecen de
agosto las que empezaron en julio.

**Un solo día.** Se guarda con la misma fecha en los dos campos. El formulario
lo hace solo si se deja el «hasta» vacío.

**Los días se cuentan con los dos extremos dentro.** Del 3 al 5 son tres días,
no dos. Está en `diasDeAusencia()`.
