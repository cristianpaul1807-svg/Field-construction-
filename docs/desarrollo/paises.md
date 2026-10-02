# Añadir un país

El producto nació dando Canadá por hecho. Los números de TPS y TVQ, la licencia
RBQ, la retención del Código Civil de Quebec, la CCQ y las tasas por provincia
estaban escritos como si no hubiera otro sitio — sesenta y dos apariciones de
`province` y ninguna pregunta sobre dónde está el negocio.

Eso funciona mientras el único usuario esté en Quebec y **se rompe en silencio**
el día que no: a alguien de fuera se le pediría un número de TVQ que no tiene, y
le saldría impreso en cada factura un impuesto que no le corresponde. No daría
error; daría documentos mal hechos con aspecto de correctos.

`shared/paises.ts` es el único sitio donde vive esa diferencia.

---

## Qué declara un país

| Campo | Para qué |
|---|---|
| `codigo` | ISO-3166 alfa-2 |
| `etiquetaDeRegion` | Cómo se llama allí la región. **La clave**, no el texto |
| `regiones` | Las regiones, con el código con el que se guardan |
| `identificadoresFiscales` | Los números que se imprimen en cada documento. Vacío es válido |
| `licencia` | La licencia de contratista, si allí existe |
| `retencion` | Si se retiene parte de cada pago parcial hasta terminar |
| `organismoDeConstruccion` | `"ccq"` o `null` |
| `moneda` | ISO 4217. La fija la sesión para todo el panel; el portal, con el país que le manda `/client-portal/me`; los correos, con `importeEnTexto` |
| `impuestos` | `"canada"`, `"italia"` o `"sin_configurar"` |
| `nomina` | Si la pantalla de nómina existe |
| `cobrosConTarjeta` | Si hay Stripe: sin él no hay Cobrar, ni enlace de pago, ni botón de pagar en el portal o en el correo |
| `quickbooks` | Si se puede conectar QuickBooks. La sincronización elige el código de impuesto por provincia canadiense |

**País e idioma son cosas distintas.** El país decide lo que se trabaja —moneda,
impuesto, números fiscales, qué pantallas existen—; el idioma, sólo cómo se
lee. Un negocio italiano puede llevar el panel en español y uno de Quebec en
italiano, y todo tiene que salir entero en los cuatro. Lo único que no se
traduce es lo que es dato legal de un país: la mención de la inversione
contabile va en italiano en el PDF, con su traducción detrás.

**Stripe no opera en todas partes.** `stripeOperaEn` lleva la lista de
stripe.com/global. Donde Stripe no abre cuentas (casi toda Latinoamérica salvo
México y Brasil, Albania, Marruecos) el panel no dice «todavía»: dice que
Stripe no opera allí. Donde sí opera, la tarjeta llega creando la cuenta
conectada con el país del negocio y su moneda; la plataforma española puede
crear cuentas en casi todos esos países.

**QuickBooks sólo sirve donde está localizado.** En Italia existe la edición
Global, pero sin los tipos de IVA italianos ni la factura electrónica del SDI,
y allí la contabilidad la lleva el commercialista con programas italianos. Por
eso `quickbooks` es sólo Canadá; en Italia la integración que importa es el
XML FatturaPA.

El menú, el bot de ayuda y la pantalla de Datos de la empresa **se dibujan desde aquí**: pinta los
identificadores que el país declare, enseña la licencia sólo si la hay, y la
retención y la CCQ sólo donde aplican.

---

## Las dos reglas que no son obvias

**El país y la región se validan juntos.** `QC` es una provincia de Canadá y no
significa nada en ningún otro sitio. Una región que su país no reconoce deja al
negocio sin tasa de impuesto y sin forma de saber por qué, así que
`esRegionDe(pais, region)` se comprueba antes de guardar.

**`paisDe` cae en Canadá cuando no reconoce el código, y eso no sirve para
decidir.** Está bien para leer un valor guardado y es lo contrario de lo
correcto para preguntar «¿le toca la CCQ?»: un negocio con el país todavía sin
cargar se habría encontrado con que le pedimos su número de la CCQ. Por eso
`aplicaLaCcq` exige primero `esPaisConocido`. Lo encontró una prueba, no una
revisión.

---

## Sólo se ofrece lo que sabemos hacer entero

