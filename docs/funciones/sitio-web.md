# El sitio de presentación

Las páginas públicas que un contratista encuentra en Google antes de saber que
existimos. Viven en `sitio/` y **no son parte de la aplicación**.

## Por qué es HTML suelto y no React

Lo abre alguien que llegó de una búsqueda, con el móvil, en la furgoneta y con
media raya de cobertura. Dos consecuencias:

- **Google lo indexa sin ejecutar nada.** El texto está en el HTML que llega.
- **Se lee antes de que baje ningún paquete.** El JavaScript del sitio es un
  archivo de un par de kilobytes, y no hace falta para leer la página: pone la
  clase `js` desde dentro, así que si no corre, el contenido se queda visible
  donde siempre estuvo.

Meterlo en la aplicación de React habría significado que el rastreador tiene
que ejecutar un paquete de varios cientos de kilobytes para ver una frase.

## Por qué se genera y no se escribe a mano

Son **siete páginas en cuatro idiomas**. Escritas a mano serían 28 archivos con
la misma cabecera, el mismo pie y el mismo selector de idioma copiados 28
veces: cambiar un enlace del menú obligaría a acertar 28 veces seguidas.

Así que el texto vive separado del HTML:

| Qué | Dónde |
|---|---|
| Todo lo que se lee, por idioma | `sitio/textos/{fr,en,es,it}.mjs` |
| El HTML, el selector, los datos estructurados | `sitio/construir.mjs` |
| El estilo y las caras de letra | `sitio/estilo.css` |
| Los archivos de letra | `sitio/fuentes/*.woff2` |
| El casco de la cabecera | `sitio/logo.png` |
| El único JavaScript | `sitio/sitio.js` |
| Lo generado | `sitio/publico/` — **no se guarda en el repositorio** |

`npm run build` corre el generador antes que nada. Editar `sitio/publico/` a
mano no sirve: la siguiente compilación lo sobrescribe.

### El generador se niega a escribir un sitio a medias

`comprobarParidad()` compara las claves de los cuatro idiomas contra el francés
—y la longitud de cada lista, no sólo su presencia— y aborta si falta una. Es
lo mismo que hace `scripts/i18n-add-keys.py` con el producto, y por lo mismo:
una sección que existe en francés y no en italiano no se ve hasta que alguien
abre esa página en italiano.

`comprobarEnlaces()` recorre todos los `href` y `src` que salen del generador.
Si apuntan a una página, tiene que estar en el mapa; si apuntan a un archivo
—la hoja de estilo, el logo, una letra, un icono— tiene que existir en el
disco. Se comprueba de verdad en vez de llevar una lista de excepciones
escrita a mano, porque una lista hay que acordarse de ampliarla: el día que
alguien añada un peso de letra y no lo copie, la página saldrá en producción
con la letra de reserva y aquí no habría saltado nada.

Salida esperada:

```
enlaces ok — 564 a páginas que existen, 280 a archivos que están
sitio ok — 28 páginas en 4 idiomas, fr en es it
```

## Las páginas

Siete por idioma. Las direcciones están **en cada idioma** —un francófono no
teclea `/pricing`— y por eso no se puede deducir la ruta del francés:

| Para qué | fr | en | es | it |
|---|---|---|---|---|
| Portada | `/fr/` | `/en/` | `/es/` | `/it/` |
| Funciones | `/fr/fonctionnalites` | `/en/features` | `/es/funciones` | `/it/funzioni` |
| CCQ e impuestos | `/fr/ccq-taxes` | `/en/ccq-taxes` | `/es/ccq-impuestos` | `/it/ccq-tasse` |
| Precios | `/fr/tarifs` | `/en/pricing` | `/es/precios` | `/it/prezzi` |
| Contacto | `/fr/contact` | `/en/contact` | `/es/contacto` | `/it/contatto` |
| Privacidad | `/fr/confidentialite` | `/en/privacy` | `/es/privacidad` | `/it/privacy` |
| Condiciones | `/fr/conditions` | `/en/terms` | `/es/condiciones` | `/it/condizioni` |

Más `estilo.css`, `sitio.js`, `robots.txt`, `sitemap.xml` y `rutas.json`.

Cada página declara su `canonical` y un `hreflang` por idioma, y el
`sitemap.xml` repite esas alternativas con `xhtml:link`. Sin eso Google trata
las cuatro versiones como cuatro páginas que compiten entre sí.

### Las legales no se escriben aquí

`paginaLegal()` construye privacidad y condiciones desde
`client/src/i18n/locales/*.json` (`legal.privacy` y `legal.terms`) — el mismo
texto que la aplicación enseña dentro. Si vivieran dos veces, la que lee el
cliente antes de firmar y la que lee después de entrar acabarían diciendo cosas
distintas, y la que cuenta en una disputa es la que se le enseñó.

