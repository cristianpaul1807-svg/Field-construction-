# El selector de obra

**Dónde:** arriba a la derecha, en la cabecera, en todas las pantallas del panel.

Elegir una obra ahí filtra el panel entero a esa obra. Sin elegir nada pone
**General**, que es ver el negocio completo — y es lo que hay por defecto.

---

## General no es "sin elegir"

Antes ponía *"Selecciona un proyecto"*, y eso se leía como un paso pendiente:
parecía que el panel no funcionaba hasta elegir algo. Tres pantallas
(contratos, fotos, control de costos) llegaban a **exigirlo**: sin obra
elegida no enseñaban nada y mandaban a elegir una.

Eso era pedirle al jefe que supiera de antemano dónde está lo que viene a
buscar. Ahora General es una opción por derecho propio, la primera de la
lista y la de arranque.

---

## Qué se filtra y qué no

| Pantalla | Filtra |
|---|---|
| Proyectos | Sí — deja la obra elegida |
| Facturación | Sí, y las sumas de arriba cuentan lo mismo que la tabla |
| Fichajes | Sí |
| Órdenes de trabajo | Sí |
| Control de trabajo | Sí |
| Agenda | Sí (ya lo hacía) |
| Contratos y documentos | Sí |
| Galería de fotos | Sí |
| Control de costos | Sí — en General, una tabla por obra |
| CRM › Obras, Nº de obra, Facturas, Fichajes | Sí |
| CRM › Contactos | **No.** Un cliente no es de una obra; suele tener varias, y las que todavía no son nada no tienen ninguna |
| Presupuestos | **No.** Un presupuesto existe *antes* que la obra. Filtrarlos por obra escondería justo los que están sin aceptar, que son los que hay que perseguir |
| Materiales, Nóminas, Técnicos, Subcontratistas, Informes | **No.** No son datos de una obra: el catálogo, las personas y los agregados del negocio son transversales |

---

## Que se vea que hay filtro

Cada pantalla filtrada enseña un aviso mientras haya una obra elegida:

> 📁 Filtrado por obra: **426 boulevard Saint Josef** · ✕ Ver todo

No es decoración. El selector vive en la cabecera, pequeño y lejos de la
lista; quien deja una obra elegida y al día siguiente abre Facturación ve tres
facturas donde hay veinte y piensa que se han perdido. **Un filtro que no se
ve es indistinguible de un fallo.** En General no se pinta nada, porque no hay
nada que avisar.

Donde crear algo necesita saber a qué obra va —subir una foto, subir un
documento, anotar un gasto—, en General el botón no está, y en su sitio se
dice por qué y qué hacer para tenerlo.

---

## Por dentro

`client/src/lib/filtroDeObra.ts` tiene la regla, una sola vez:

```ts
const { filtrar } = useFiltroDeObra();
const visibles = filtrar(facturas, (f) => f.projectId);
```

Sin obra elegida devuelve la lista entera. Está en un sitio y no repetido en
cada pantalla porque la regla tiene que ser idéntica en las catorce: una
pantalla que filtrara al revés, o que exigiera elegir, convertiría el selector
en algo en lo que no se puede confiar.

`client/src/components/FiltradoPorObra.tsx` es el aviso, y no pinta nada
cuando no hay filtro.

La obra elegida vive en `SelectedProjectContext` y se guarda en el navegador,
así que sobrevive a recargar la página. Si esa obra deja de existir, la
selección se cae sola a General.

**El filtrado es del lado del cliente** en todas las pantallas menos gastos,
donde la ruta ya aceptaba `?projectId=`. Con los volúmenes de un contratista
cabe de sobra; el día que una lista no quepa en una respuesta, eso pide
paginación en el servidor y el filtro se va con ella.

---

## Qué suele salir mal

**"Faltan datos."** Mira el aviso de arriba de la lista: casi siempre hay una
obra elegida de otro día. *Ver todo* lo devuelve.

**Una fila sin obra no sale nunca con filtro puesto.** Es correcto: una cita
suelta sin obra, o una factura sin proyecto, no son de ninguna obra. Aparecen
en General.