El selector lista únicamente los países cuyas reglas están completas. Dejar
elegir uno para el que no calculamos el impuesto sería darle a alguien facturas
mal hechas que parecen correctas, que es peor que decirle que todavía no
llegamos — y la pantalla lo dice, con la invitación a pedirlo.

---

## Lo de un país no se ve ni se escribe en otro

Un negocio de Quebec no tiene por qué ver un DURC, ni guardar una Partita IVA
en un cliente; uno de Roma no tiene por qué abrir la nómina con retenciones de
Quebec. Esconderlo del menú no basta: la API se puede llamar a mano. Hay tres
puertas, y una novedad de un país tiene que pasar por las tres.

**1. La pantalla** no lo ofrece: el menú, las tarjetas y las listas miran
`paisDe(country)` o `grupoDePais(country)`.

**2. El servidor** lo rechaza con un mensaje en el idioma de quien lee:

- Una puerta por familia de rutas, detrás del inicio de sesión
  (`RUTAS_DEL_PAIS` en `server/api.ts`): `/payroll` y `/ccq` necesitan
  `nomina`, `/stripe/terminal` necesita `cobrosConTarjeta`, `/quickbooks`
  necesita `quickbooks`. Lee la ficha del país, no una lista de países.
  Contesta `no_disponible_en_el_pais`.
- En los PATCH de obra y de cliente, los campos de Italia
  (`CAMPOS_SOLO_ITALIA` en `shared/soloDeUnPais.ts`) → `solo_italia`.
- Al subir un papel, un tipo de otro país (`PAPELES_SOLO_DE`) →
  `tipo_de_papel_de_otro_pais`.
- Las rutas que sólo existen en Italia (congruità, XML FatturaPA) miran el
  país ellas mismas, y el MCP esconde sus herramientas con `soloEn`.

**3. La base de datos**, con triggers que valen aunque alguien escriba con su
sesión directamente contra Supabase o el servidor se equivoque:

| Trigger | Tabla | Qué impide fuera de su país |
|---|---|---|
| `private.exigir_italia_en_obra` | `projects` | `bonus_fiscale`, `congruita_categoria`, `valore_opera`, `lavoro_pubblico` |
| `private.exigir_italia_en_cliente` | `clients` | `partita_iva`, `codice_fiscale`, `codice_destinatario`, `pec` |
| `private.exigir_pais_en_papel` | `worker_documents` | tipos de Italia fuera de Italia; T4, RL-1 y talón fuera de Canadá |
| `private.exigir_italia_en_iva` | `invoices`, `credit_notes` | un `tax_breakdown` con IVA italiano |

Todos usan `private.pais_del_negocio()`, que trata un negocio sin país como
Canadá, igual que `shared/paises.ts`. Sólo saltan cuando un valor **se pone o
cambia**: quitarlo vale siempre, para que quien cambió de país pueda limpiar
lo que le quedó, y editar otra cosa de una obra antigua no tropieza con su
bonus de cuando era italiana. El error llega con el código como mensaje
(`solo_italia`, `tipo_de_papel_de_otro_pais`) y `route()` lo convierte en un
400 traducido.

Se probaron contra la base real dentro de un bloque que se deshace al final:
doce casos, de «Canadá no pone un bonus» a «Italia no sube un T4». Si añades
una columna o un tipo de un país, añádelo a la lista de `soloDeUnPais.ts`, al
trigger, y a `scripts/prueba-paises/aislamiento.mjs`.

Aparte del país, cada fila sigue cerrada por negocio con RLS
(`business_id = private.current_business_id()`), y el cliente del portal no
lee las partidas de los SAL: incluyen las líneas que el negocio ocultó del
presupuesto.

---

## Lo que todavía está atado a Canadá

Añadir una entrada al registro **no basta** para que un país funcione. Falta:

- **Las tasas de impuesto** salen de la tabla `canada_tax_rates` por provincia.
  Otro país necesita su propio origen de tasas.
- **Las retenciones de nómina** (`QUEBEC_2026_DEDUCTIONS`) son de Quebec. Fuera
  de Quebec la lista sale vacía, que es lo correcto, pero nadie la rellena.
- **Los rótulos de los PDF** dicen TPS/TVQ/PST/HST.
- **Los destinos de las remesas** son Revenu Québec, la CRA y la CNESST.

El registro es lo que hace que eso sea trabajo acotado en vez de una búsqueda.
