# Materiales y costos

**Dónde:** menú → Proyectos → Materiales y costos
**Código:** `client/src/pages/Materials.tsx` · Rutas: `/api/materials`,
`/api/labor-rates`

---

## Para qué sirve

Es tu catálogo de precios: la columna vertebral de cada presupuesto. Tres
cosas distintas viven en una sola tabla, porque para quien está presupuestando
son lo mismo — cuánto cuesta esta línea:

| Tipo | Precio | Se edita aquí |
|---|---|---|
| **Materiales** | por unidad | sí |
| **Mano de obra** | por hora | sí |
| **Subcontratistas** | se cotiza por proyecto | no, se editan en su pantalla |

Mantenerlo al día es lo que hace que un presupuesto salga en minutos en vez de
en una tarde.

---

## Paso a paso

### Añadir un material

1. **Nuevo material**.
2. **Nombre**: cómo lo llamas tú ("Placa de yeso 4x8"). **Es lo único
   obligatorio.**
3. **Unidad**: unidad, m², saco, caja — como lo compres. Déjala vacía si
   todavía no lo sabes.
4. **Precio**: lo que te cuesta. Déjalo vacío si es solo referencia.
5. **Categoría** y **Proveedor**, opcionales pero útiles para buscar.
6. **Descripción**: lo que sale en la línea del presupuesto, que es lo que lee
   tu cliente.
7. **Código del proveedor (SKU)**: sirve para casar este material con el mismo
   artículo en tu contabilidad. Vacío si no usas códigos.
8. **Guardar**.

Un material sin precio aparece marcado como *Solo referencia*, y uno sin
unidad dice *Por definir*. Ninguno de los dos suma en un presupuesto hasta
que se completa.

### Un catálogo que llega entero y sin precios

Es el caso normal cuando el catálogo viene de un archivo del proveedor o del
contable: cientos de artículos con su nombre, su categoría y su código, y sin
un solo precio.

Eso se carga tal cual **a propósito**, y las dos casillas vacías son la
decisión, no un descuido:

- **El precio vacío** es *Solo referencia*. Un `0` significaría «gratis», que
  es mentira y encima una mentira que suma.
- **La unidad vacía** es *Por definir*. Inventarle «saco» a algo que se vende
  por m³ no da error: hace que alguien le ponga precio al saco y que el
  presupuesto salga mal **sin que nada avise**. Ése es el fallo que no se
  puede dejar puesto.

Arriba de la lista sale un botón **«Faltan N por completar»** que deja sólo
esas filas. La forma de usarlo es no intentar completarlo entero: se rellenan
los veinte o treinta que se usan cada semana, y el resto se va completando la
primera vez que se necesita. Un catálogo de trescientas filas vacías se
abandona; uno de veinticinco que funcionan se usa todos los días.

### Añadir una tarifa de mano de obra

1. **Nueva tarifa**.
2. Nombre del oficio ("Carpintero", "Ayudante").
3. Tarifa por hora.
4. **Guardar**.

Esta tarifa es la que se usa al calcular la mano de obra de cada partida y de
cada plantilla.

### Editar o borrar

El lápiz y la papelera al final de cada fila. Borrar pide confirmación.

Los subcontratistas no tienen esos botones aquí: se gestionan en
**Campo → Subcontratistas** ([guía](equipo.md#subcontratistas)).

### Buscar

El buscador filtra por nombre sobre los tres tipos a la vez.

---

## Cuándo actualizar precios

Los precios de construcción se mueven. Dos momentos en que conviene revisarlos:

- **Antes de presupuestar una obra grande.** Un presupuesto con precios de
  hace ocho meses es un presupuesto que pierde dinero.
- **Cuando cambias de proveedor.** Actualiza precio y proveedor a la vez.

Cambiar un precio aquí **no** toca los presupuestos ya hechos. Solo afecta a
las líneas y plantillas que insertes a partir de ahora — que es lo correcto:
un presupuesto enviado es un compromiso a un precio.

---

## Relación con las plantillas

Una plantilla apunta a **filas de este catálogo**, no a copias de sus precios.
Por eso, al insertar una plantilla en un presupuesto, sale con los precios de
hoy. Ver [presupuestos.md](presupuestos.md#plantillas-de-presupuesto).

Si borras un material que una plantilla usa, esa línea de la plantilla deja de
tener a qué apuntar. Revisa las plantillas después de una limpieza grande del
catálogo.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/materials` | Devuelve las tres listas de una vez |
| `POST · PATCH · DELETE /api/materials[/:id]` | Materiales |
| `POST · PATCH · DELETE /api/labor-rates[/:id]` | Tarifas |

Tablas: `materials_catalog`, `labor_rates`, `subcontractors`.

`price` puede ser `null` — eso es lo que significa "solo referencia", y por eso
la columna no tiene `not null`. Un precio de `0` sería otra cosa: gratis.

`unit` puede ser `null` por la misma razón, y dejó de ser obligatoria el día
que el catálogo pasó a poder nacer de un archivo del proveedor. Una unidad
inventada no falla: hace que el presupuesto salga mal en silencio.

`sku` es el código del proveedor y lo único que enlaza un material con el mismo
artículo en la contabilidad del negocio. Tiene índice único por negocio
(`materials_catalog_business_sku_idx`, parcial sobre `sku is not null`), que es
lo que permite **volver a importar el mismo archivo sin duplicar nada**: la
carga va con `on conflict … do update`.

`description` es la que sale en la línea del presupuesto. `name` es corto para
buscar; `description` es lo que lee el cliente.
