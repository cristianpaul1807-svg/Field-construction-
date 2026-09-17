# El sitio de presentación

Las páginas públicas que un contratista encuentra en Google antes de saber que
existimos. Viven en `sitio/` y **no son parte de la aplicación**.

## Por qué es HTML suelto y no React

Lo abre alguien que llegó de una búsqueda, con el móvil, en la furgoneta y con
media raya de cobertura. Dos consecuencias:

- **Google lo indexa sin ejecutar nada.** El texto está en el HTML que llega.
- **Se lee antes de que baje ningún paquete.** La portada pesa 20 KB de HTML,
  16 KB de estilo y 1,3 KB de JavaScript, y ese JavaScript no hace falta para
  leerla.

Meterlo en la aplicación de React habría significado que el rastreador tiene
que ejecutar un paquete de varios cientos de kilobytes para ver una frase.

## Las páginas

| Dirección | Fichero | Para qué |
|---|---|---|
| `/accueil` | `index.html` | La portada |
| `/fonctionnalites` | `fonctionnalites.html` | Campo, clientes, dinero, cumplimiento |
| `/ccq-taxes` | `ccq-taxes.html` | **La que más tráfico va a traer** |
| `/tarifs` | `tarifs.html` | Los dos planes |
| `/contact` | `contact.html` | El formulario de prueba |

Más `estilo.css`, `sitio.js`, `robots.txt` y `sitemap.xml`.

### La de la CCQ es la importante

Un contratista busca «rapport mensuel CCQ» o «retenue 10% construction» mucho
antes de buscar un software. Esa página existe para responder esa búsqueda, con
datos estructurados de preguntas frecuentes, y de paso presentarnos.

Es la más aburrida de mantener y la que más va a rendir. Cuando cambien las
reglas, se actualiza.

## Por qué la portada está en `/accueil` y no en `/`

Porque **la raíz es la aplicación**: es la pantalla de arranque de la PWA —el
trabajador que la tiene instalada vuelve ahí— y la puerta de quien ya tiene
sesión. Quitársela dejaría a la cuadrilla aterrizando en un anuncio.

Para que el sitio sea de verdad la puerta de entrada hay que separar las dos
cosas: **el sitio en `logiciel-construction.com`, la aplicación en
`app.logiciel-construction.com`**. Eso arrastra, y hay que planificarlo:

1. `PAGINAS` en `server/index.ts`: `"/accueil"` pasa a `"/"`.
2. Los enlaces de `sitio/*.html`, el `canonical`, el `og:url` y el `sitemap.xml`.
3. **La URL de retorno registrada en Intuit** para QuickBooks.
4. Los *webhooks* de Stripe.
5. El enlace público `/c/tu-negocio` que los negocios ya tienen repartido entre
   sus clientes.

El punto 3 y el 5 son los que duelen si se hacen deprisa.

## Por dentro

Se sirve en `server/index.ts`, **antes** de `express.static` y del catch-all de
la aplicación, y sólo se atienden las direcciones de la lista. Lo que no esté
cae a la aplicación como siempre: el panel, el portal del cliente, la app del
trabajador y el chat público siguen intactos.

`npm run build` hace `rm -rf dist/sitio && cp -r sitio dist/sitio`. El `rm`
no es decorativo: `cp -r origen destino` con el destino ya creado mete la
carpeta **dentro de sí misma** —`dist/sitio/sitio`— y deja servida la copia
anterior. Se vio porque una corrección del formulario no aparecía en la página.

### El formulario

`POST /api/public/demo`, por encima de `requireBusinessAuth` porque lo rellena
alguien que todavía no tiene cuenta. Manda un correo a `SUPPORT_EMAIL` por
Resend.

Sin `SUPPORT_EMAIL` contesta 200 con `ok: false`, y la página ofrece entonces
el buzón de verdad en un enlace `mailto:` **con lo que la persona ya escribió
dentro**. Decirle «escríbenos directamente» sin dar una dirección es un
callejón, y perder lo que acaba de teclear es la forma más rápida de que no
vuelva.

## Lo que hay que cuidar al tocarlo

**Los precios están en dos sitios.** `shared/planes.ts` manda en el producto;
`tarifs.html` y los datos estructurados de `index.html` los repiten para el
sitio. Si cambia uno, cambian los dos.

**Todo en francés de Quebec.** La *Loi 96* exige el francés en la comunicación
comercial dirigida a Quebec: no es preferencia, es obligación. El inglés sería
una segunda versión con su `hreflang`; el español y el italiano viven dentro
del producto, para las cuadrillas, y en el sitio no pintan nada.

**Nada que no sea verdad.** El sitio dice explícitamente lo que *no* hacemos —
no transmitimos a la CCQ, no reemplazamos al contable, todavía no hay varias
empresas en una cuenta. Es más fácil de vender y mucho más barato que
desdecirse después.
