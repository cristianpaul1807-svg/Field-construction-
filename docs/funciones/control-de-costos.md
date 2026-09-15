# Control de costos y rentabilidad

**Dónde:** menú → Proyectos → Control de costos
**Código:** `client/src/pages/CostTracking.tsx` · Rutas: `/api/cost-tracking`,
`/api/expenses`

---

## Para qué sirve

Responde a la única pregunta que importa a mitad de obra: **¿voy ganando o
perdiendo dinero en esto?**

Compara, categoría a categoría, lo que presupuestaste contra lo que llevas
gastado de verdad, y te enseña la desviación en porcentaje.

Requiere tener un proyecto seleccionado en el selector de la barra superior.

---

## Cómo leerlo

| Columna | Qué es |
|---|---|
| Presupuestado | Lo que dice el presupuesto vinculado, por categoría |
| Actual | Lo que llevas gastado de verdad |
| Desviación | Cuánto te pasas o te ahorras, en % |

En **rojo** te has pasado. En **verde** vas por debajo. Un guion significa que
no había presupuesto en esa categoría contra el que comparar — normal en
gastos que no estaban previstos, como un permiso.

Si el proyecto tiene **órdenes de cambio aprobadas**, aparecen como una fila
propia y se suman al presupuesto total. Sin eso, cualquier obra con extras
parecería pasada de presupuesto cuando no lo está.

---

## Registrar un gasto

1. Con el proyecto seleccionado, pulsa **Registrar gasto**.
2. **Categoría**: materiales, mano de obra, subcontratistas, equipos y
   alquiler, permisos y tasas, u otros.
3. **Monto** y **fecha**.
4. **Descripción**: dónde y qué ("Compra de placas en RONA"). Te lo
   agradecerás dentro de tres meses.
5. **Guardar**.

Aparece inmediatamente en la comparación y en la lista de abajo, de donde
puedes borrarlo con la papelera.

### Elegir bien la categoría

Es lo que hace que el gasto se compare contra la partida correcta. Las tres
primeras (materiales, mano de obra, subcontratistas) son las mismas en las que
se divide el presupuesto. Las otras tres no suelen estar presupuestadas y
aparecen como filas de solo gasto real.

---

## Una nota sobre cómo se comparan las categorías

Los gastos guardan la categoría como slug (`mano_obra`) y las partidas del
presupuesto como nombre (`Mano de obra`). Durante un tiempo el sistema
comparaba las dos cadenas directamente — así que **ningún** gasto encajaba
nunca, y todos los proyectos salían perfectamente dentro de presupuesto sin
que nada avisara.

Ahora los dos lados se normalizan a una clave canónica antes de compararse
(función `canonical()` en la ruta `/cost-tracking`). Si algún día añades una
categoría nueva, añádela también ahí, o volverá a caer en "otros".

---

## Qué hacer con lo que ves

- **Una categoría en rojo a mitad de obra** no se arregla sola. Mira si fue
  una compra puntual o si el precio unitario del presupuesto estaba mal — eso
  segundo se corrige en [Materiales](materiales.md) para las próximas.
- **Trabajo extra que el cliente pidió** no es un sobrecoste tuyo: es una
  [orden de cambio](proyectos.md#órdenes-de-cambio) que se te olvidó escribir.
- **Todo en verde y muy holgado** suele significar que faltan gastos por
  registrar, no que vayas fenomenal.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/cost-tracking` | Presupuestado vs. real por proyecto y categoría |
| `GET /api/expenses?projectId=…` | Los gastos de un proyecto |
| `POST /api/expenses` | Registrar |
| `DELETE /api/expenses/:id` | Borrar |

Tabla: `expenses`. El presupuesto sale de `estimate_lines` del presupuesto
vinculado al proyecto, más las `change_orders` en estado `aprobado`.

---

## Gastado, previsto y lo que queda

Cinco columnas por obra: **presupuestado**, **gastado**, **previsto**, **queda**
y el desvío.

**Un gasto con fecha futura no es dinero salido.** Antes se sumaba todo junto,
así que un pedido de material para dentro de dos semanas contaba como gastado
hoy y la obra se leía pasada de presupuesto por un dinero que seguía en el
banco. Al revés también dolía: lo comprometido desaparecía del cálculo de lo que
queda, que es justo la cifra por la que se decide si cabe un extra.

Ahora la fecha decide en qué columna cae, y cuando llega el día el gasto pasa
solo de previsto a gastado. Sin ningún proceso: se compara la fecha al leer.

```
queda  = presupuestado − gastado − previsto
desvío = (gastado + previsto − presupuestado) / presupuestado
```

El desvío mide contra lo comprometido, no sólo contra lo pagado: si el dinero ya
está prometido, la obra está pasada aunque el pago sea el mes que viene.

**Las horas fichadas caen siempre en gastado**, y es correcto: se ficha al
trabajar, así que no hay fichaje de mañana.

## Corregir un gasto

El lápiz de su fila. `PATCH /api/expenses/:id` con categoría, descripción,
importe o fecha.

Faltaba, y lo único que quedaba era borrar y volver a escribirlo — que **no es
lo mismo**: un gasto ya mandado a QuickBooks deja allí su compra, y borrar aquí
no la borra allí. Un dedazo en el importe acababa en dos compras en su
contabilidad, la mala y la buena.

**El enlace con QuickBooks se deja como está.** Reenviarlo crearía una segunda
compra; lo que hace falta es actualizar la que ya existe, y eso es trabajo
aparte. Mientras tanto la ayuda lo dice en vez de fingir que los dos lados
coinciden.
