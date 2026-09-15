# Cómo se le cuenta un fallo a una persona

Mientras probábamos, la pantalla enseñaba lo que contestara el servidor. Lo que
llegaba a leer un contratista era esto:

> No se pudo cargar desde Supabase: Could not find a relationship between
> 'invoices' and 'quickbooks_links' in the schema cache

Tres cosas mal en una línea. Nombra a un proveedor que él no ha contratado,
está en un idioma que no eligió, y no dice qué hacer. Peor: no dice si perdió
lo que acababa de escribir, que es lo único que de verdad le preocupa.

En producción eso no puede salir. Pero tampoco puede desaparecer: la respuesta
literal del servidor es lo único que sirve cuando alguien nos escribe. Así que
hay **dos textos por fallo**.

| | Qué es | Dónde va |
|---|---|---|
| **Anuncio** | Una frase en su idioma: qué pasó y qué hacer | Lo que se lee |
| **Detalle** | La respuesta literal del servidor | Plegado, detrás de un enlace |

---

## De dónde sale el anuncio

`client/src/lib/fallos.ts`, `anuncioDeFallo(estado, cuerpo, respaldo)`. Elige
por este orden:

1. **El código del servidor.** Si la respuesta trae `code` y existe
   `serverErrors.<code>` en los cuatro idiomas, gana: es el único texto escrito
   pensando en ese caso.
2. **El estado HTTP**, para lo que el código no cubre. Un 401 dice que se
   caducó la sesión, un 403 que no tiene permiso, un 429 que espere, un 5xx que
   el fallo es nuestro. Un **estado 0** es que no hubo respuesta —el móvil sin
   cobertura en la obra— y no «Failed to fetch».
3. **El respaldo** que pasa quien llama: «no se pudo guardar el presupuesto».
   Nombra lo que se intentaba, que es más de lo que dice un 400 pelado.

Lo que **no** entra nunca es `body.error`. De los 194 fallos que contesta la
API, un tercio no tiene código todavía y su texto está escrito para nosotros:
`content is required`, `token is required`. Eso no es una instrucción para
nadie. `serverMessage()` dejó de devolverlo por ese motivo.

---

## Cómo se enseña

`<AvisoDeFallo mensaje={…} detalle={…} onReintentar={…} />`.

**Un aviso sin salida es lo que convierte un problema de cinco minutos en una
baja.** Por eso el componente lleva siempre a algún sitio:

- **Volver a intentarlo**, cuando quien llama pasa un `onReintentar`. Es lo que
  arregla la mayoría, porque la mayoría son un mal momento del servidor.
- **Preguntar a la ayuda**, que abre el bot ya colocado en la respuesta del
  fallo (`problemas.avisoDeFallo`). El botón sólo sale donde el bot está
  puesto: el panel sí, el portal del cliente y la app del trabajador no. Lo
  decide `hayAyuda()`, para no dejar un botón que no abre nada.
- **Escríbenos**, sólo si el despliegue define `VITE_SUPPORT_EMAIL`. Sin buzón
  no se ofrece: un enlace a una dirección que no existe es peor que nada.

El detalle técnico va debajo, plegado, y se despliega en un clic.

### Abrir el bot desde fuera

`abrirAyuda(seccion, tema)` (`client/src/lib/abrirAyuda.ts`) lanza un evento
que el bot escucha. Es un evento y no un contexto a propósito: el bot vive en
el marco del panel, y subir su estado hasta la raíz sólo para que un aviso
pueda abrirlo ataría las dos cosas para siempre.

---

## Lo que hay que hacer al añadir un fallo nuevo

1. Si el servidor contesta algo que la persona puede arreglar, **dale un
   `code`** y escribe `serverErrors.<code>` en los cuatro idiomas. Un fallo con
   nombre se explica una vez y ya está explicado en todas partes.
2. Si no lo puede arreglar, no hace falta código: el estado y el respaldo ya
   dicen lo suficiente.
3. Al enseñarlo, usa `AvisoDeFallo` si la pantalla se queda sin nada que
   enseñar, y una línea corta si es un error de un formulario. Un formulario no
   necesita una tarjeta: necesita que la frase esté debajo del campo.

Lo que nunca se hace es enseñar `err.message` de algo que no pasó por aquí.