### La de la CCQ es la importante

Un contratista busca «rapport mensuel CCQ» o «retenue 10% construction» mucho
antes de buscar un software. Esa página existe para responder esa búsqueda, con
datos estructurados de preguntas frecuentes, y de paso presentarnos.

Es la más aburrida de mantener y la que más va a rendir. Cuando cambien las
reglas, se actualiza.

## Que quepa en un teléfono

Es donde más se va a leer, y es donde falló. La cabecera llevaba la marca con
su nombre, el selector de idioma, «Iniciar sesión» y el botón naranja: a 390 px
eso mide 526, y el navegador deja la página arrastrable de lado. Se lee una
línea empujando a izquierda y derecha y parece que está todo roto, aunque cada
pieza por separado esté bien.

**Ninguna comprobación lo vio.** `tsc` no mide páginas, el comprobador de
enlaces sólo sabe a dónde llevan, y en el navegador de escritorio cabe de
sobra. Por eso ahora hay una que mide:

```bash
node scripts/comprobar-ancho.mjs
```

Abre las 28 páginas a 320 px (el iPhone SE, que sigue vivo en obra) y a 390, y
falla si el documento ocupa más de lo que cabe. Cuando falla dice **qué** se
sale, con su nombre y sus coordenadas — saber que la portada mide 526 no sirve;
saber que quien la estira es el botón de la cabecera sí.

Dos cosas de este guardia no son adorno:

**Levanta un servidor.** Los enlaces del sitio son absolutos, como en
producción. Abiertos con `file://` apuntan a la raíz del disco, el navegador no
encuentra la hoja de estilos y mide HTML desnudo, donde no se sale nada. La
primera versión hacía eso y decía que todo estaba bien mientras la cabecera se
salía en el teléfono de verdad.

**Exige que las letras hayan cargado**, y se niega a medir si no. Otro tipo de
letra es otro ancho: medir con la de reserva es volver a medir una página que
nadie va a ver.

### Qué se quita en un teléfono, y por qué ese orden

Está en `estilo.css`, en los dos `@media` de la cabecera, y salió de la
medición y no de una estimación.

Primero se va **el botón naranja**. Es el único elemento de la cabecera que
está repetido: todas las páginas llevan la misma llamada al final, y la portada
la lleva además a dos dedos del titular. «Iniciar sesión» no está repetido en
ninguna parte y es lo que busca quien ya es cliente, así que ese se queda.

Después, por debajo de 430 px, **el nombre escrito**. El casco es el mismo
icono que la aplicación tiene en la pantalla de inicio del teléfono; a 44 px se
reconoce, y el nombre completo sigue en el título de la pestaña, en el pie y en
el titular de la portada.

## Las letras y el logo

**Las letras se sirven desde aquí**, no desde Google. Un `<link>` a
fonts.googleapis.com es una descarga que bloquea el pintado, en otro dominio,
con su DNS y su saludo TLS — y quien abre esto está en la furgoneta con media
raya, que es justo cuando eso se nota. De paso, nadie manda la IP del visitante
a un tercero por abrir la página, que es un problema menos bajo la Ley 25.

Cada cara viene partida en `latin` y `latin-ext` con su `unicode-range`, como
las sirve Google, así que una página que no usa ninguna letra del segundo
archivo no lo descarga. Las tres que se ven antes de bajar —el titular y el
texto— van con `preload`. El servidor las manda con un año de caché e
`immutable`: el nombre del archivo lleva el peso y el subconjunto dentro, así
que si algún día cambia el tipo de letra cambia el nombre.

**El logo es el mismo archivo que los iconos de la aplicación.**
`assets/logo-source.png` es la fuente; `scripts/build-icons.mjs` saca de ahí
los nueve iconos de la PWA y el `favicon.ico`, y `sitio/logo.png` es el mismo
casco recortado para la cabecera. El icono que el trabajador tiene en la
pantalla del teléfono y la marca del sitio son el mismo dibujo, no dos
parecidos.

Si cambias el logo: sustituye `assets/logo-source.png`, vuelve a correr
`node scripts/build-icons.mjs assets/logo-source.png` y regenera también
`sitio/logo.png`.

## El selector de idioma

Arriba, en la cabecera de las siete páginas, y lleva **a la misma página en el
otro idioma** — no a la portada. Quien está leyendo los precios en francés y
cambia a español quiere los precios en español; devolverlo al inicio le obliga
a buscar otra vez.

