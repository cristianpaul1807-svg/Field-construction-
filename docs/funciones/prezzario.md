# Prezzario regional (sólo Italia)

**Dónde:** menú → Proyectos → Materiales y costos → *Prezzario regionale*
(abajo), y en Presupuestos el botón **Del prezzario** al añadir una línea.
**Código:** `shared/prezzario.ts` (leer el archivo),
`client/src/components/PrezzarioRegionale.tsx`, `server/prezzarioServidor.ts`
(buscar). Rutas: `/api/prezzario…`

---

## Para qué sirve

Cada región italiana publica su **prezzario**: la lista oficial de precios de
obra. Cada voce tiene un código (`A03.01.001`), una descripción larga, una
unidad de medida (m², m³, kg, cad.) y un precio. Las obras públicas lo
exigen, y los bonus fiscales lo usan para dar por bueno un precio: un
presupuesto montado con sus voces se defiende solo ante el cliente, el
técnico y el banco.

Aquí se carga entero desde el archivo de la región y se busca en él al hacer
el presupuesto. Vive aparte del catálogo de Materiales: son miles de voces, y
mezcladas con los cuarenta materiales que el negocio usa de verdad, el
catálogo dejaría de servir.

---

## Cargar el prezzario

1. Descarga el de tu región en **Excel (.xlsx) o CSV**. Si sólo lo publica en
   PDF, ábrelo con Excel o pídeselo al técnico en hoja de cálculo: un PDF no
   se puede leer con garantías.
2. **Cargar archivo**. Se lee en el navegador; no se sube nada hasta que
   confirmas.
3. Se buscan solas la fila de cabecera (aunque tenga títulos encima) y las
   columnas del **código**, la **descripción**, la **unidad** y el **precio**.
   Revísalas: las primeras tres voces salen debajo para comprobarlo.
4. Ponle un **nombre** («Lazio 2025»). Es como se distingue de la edición del
   año que viene.
5. **Cargar N voces**. Va en tandas de mil, con el avance a la vista.

Dos costumbres de los prezzari que se respetan al leer:

- **Una fila con código y sin precio ni unidad es un capítulo** («A03 Scavi e
  rinterri»). No se guarda como voce —no se puede presupuestar—, pero su
  título acompaña a las voces de debajo.
- **Una fila sin código, sólo con texto, continúa la descripción de la voce
  de arriba**: la región partió una descripción larga en varias filas.

Los precios se leen como vengan: `12,50`, `1.234,56`, `€ 12,50` o el número
de Excel. Un texto que no es un precio («a corpo») queda **sin precio**, no
a cero: un cero sumaría como gratis.

Volver a cargar el mismo archivo con el mismo nombre **no duplica**: cada voce
se sustituye por su código. Así se corrige un archivo mal leído.

---

## Usarlo en un presupuesto

En Presupuestos, al añadir una línea, **Del prezzario** abre un buscador.
Cada palabra tiene que estar en la descripción o en el código: «intonaco
calce» encuentra el intonaco a base de calce aunque entre las dos palabras
haya diez. Elegir una voce **rellena el formulario**, no añade la línea: el
código, la descripción, la unidad y el precio vienen de la región; la zona y
la cantidad son de esta obra.

El PDF del presupuesto lleva el **código delante** de cada partida y la
**cantidad con su unidad** («12,5 m²»), como un computo metrico. Los SAL
miden sobre esas mismas partidas.

> **Los precios del prezzario ya incluyen gastos generales y beneficio de
> empresa** (normalmente 15 % + 10 %). Si los usas tal cual, deja el margen
> del presupuesto en 0 o aplica tu descuento (*ribasso*): si no, los cobras
> dos veces. La pantalla lo recuerda en los dos sitios.

Borrar un prezzario no toca los presupuestos hechos: cada línea guardó su
copia del código, la unidad y el precio el día que se añadió.

---

## Por voz (MCP)

`get_price_list_items` busca en los prezzari cargados y devuelve código,
descripción, unidad y precio. `draft_estimate` acepta `unit` y `code` en cada
línea, así que «prepárame un presupuesto de intonaco para 80 m² con el
prezzario del Lazio» sale con las voces oficiales, como borrador y con
confirmación (ver [mcp-trabajadores.md](../desarrollo/mcp-trabajadores.md)).

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/prezzario` | Los prezzari cargados, con cuántas voces tiene cada uno |
| `GET /api/prezzario/voci?q=&fonte=` | Buscar (40 como mucho) |
| `POST /api/prezzario/import` | Una tanda de hasta 1.000 voces, con `upsert` por código |
| `DELETE /api/prezzario/fonte?fonte=` | Borrar un prezzario entero |

Tabla `prezzario_voci` (`business_id`, `fonte`, `codice`, `descrizione`,
`unita`, `prezzo`, `capitolo`), única por `(business_id, fonte, codice)`, con
RLS por negocio. `prezzario_fonti()` agrupa por fuente con la sesión de quien
pregunta.

**Sólo Italia, en las tres puertas** (ver
[paises.md](../desarrollo/paises.md)): la pantalla sólo aparece con
`paisDe(country).prezzario`; `/prezzario` está en `RUTAS_DEL_PAIS`; y el
trigger `private.exigir_italia_en_prezzario` rechaza cualquier voce de un
negocio de otro país. Borrar vale siempre.

Sin librería de Excel: un `.xlsx` es un zip con XML, y el navegador ya sabe
descomprimir (`DecompressionStream`). La librería conocida tiene fallos de
seguridad sin arreglar en npm. La prueba,
`scripts/prueba-italia/prezzario.mjs`, construye un Excel byte a byte con
títulos encima de la cabecera, textos compartidos, la portada en otra hoja y
una descripción partida, y comprueba también los CSV con punto y coma.

## La unidad y el código en todos los países

Las líneas de presupuesto (`estimate_lines.unit`, `estimate_lines.code`)
llevan unidad y código en cualquier país: al elegir un material del catálogo
llegan su unidad y su código de proveedor (SKU); una tarifa de mano de obra
llega en horas («h»). En Canadá no hay prezzario, pero un presupuesto de
«120 pi² de céramique» se lee mejor que uno de «120».
