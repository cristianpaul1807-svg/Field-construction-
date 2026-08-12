# Presupuestos

**Dónde:** menú → Proyectos → Presupuestos
**Código:** `client/src/pages/Budgets.tsx`,
`client/src/components/AssemblyTemplateDialog.tsx`,
`client/src/components/WorkProjectionPanel.tsx`

---

## Para qué sirve

Es donde se decide si una obra gana o pierde dinero. El presupuesto se
construye con una jerarquía **Zona → Categoría → Ítem**, se le aplican merma y
margen, y sale un PDF que el cliente firma.

---

## Crear un presupuesto

**Desde una solicitud del chat público** — lo normal. La pestaña
*Solicitudes y presupuestos* lista lo que ha entrado por tu enlace. El
borrador ya viene con el cliente, la descripción y la dirección cargados.
Ábrelo y empieza a poner líneas.

**Desde cero**

1. **Nuevo presupuesto**.
2. Elige el cliente. El proyecto y la categoría son opcionales.
3. **Crear presupuesto**.

---

## Poner líneas

Cada línea vive en una **zona** (Cocina, Baño 2, Exterior…) y una
**categoría** (Materiales, Mano de obra, Subcontratistas).

1. En *Agregar línea*: escribe la zona, elige la categoría, escribe el ítem,
   la cantidad y el costo unitario.
2. **Agregar**.

Para editar una línea, escribe encima. **Se guarda al salir del campo**, no
hay botón de guardar por línea.

### La casilla de visibilidad

Junto a cada línea hay una casilla que decide si el cliente la ve en su
portal y en el PDF.

Esto es más importante de lo que parece. Te deja desglosar tu coste real para
ti — tres tipos de tornillo, las horas del ayudante — y mostrarle al cliente
una línea limpia. El precio no cambia; cambia cuánto detalle enseñas.

---

## Merma y margen

En el panel de la derecha:

- **Merma (%)**: material que se pierde en el corte, roturas y sobrantes.
- **Margen (%)**: lo que ganas.
- **Tipo de margen**: global (uno para todo) o por sección (ajustable zona a
  zona).

El cálculo, en este orden:

```
subtotal      = suma de (cantidad × costo unitario)
merma         = subtotal × %merma
margen        = (subtotal + merma) × %margen
total         = subtotal + merma + margen
```

Los valores por defecto salen de **Configuración → Márgenes y reglas**, y se
pueden cambiar presupuesto a presupuesto.

**En el PDF del cliente, merma y margen no aparecen como líneas.** Son tu
aritmética, no algo que el cliente tenga que leer: van repartidos dentro de
cada precio unitario. Lo que él ve es el precio, y luego los impuestos.

---

## Plantillas de presupuesto

**Dónde:** pestaña *Plantillas*

Una plantilla es una receta reutilizable: "baño completo 5x8" con sus
materiales, sus horas y sus subcontratos ya dentro. Presupuestar el mismo
trabajo por décima vez deja de empezar de cero.

**Crear una**

1. **Nueva plantilla**.
2. Nombre y descripción.
3. **Agregar línea** por cada componente: elige del catálogo (material, tarifa
   de mano de obra o subcontratista) y pon la cantidad.
4. Mientras la montas, ves el **costo estimado de la receta**.
5. **Guardar**.

**Usarla**

1. Con un presupuesto abierto, ve a *Plantillas*.
2. **Insertar en presupuesto** en la que quieras.
3. Di a qué zona va ("Baño 2").

Se insertan todas sus líneas en esa zona, con los precios **actuales** de tu
catálogo. Si subiste el precio del gypse el mes pasado, la plantilla lo
refleja.

**Editarla:** el botón *Editar* de cada tarjeta. Al guardar, sus ítems se
reemplazan por completo — se edita como un objeto entero, no como un diff.
Cambiar una plantilla **no** toca los presupuestos donde ya la insertaste.

---

## Proyección de trabajo

Debajo del presupuesto puedes anclar trabajadores a momentos concretos:
"Marc, drywall planta 2, martes, 6 horas".

Mientras el presupuesto no esté aceptado, esto es solo un plan. **En el
momento en que se acepta, todos esos elementos se vuelcan en el calendario
del proyecto** — no hay que repetir la planificación a mano.

---

## Estados

| Estado | Qué significa |
|---|---|
| `borrador` | Lo estás montando. El cliente no lo ve |
| `pendiente_aprobacion` | Lo redactó el bot y espera tu revisión |
| `enviado` | Se lo mandaste. **Solo desde aquí puede aceptarlo** |
| `aceptado` | Hay obra |
| `rechazado` | No salió |

*Aprobar y marcar como enviado* pasa de borrador a enviado. Hasta entonces, el
botón de aceptar en el portal del cliente está desactivado, y la ruta lo
rechaza con un 409 aunque alguien la llame directamente.

Al aceptarse: se crea o se vincula el proyecto, se vuelca la proyección al
calendario, y si el cliente no tenía cuenta, se le crea una.

---

## El PDF

**Generar PDF** → vista previa → **Descargar PDF**. Sale en el idioma en que
tengas el panel. Ver [documentos-pdf.md](documentos-pdf.md).

---

## Categorías y documentos de referencia

**Dónde:** pestaña *Categorías y referencias*

Define las categorías de tu negocio (cocina, reforma, techos…). Cada
presupuesto se etiqueta con una, y por cada categoría puedes subir hasta 5
presupuestos antiguos aprobados como referencia de márgenes y estructura.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/estimates` · `/:id` | Lista y detalle |
| `POST /api/estimates` | Crear |
| `PATCH /api/estimates/:id` | Margen, merma, tipo |
| `POST /api/estimates/:id/lines` | Añadir línea |
| `PATCH · DELETE /api/estimates/:id/lines/:lineId` | Editar y borrar |
| `POST /api/estimates/:id/lines/from-template` | Insertar plantilla |
| `PATCH /api/estimates/:id/status` | Cambiar estado |
| `POST /api/estimates/:id/accept` | Aceptar (crea proyecto y calendario) |
| `GET /api/estimates/:id/pdf` | El PDF |
| `GET · POST · PATCH · DELETE /api/assembly-templates` | Plantillas |
| `GET · POST /api/estimates/:id/projection` | Proyección |

`estimates.total` se recalcula y se guarda tras cada cambio de línea, margen o
merma, con la misma fórmula que la vista previa. Si añades otra forma de
modificar un presupuesto, recalcula también, o el total guardado se queda
viejo sin que nadie se entere.