Es un `<details>`, así que abre y cierra sin JavaScript. Lo único que añade
`sitio.js` es cerrarlo al pulsar fuera o con Escape, que es lo que se espera de
un menú y `<details>` no hace solo.

## Por qué la portada está en `/fr/` y no en `/`

Porque **la raíz es la aplicación**: es la pantalla de arranque de la PWA —el
trabajador que la tiene instalada vuelve ahí— y la puerta de quien ya tiene
sesión. Quitársela dejaría a la cuadrilla aterrizando en un anuncio.

Para que el sitio sea de verdad la puerta de entrada hay que separar las dos
cosas: **el sitio en `logiciel-construction.com`, la aplicación en
`app.logiciel-construction.com`**. Eso arrastra, y hay que planificarlo:

1. Una raíz que reparta por el idioma del navegador hacia `/fr/`, `/en/`,
   `/es/` o `/it/`, con francés por defecto.
2. El `canonical`, el `og:url` y el `sitemap.xml` del generador.
3. **La URL de retorno registrada en Intuit** para QuickBooks.
4. Los *webhooks* de Stripe.
5. El enlace público `/c/tu-negocio` que los negocios ya tienen repartido entre
   sus clientes.

El punto 3 y el 5 son los que duelen si se hacen deprisa.

## Por dentro

`server/index.ts` **lee `sitio/publico/rutas.json`** y registra una dirección
por entrada, antes de `express.static` y del catch-all de la aplicación. El
mapa no se escribe en el servidor a propósito: añadir una página no puede
depender de que alguien se acuerde de tocar ese archivo.

Cada dirección terminada en `/` registra además la versión sin barra con una
redirección 301 — `/fr` es lo que la gente escribe, y dos direcciones para el
mismo contenido reparten el posicionamiento entre las dos.

Todo va dentro de un `try`. Si el sitio no se pudo generar, el servidor lo
registra por consola y arranca igual: un fallo en las páginas de marketing no
puede dejar sin panel a quien está facturando.

Lo que no esté en el mapa cae a la aplicación como siempre: el panel, el portal
del cliente, la app del trabajador y el chat público siguen intactos.

`npm run build` termina con `rm -rf dist/sitio && cp -r sitio/publico
dist/sitio`. El `rm` no es decorativo: `cp -r origen destino` con el destino ya
creado mete la carpeta **dentro de sí misma** —`dist/sitio/sitio`— y deja
servida la copia anterior. Se vio porque una corrección del formulario no
aparecía en la página.

### El formulario

`POST /api/public/demo`, por encima de `requireBusinessAuth` porque lo rellena
alguien que todavía no tiene cuenta. Manda un correo a `SUPPORT_EMAIL` por
Resend.

Sin `SUPPORT_EMAIL` contesta 200 con `ok: false`, y la página ofrece entonces
el buzón de verdad en un enlace `mailto:` **con lo que la persona ya escribió
dentro**. Decirle «escríbenos directamente» sin dar una dirección es un
callejón, y perder lo que acaba de teclear es la forma más rápida de que no
vuelva.

Los textos del formulario —«enviando», «faltan datos», «no se pudo»— viajan en
atributos `data-*` del propio `<form>`, escritos por el generador en el idioma
de la página. Por eso `sitio.js` es un archivo para los cuatro idiomas y no
tiene dentro ni una frase que se pueda quedar sin traducir.

## Lo que hay que cuidar al tocarlo

**Los precios están en dos sitios.** `shared/planes.ts` manda en el producto;
la constante `PRECIOS` de `sitio/construir.mjs` los repite para el sitio. Si
cambia uno, cambian los dos.

**El francés manda.** La *Loi 96* exige el francés en la comunicación comercial
dirigida a Quebec: no es preferencia, es obligación. Por eso el francés es la
referencia de la paridad y el idioma por defecto de todo lo que no diga otra
cosa. El inglés, el español y el italiano existen porque las cuadrillas y los
dueños de Quebec no siempre son francófonos, y porque el producto ya está en
esos cuatro idiomas.

**Nada que no sea verdad.** El sitio dice explícitamente lo que *no* hacemos —
no transmitimos a la CCQ, no reemplazamos al contable, todavía no hay varias
empresas en una cuenta. Es más fácil de vender y mucho más barato que
desdecirse después.

**Míralo en el navegador, y en un teléfono.** Los guardias comprueban que las
páginas existen, que los enlaces llevan a alguna parte y que nada se sale de
ancho; no comprueban que se vea bien. Cuando el nombre de la marca se ocultó a
390 px, el ancho pasaba y la cabecera quedaba con el logo flotando en un hueco
vacío. Eso se arregló mirando la captura, no midiendo.
