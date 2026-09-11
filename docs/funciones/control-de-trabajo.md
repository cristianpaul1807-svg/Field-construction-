# Control de trabajo

**Menú:** Campo → Control de trabajo · **Ruta:** `/work-log`

Una línea por número de obra, con lo que de verdad pasó en ella: quién estuvo,
cuándo, y cuántas horas. Es la pantalla que responde a *"¿qué llevamos gastado
en el Bc-26-0007?"* sin cruzar tres pantallas a mano.

---

## El número de obra

Cada trabajo programado lleva un número propio, emitido al crearlo:

```
Ba-26-0014
││ │  └── correlativo del año, por negocio
││ └───── año, dos cifras
│└─────── letra del tipo de trabajo (minúscula)
└──────── letra de la obra (mayúscula)
```

- **La letra de la obra** se asigna por orden de alta: A, B, C… y cuando pasa
  de la Z sigue como las columnas de una hoja de cálculo (AA, AB…). Una sola
  letra se agotaría en el proyecto 27.
- **La letra del tipo** sale de la tabla `service_types`, donde cada tipo del
  negocio tiene la suya. `x` está reservada para "sin especificar": un trabajo
  que nadie clasificó también necesita número.
- **El correlativo** reinicia cada 1 de enero y es **por negocio**. Dos
  empresas no comparten numeración; si la compartieran, cada una vería huecos
  donde la otra ha creado algo.

### El número no cambia nunca

Se emite al insertar la fila y ahí se queda, aunque después se cambie el tipo
de trabajo o se mueva la fecha. Si cambiara, el número escrito en un albarán,
en una factura y en una hoja de horas dejaría de coincidir — y entonces ya no
identifica nada.

### Qué lleva número y qué no

| | Número |
|---|---|
| Orden de trabajo con obra | Sí |
| Trabajo asignado en la agenda, con obra | Sí, de la misma serie |
| Cita sin obra (una visita, una reunión) | No |

Las dos primeras beben del **mismo contador**, porque las dos son trabajo que
alguien hace y ficha. Una cita sin obra no es trabajo de obra, y por eso no
lleva; si más adelante se le asigna una obra, coge número en ese momento.

---

## Por dentro

**Tablas**

| Tabla | Para qué |
|---|---|
| `service_types` | Los tipos del negocio y su letra. `name` nulo = uno de casa, se traduce con `t()`; con nombre = lo creó el negocio, se muestra tal cual. Se gestionan en **Configuración → Tipos de trabajo**: se crean con su letra, se les cambia el nombre, y no se borran si ya clasificaron trabajo — esos trabajos quedarían etiquetados con algo que ya no existe, y la letra sigue dentro de números emitidos. Los cinco de casa no se tocan: su nombre se traduce a los cuatro idiomas. |
| `numero_counters` | Un contador por negocio y serie (`'2026'`, `'proyecto'`). |
| `projects.code` | La letra de la obra. |
| `work_orders.commessa`, `schedule_events.commessa` | El número del trabajo. |

**Funciones y disparadores** — el número se pone en la base, **no en las
rutas**. Una obra se crea desde tres sitios distintos y los trabajos desde
más; si esto viviera en el servidor, el día que alguien añada una cuarta vía
se crearía una fila sin número y no se notaría hasta que faltara en un
registro.

| Objeto | Qué hace |
|---|---|
| `siguiente_numero(negocio, serie)` | Devuelve el siguiente de esa serie. Es una sola sentencia, así que dos trabajos creados a la vez no pueden llevarse el mismo número. |
| `letras_de(n)` | 1→A, 26→Z, 27→AA. |
| `pon_codigo_obra()` | `before insert` en `projects`. |
| `pon_commessa()` | `before insert` en `work_orders` y `schedule_events`, y `before update of project_id` en `schedule_events`. |
| `siembra_tipos_de_servicio()` | `after insert` en `businesses`: un negocio nuevo nace con sus tipos y sus letras. |

A las cuatro funciones de disparador se les ha retirado el permiso `EXECUTE`
de `anon` y `authenticated`. Quedaban llamables por REST
(`/rest/v1/rpc/pon_commessa`) y con privilegios elevados; fuera de su
disparador fallarían —se apoyan en `NEW`—, pero una función con privilegios no
se deja abierta porque hoy no se sepa romper. Un disparador se ejecuta igual:
no pasa por el `EXECUTE` de quien provoca el INSERT.

`numero_counters` tiene RLS activado **sin ninguna política**, y es
deliberado: eso deniega todo salvo a la clave de servicio y a la función
`siguiente_numero`, que es exactamente quién debe tocarlo. El analizador de
Supabase lo marca como aviso informativo; no es un descuido.

**Rutas**

| Ruta | Devuelve |
|---|---|
| `GET /api/work-log` | Una línea por número, con horas, personas y cuántas horas quedan por aprobar. |
| `GET /api/work-log/:commessa` | El detalle: cada fichaje con su gente, su duración y dónde se pulsó el botón. |
| `GET /api/service-types` | Los tipos del negocio con su letra (panel). |
| `GET /api/worker/service-types` | Lo mismo para la app del trabajador. |

Las horas se suman en memoria a partir de `time_entries`. Cabe de sobra para
los fichajes de un negocio; el día que no quepa, esto pide un agregado en SQL
y no un remiendo en la ruta.

---

## Qué suele salir mal

**Un trabajo no aparece en la lista.** O no tiene obra asignada (y entonces no
tiene número, a propósito), o la obra se creó antes de que existieran los
códigos y se quedó sin letra. Lo segundo no debería pasar: el relleno inicial
le puso letra a todas las obras que había.

**Las horas salen a cero en un trabajo que sí se hizo.** El fichaje se hizo
sobre la obra a secas, sin elegir el trabajo. Esas horas existen y salen en
Check-in, pero no se le cargan a ningún número: no sería honrado atribuirlas a
un trabajo que nadie eligió. Para que cuenten, el trabajador tiene que fichar
eligiendo el trabajo del día.

**El tipo aparece como "Sin especificar" y la letra es `x`.** Nadie clasificó
ese trabajo al crearlo ni al ficharlo. El número es válido; lo que falta es el
dato.
