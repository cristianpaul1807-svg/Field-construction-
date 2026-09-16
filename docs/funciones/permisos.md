# Quién ve qué

**Dónde:** menú → Configuración → Usuarios y roles
**Código:** `shared/permisos.ts` · `server/supabaseAuth.ts` · Comprobador: `scripts/check-permisos.py`

---

## Para qué sirve

Un contratista con un encargado de obras quiere darle acceso al terreno —obras,
órdenes, fichajes, su gente— **sin enseñarle lo que factura la empresa, lo que
gana, ni lo que cobra cada uno**.

---

## Antes esto no existía, aunque lo pareciera

Había una tabla `roles`, una columna `permissions` y una pantalla para asignar
roles. **Nadie los miraba:** ninguna ruta del servidor los comprobaba y el menú
los ignoraba. Se podía crear un rol «Jefe de obra», asignarlo, y esa persona
seguía viendo la facturación.

Un control que aparenta proteger y no protege es peor que no tenerlo, porque
nadie vuelve a comprobarlo.

---

## Las cinco áreas

| Área | Qué lleva |
|---|---|
| **campo** | Obras, órdenes, agenda, fichaje, GPS, ausencias, fotos, documentos, y quién es cada trabajador |
| **clientes** | CRM, portal del cliente, conversaciones, citas |
| **dinero** | Presupuestos, facturas, cobros, gastos, nóminas, reportes, costos, QuickBooks, Stripe, materiales y tarifas |
| **personas** | Los acuerdos de trabajo y los papeles de cada uno: su contrato, su T4 |
| **ajustes** | La configuración del negocio |

Son pocas a propósito. Un permiso por pantalla parece más fino y acaba en una
cuadrícula de cuarenta casillas que nadie configura bien, donde la pantalla
nueva del mes que viene nace sin marcar.

## Cómo se invita a alguien

Configuración → Usuarios y roles → **Invitar**. Se pide nombre, correo y
teléfono, y luego una sola decisión:

- **Administrador general** — ve y hace todo, igual que el dueño.
- **Sólo algunas partes** — y se marcan las áreas.

No hay lista de roles que elegir. Quien invita piensa en «lo ve todo» o «sólo
esto», no en el nombre de un papel; el rol lo arma el servidor por debajo,
reutilizando el que ya tenga esas mismas áreas para no llenar la tabla de filas
iguales. Por eso los roles se llaman `areas:campo+clientes`: son un detalle de
la base, no algo que nadie tenga que nombrar.

### Y sus credenciales

Hasta ahora invitar a alguien **creaba una fila y nada más**: no había cuenta,
no había contraseña, y esa persona no podía entrar de ninguna manera. El rol
que se le diera daba igual.

Ahora se le crea la cuenta y se genera una contraseña que **se enseña una sola
vez**, como el código de acceso de un trabajador. No se guarda en ninguna tabla
nuestra y no se manda por correo: un correo con una contraseña dentro se queda
en la bandeja para siempre. Quien invita se la pasa por donde ya hablan.

Si esa dirección ya tenía cuenta —se dio de alta por su cuenta, o es cliente de
otro negocio— se engancha a la que hay y **no se le toca la contraseña**: es
suya, no nuestra.

---

## Sin rol asignado se ve todo

**`null` no es «ninguna área»: es «sin límite».** Quien lleva el negocio no
tiene papel asignado, y así encender esto no dejó a nadie fuera de su propio
sistema.

Y va más lejos, porque los datos obligaban: `roles.permissions` es
`NOT NULL DEFAULT '[]'` y lo que había dentro eran **etiquetas escritas a
mano en castellano** —«Acceso total», «Facturación», «Check-in/Check-out»—.
Ninguna es una clave de área. Leer eso como «esta persona no puede ver nada»
habría echado del sistema a todos los usuarios que existían, empezando por los
dueños.

Por eso: **un rol que no dice ninguna área conocida se comporta como ayer**. En
cuanto tenga un área de verdad, manda la lista y se aplica a rajatabla.

---

## Dónde se bloquea

**En el servidor, en un solo sitio.** Un middleware justo después de
`requireBusinessAuth` compara el prefijo de la ruta contra el mapa y responde
`403 sin_permiso` si no toca.

Aquí y no en cada ruta: 186 rutas con su comprobación a mano es una lista que
se rompe en la primera que alguien añada sin acordarse, y ese olvido no falla
—deja pasar—. Con el mapa, **una familia de rutas sin clasificar se niega**,
que es el error seguro en vez del error silencioso.

### Y se recorta la respuesta

Esconder el menú no basta: `/employees` devuelve `hourly_rate` en la misma
lista que el nombre y el teléfono. Sin recortar, un jefe de obra vería el
sueldo de todos abriendo la pantalla que sí le toca.

| Campo | Requiere |
|---|---|
| `hourly_rate`, `hourlyRate`, `pay_amount`, `payAmount` | dinero |
| `access_token`, `accessToken` | personas |

El código de acceso está ahí porque quien pueda leerlo puede entrar como ese
trabajador.

### El cliente sólo evita el rebote

El menú esconde lo que no toca y una dirección escrita a mano redirige. Es
comodidad, no seguridad: quien lo quite del navegador se choca igual contra el
servidor.

A quien no puede ver el panel de inicio —que enseña el beneficio— se le lleva a
**su** primera pantalla, no a un cartel de «sin permiso». Alguien que aterriza
en una pantalla en blanco el primer día cree que el sistema está roto, no que
esa parte no es para él.

---

## Añadir una familia de rutas

1. Añádela a `AREA_DE` en `shared/permisos.ts`.
2. Si trae pantalla nueva, añádela también a `AREA_DE_PANTALLA`.
3. `python3 scripts/check-permisos.py`

El comprobador se queja si una familia del panel se queda sin área.

---

## Probarlo

```bash
node scripts/prueba-permisos/areas.mjs
```

37 comprobaciones: lo que el jefe de obra ve y lo que no, que no se le escape
un sueldo ni un código de acceso, que el dueño no pierda nada, y —lo que evitó
un desastre— que los roles que ya había en la base sigan viéndolo todo.
