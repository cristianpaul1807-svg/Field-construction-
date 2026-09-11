# El selector de obra

**Dónde:** dentro de cada pantalla que filtra, justo encima de los datos.

Elegir una obra ahí filtra el panel entero a esa obra. Sin elegir nada pone
**General**, que es ver el negocio completo — y es lo que hay por defecto.

---

## Por qué no está en la cabecera

Vivía arriba a la derecha, pequeño y lejos de las listas. Tres problemas:

1. **No se veía.** Quien dejaba una obra elegida un martes, el jueves abría
   Facturación, veía tres facturas donde hay veinte y creía que se habían
   perdido. Un filtro que no se ve no se distingue de un fallo.
2. **Ocupaba sitio del menú.** Se reservaba 270 px en la barra, que es
   justamente lo que le faltaba a las secciones para caber en un portátil.
3. **Aparecía en pantallas que no filtran.** En Nóminas o en Materiales no
   hacía nada, y un control que a veces no hace nada enseña a ignorarlo.

Ahora está dentro de cada pantalla que filtra, encima de los datos que filtra.
No hay estado escondido: lo que se ve y por qué se leen de un vistazo. Y donde
no filtra, no está.

## Una sola obra elegida, no una por pantalla

El control está repetido, la elección no. Se elige una obra en Facturación, se
pasa a Fichajes y a Control de trabajo, y sigue puesta. Quien pasa la mañana
con una obra no tiene que elegirla nueve veces.

Se guarda en el navegador, así que sobrevive a recargar. Si esa obra deja de
existir, la selección se cae sola a General.

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
| CRM › Contactos | **No**, y por eso esa pestaña no lleva selector. Un cliente no es de una obra; suele tener varias, y los que todavía no son nada no tienen ninguna |
| Presupuestos | **No.** Un presupuesto existe *antes* que la obra. Filtrarlos por obra escondería justo los que están sin aceptar, que son los que hay que perseguir |
| Materiales, Nóminas, Técnicos, Subcontratistas, Informes | **No.** No son datos de una obra: el catálogo, las personas y los agregados del negocio son transversales |

---

## Que se vea que hay filtro

Con una obra elegida, el propio selector se marca —borde de color y el nombre
en negrita— y aparece un **Ver todo** al lado. No hace falta un aviso aparte:
el control está encima de la lista y dice lo que está pasando.

Con más de ocho obras, el desplegable trae buscador. Ignora los acentos, como
el resto de buscadores del panel.

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

`client/src/components/SelectorDeObra.tsx` es el control. Se pone en la
pantalla y ya: lee y escribe la misma selección compartida, así que no hay
nada que pasarle ni que sincronizar entre pantallas.

La obra elegida vive en `SelectedProjectContext`.

**El filtrado es del lado del cliente** en todas las pantallas menos gastos,
donde la ruta ya aceptaba `?projectId=`. Con los volúmenes de un contratista
cabe de sobra; el día que una lista no quepa en una respuesta, eso pide
paginación en el servidor y el filtro se va con ella.

---

## Qué suele salir mal

**"Faltan datos."** Mira el selector de arriba de la lista: casi siempre hay
una obra elegida de otro día, y se nota porque el control está marcado. *Ver
todo* lo devuelve.

**Una fila sin obra no sale nunca con filtro puesto.** Es correcto: una cita
suelta sin obra, o una factura sin proyecto, no son de ninguna obra. Aparecen
en General.
