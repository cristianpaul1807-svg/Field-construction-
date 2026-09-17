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
| El HTML, el selector, el logo, los datos estructurados | `sitio/construir.mjs` |
| El estilo | `sitio/estilo.css` |
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

`comprobarEnlaces()` recorre los 592 enlaces internos que salen del generador y
falla si alguno apunta a una dirección que no está en el mapa. Un botón que
lleva a un 404 es exactamente el tipo de error que nadie encuentra probando en
su propio idioma.

Salida esperada:

```
enlaces ok — 592 internos, todos a una página que existe
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

**Míralo en el navegador.** Los guardias comprueban que las páginas existen y
que los enlaces llevan a alguna parte; no comprueban que se vea bien. En este
proyecto las capturas han encontrado errores de maquetación reales que ninguna
comprobación automática iba a ver.
