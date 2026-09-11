# Las tablas del negocio

**Menú:** CRM · **Ruta:** `/crm`

El CRM tiene cinco pestañas. La primera es la de siempre —los contactos, donde
se trabaja—; las otras cuatro son el negocio entero en filas y columnas, para
mirarlo como se mira una hoja de cálculo.

| Pestaña | Qué hay | De dónde sale |
|---|---|---|
| Contactos | Leads y clientes, con su estado | `/api/clients` |
| Obras | Cada obra con su letra, presupuesto, gastado y equipo | `/api/projects` |
| Nº de obra | Cada trabajo numerado: quién, cuándo, horas, personas | `/api/work-log` |
| Facturas | Cada factura con su número, impuestos y retención | `/api/invoices` |
| Fichajes | Cada turno: trabajador, número de obra, entrada, salida, horas | `/api/time-entries` |

No son datos nuevos ni consultas nuevas: leen lo mismo que las pantallas de
trabajo. La diferencia es para qué sirven. La pantalla de Órdenes de trabajo es
para *hacer* — crear, programar, cerrar. Estas son para *mirar y contar*.

---

## Lo que se puede hacer en cualquiera de ellas

**Ordenar** por cualquier columna. Un clic ordena de menos a más, otro al
revés, y el tercero quita el orden. Lo vacío va siempre al final: una fila sin
dato no es "la más pequeña", es una fila a la que le falta algo.

**Buscar** en todo lo que se ve. Ignora los acentos, así que "gagne" encuentra
a Gagné — media plantilla de Quebec tiene acento en el apellido y nadie los
escribe al buscar.

**Elegir columnas.** Algunas nacen escondidas para que la tabla entre en
pantalla (el equipo de una obra, la retención de una factura, el título del
trabajo en un fichaje). Se encienden desde **Columnas**. La última no se puede
apagar: una tabla sin columnas no enseña nada.

**Totales.** Las columnas de dinero y de horas suman en el pie, y el total es
**de lo que se está viendo**: si buscas un cliente, el total es el de ese
cliente. Las personas no suman, porque el mismo trabajador en dos trabajos no
son dos personas.

**Exportar** a CSV.

---

## Sobre el archivo que sale

Está pensado para abrirse en Excel sin tener que arreglar nada:

- **Separado por `;`**, no por comas. Excel en español y en francés abre por
  columnas con punto y coma; con comas mete toda la fila en una celda.
- **Con BOM.** Es lo que hace que Excel lea el archivo como UTF-8. Sin él,
  "Gagné" se abre como "GagnÃ©" y parece que el dato está mal guardado.
- **Fechas en AAAA-MM-DD.** En ISO con hora y zona (`2026-09-10T12:00:00Z`)
  Excel las mete como texto y no se pueden ordenar ni filtrar.
- **Decimales en el idioma de quien exporta.** Un Excel en francés lee "14.5"
  como texto y deja de sumar la columna; en ese idioma el archivo sale con
  "14,5". Sin separador de millares, por la misma razón.
- El nombre lleva la fecha: `commessas-2026-09-11.csv`.

Se exporta **lo que se está viendo**: con el filtro puesto y con las columnas
encendidas en ese momento.

---

## Por dentro

`client/src/components/TablaDatos.tsx` es la tabla, y es una sola para las
cuatro. Lo que cambia de una pestaña a otra son las columnas; el orden, la
búsqueda, los totales y la exportación son los mismos. Si viviera dentro de
cada pantalla, cada tabla acabaría ordenando distinto y alineando los números
al lado contrario.

Una columna se declara así:

```ts
{ id: "horas", cabecera: t("tabla.col.horas"), tipo: "horas", sumable: true, valor: (c) => c.horas }
```

- `valor` devuelve el dato **en crudo**. De ahí salen el orden, la búsqueda y
  el CSV — nunca de lo que se ve en pantalla.
- `pintar` es opcional y sólo cambia lo que se ve (una etiqueta de estado, un
  porcentaje). El CSV sigue llevando el `valor`.
- `tipo` decide tres cosas a la vez: cómo se pinta, cómo se ordena (por número
  o por texto) y si se alinea a la derecha.

`client/src/components/crm/TablasDelNegocio.tsx` declara las cuatro tablas.
Añadir una quinta es declarar sus columnas y una pestaña más.

---

## Qué suele salir mal

**Un fichaje sin número de obra.** El trabajador fichó sobre la obra a secas
sin elegir el trabajo del día. La fila está y las horas cuentan, pero no se le
cargan a ningún número.

**Una obra sin letra.** No debería pasar: la letra se pone al crear la obra
desde la base. Si aparece vacía, la fila se creó saltándose el disparador.

**El total no cuadra con el de Facturación.** Mira el buscador: el total de la
tabla es el de las filas visibles, no el de todas.
