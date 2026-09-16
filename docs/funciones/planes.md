# Planes: qué puede hacer cada negocio

Los permisos dicen **quién** dentro de una empresa ve qué. El plan dice **qué
puede hacer la empresa entera**. Son dos ejes distintos y viven en dos
archivos distintos a propósito: un jefe de obra sin acceso a los números y un
contratista que no ha contratado las nóminas ven la misma pantalla vacía por
razones que no tienen nada que ver, y el día que haya que cambiar una no se
puede estar tocando la otra.

- Quién ve qué → [permisos.md](permisos.md) y `shared/permisos.ts`
- Qué está contratado → este documento y `shared/planes.ts`

---

## Los planes

| Plan | Qué es |
|---|---|
| `prueba` | 30 días, con todo abierto |
| `chantier` | Campo y facturación. Hasta 2 personas de oficina |
| `entreprise` | Todo. Personas de oficina sin tope |
| `fondateur` | Todo. **Se asigna, no se compra**: no hay suscripción detrás |
| `pilot` | Lo que tienen los negocios de antes de que existieran los planes |

Vive en `businesses.subscription_plan`, que nace con `pilot`.

### La prueba va entera, sin recortes

Los 30 días no se recortan. Una prueba recortada no prueba nada, y el
contratista decide justo en lo que le habríamos escondido: el cierre de mes, la
nómina, el informe de la CCQ.

### `fondateur` no pasa por Stripe

El estado del plan vive en nuestra base, y Stripe sólo lo actualiza cuando hay
un pago — nunca al revés. Si el plan se leyera de la suscripción, una empresa
sin suscripción se quedaría fuera de su propio sistema, y meter cuentas sin
suscripción después es reescribir la facturación entera.

---

## Las capacidades

Se corta por **capacidades enteras**, nunca por funciones sueltas. Quitar media
pantalla deja un producto que parece roto; quitar «las nóminas» se entiende sin
explicación.

| Capacidad | Qué abre | Chantier |
|---|---|---|
| `campo` | Obras, órdenes de trabajo, agenda, fichaje, fotos | sí |
| `facturacion` | Clientes, portal, presupuestos, facturas, cobros | sí |
| `nomina` | Nóminas y T4 | no |
| `cumplimiento` | El informe mensual de la CCQ | no |
| `margen` | Control de costos y beneficio por obra | no |
| `contabilidad` | QuickBooks y las exportaciones | no |
| `reportes` | Cuentas por cobrar, rentabilidad, dinero en Stripe | no |
| `equipo` | Personas de oficina con acceso limitado a unas áreas | no |

### Dos cosas que no se venden nunca

**El doble factor.** Cobrar por él es cobrar por no tener un agujero.

**Los trabajadores de campo.** Entran por su código en `/campo`, no pisan el
panel y son ilimitados en todos los planes. Cobrar por cabeza castiga justo lo
que necesitamos que pase —que el contratista meta a su cuadrilla— y sin
fichajes el sistema no sabe si una obra gana dinero, que es su razón de
existir.

Ninguna de las dos aparece en `CAPACIDADES`, y ése es el sitio donde se nota
que la decisión está tomada.

---

## Las dos reglas del bloqueo

**Lo que no reconocemos, abre.** Un `null`, una palabra vieja o `pilot` lo ven
todo. Cerrar lo que no se entiende dejaría a un contratista sin sus nóminas un
lunes por la mañana por un dato raro en una fila.

**Lo que no está en el mapa, pasa.** Al revés que en `permisos.ts`, donde la
familia de rutas sin clasificar **se niega**. La diferencia es deliberada: allí
el riesgo es enseñarle a alguien lo que no debe ver, y aquí es apagarle a un
contratista una pantalla que sí pagó.

---

## Por dentro

**Servidor** — un solo middleware en `server/api.ts`, justo detrás del de
permisos. Contesta **402** con `code: "plan_no_incluye"`, distinto del 403 de
permisos, para que la pantalla pueda ofrecer subir de plan en vez de un cartel
de prohibido.

**Cliente** — `plan` viaja en `/auth/me` igual que las áreas. El menú esconde
lo que el plan no incluye (`DashboardLayout`), y quien escriba la dirección a
mano se encuentra `SinPlan` en vez de una pantalla en blanco. Es comodidad, no
seguridad: el bloqueo de verdad está en el servidor.

**`SinPlan` no es un error.** La pantalla existe, funciona, y no está
contratada. Dice qué hace esa parte, en qué plan está y cuánto cuesta, y
ofrece lo único que funciona hoy: escribirnos. Cuando exista la pantalla de
suscripción, ahí va el botón que lleva a ella — **hasta entonces no se pone un
botón que no lleva a ningún sitio**.

### Lo que se cobra tiene que ser una pantalla entera

`agreements` y `worker-documents` estaban en `nomina` en el primer mapa, y era
un fallo: viven **dentro** de la ficha del técnico, que es de campo y la tienen
todos los planes. Un Chantier abría una ficha suya y se encontraba un error a
media pantalla.

Y aunque se pudieran separar, no habría que hacerlo. Un contratista contrata
gente aunque no nos compre la nómina, y sus contratos son suyos. Lo que cobra
cada persona ya lo tapan los permisos por áreas, que es donde toca.

**La regla que queda:** antes de meter una familia de rutas en `CAPACIDAD_DE`,
mira desde qué pantalla se llama. Si esa pantalla entra en todos los planes, la
ruta también.

Por si acaso, `serverErrors.plan_no_incluye` existe en los cuatro idiomas: si
alguna llamada se escapa, el que la vea lee una frase y no un error crudo.

---

## Los precios

Están en `PRECIO`, en `shared/planes.ts`, y en ningún otro sitio. Son
**provisionales** hasta saber qué cubren los 200 $ por semana que un
contratista de Quebec paga hoy por la nómina y la CCQ: si resulta que es sólo
eso, `entreprise` se queda corto y sube.

Subirlo antes del primer cliente es gratis. Subírselo a quien ya entró no se
hace nunca.

---

## Comprobarlo

```bash
node --experimental-strip-types scripts/prueba-planes/capacidades.mjs
```

41 comprobaciones: lo que abre cada plan, que ningún valor raro cierre nada,
qué capacidad pide cada ruta, y que lo que vive dentro de una pantalla común no
se cobre aparte.
