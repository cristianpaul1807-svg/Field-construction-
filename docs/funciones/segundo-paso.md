# El segundo paso al entrar

**Dónde:** menú → Configuración → Usuarios y roles
**Código:** `client/src/components/DobleFactor.tsx` · `client/src/lib/dobleFactor.ts`

---

## Para qué sirve

Además de la contraseña, seis dígitos que cambian cada medio minuto en una app
del móvil. Si alguien consigue la contraseña de un contratista, con ella sola
no entra — y lo que hay al otro lado son sus clientes, sus facturas, los datos
de sus trabajadores y la conexión con su contabilidad.

---

## No hay ningún servicio detrás

Esto es **TOTP**, un estándar abierto. El servidor guarda un secreto, la app
del móvil guarda el mismo secreto, y los dos calculan el mismo número de seis
cifras a partir de la hora. **Nada viaja entre ellos.**

Por eso vale cualquier app —Google Authenticator, Microsoft Authenticator,
Authy, 1Password, el llavero del propio iPhone— y por eso no le contamos a
Google, ni a nadie, quién entra en este sistema. No hay cuenta que abrir, ni
clave que pedir, ni factura que pagar.

Lo implementa Supabase Auth, que ya estaba.

---

## Es opcional, y nace apagado

Quien no lo encienda entra como siempre: correo y contraseña, un paso.

Eso no es pereza. Un segundo paso obligatorio, el día que alguien está en una
obra con el móvil, sin cobertura y con las manos sucias, es la clase de
seguridad que acaba con la contraseña apuntada en el salpicadero del camión.
Se ofrece, se explica qué protege, y decide quien va a convivir con ello.

---

## Cómo se activa

1. Configuración → Usuarios y roles → **Activar**.
2. Sale un código QR. Se escanea con la app de autenticación.
3. Se escriben los seis dígitos que la app muestre.

El tercer paso no es un trámite: hasta que esos dígitos no llegan, el factor
queda en `unverified` y no sirve para nada. Dar por bueno un secreto que nadie
ha demostrado tener en el móvil es exactamente cómo se deja a alguien fuera de
su propia cuenta.

Para quien mire esta pantalla **desde el mismo teléfono** en el que tiene la
app —y no pueda apuntar la cámara a su propia pantalla— la clave sale también
escrita debajo del QR.

---

## Cómo se entra después

Correo y contraseña como siempre. Si esa cuenta lo tiene puesto, el formulario
**se sustituye** por los seis huecos del código. Se sustituye y no se añade
debajo a propósito: dejar la contraseña en pantalla invita a volver a pulsar
*Iniciar sesión*, y eso es lo que hace que el código caduque antes de acabar de
escribirlo.

Funciona en las dos puertas del negocio, la de la página de inicio y la de
`/negocio/acceso`.

---

## Por dentro

| Qué | Dónde |
|---|---|
| Preguntar si falta el segundo paso | `faltanLosSeisDigitos()` |
| Comprobar el código al entrar | `comprobarLosSeisDigitos()` |
| Alta: crear el factor y dar el QR | `empezarAlta()` |
| Alta: confirmarlo con el primer código | `terminarAlta()` |
| Quitarlo | `quitar()` |

Supabase lo dice comparando dos niveles: el que la sesión tiene ahora
(`currentLevel`) y el que podría alcanzar (`nextLevel`). Si el segundo es
mayor, esa persona lo tiene puesto y todavía no lo ha pasado.

**Si no se puede preguntar, no se bloquea la entrada.** Quedarse fuera por un
fallo de red es peor que entrar con un solo factor, que es lo que pasaba antes
con todo el mundo.

**Un alta a medias se limpia antes de empezar otra.** Un factor sin verificar
de otro día impide crear el siguiente, y el mensaje que devuelve Supabase no
lo explica.

---

## Si alguien pierde el móvil

Es la pregunta que viene justo después de activarlo, y la pantalla la contesta
antes de que la hagan: **no puede entrar por su cuenta**. Tiene que escribir a
soporte, y se le quita después de comprobar quién es.

Eso hay que poder cumplirlo. Se hace desde el panel de Supabase:

1. **Authentication → Users**, buscar a esa persona por su correo.
2. Abrir su ficha y borrar el factor MFA que tenga.
3. Ya puede entrar con su contraseña, y volver a activarlo en otro móvil.

Comprueba quién es antes de tocarlo. Un correo pidiendo que le quites el
segundo paso a una cuenta es, palabra por palabra, lo que escribiría alguien
que ya tiene la contraseña y se ha quedado atascado en el segundo paso.

---

## Qué falta

- **Códigos de recuperación.** Un puñado de códigos de un solo uso que se dan
  al activar, para no depender de soporte. Supabase no los trae; habría que
  guardarlos nosotros.
- **Obligarlo por negocio.** Hoy lo decide cada persona. Un contratista con
  oficina podría querer exigírselo a los suyos.

Ninguna de las dos hace falta para lo que hay hoy: un negocio, una persona.
