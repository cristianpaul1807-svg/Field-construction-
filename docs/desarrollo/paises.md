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

## Lo que todavía está atado a Canadá

Añadir una entrada al registro **no basta** para que un país funcione. Falta:

- **Las tasas de impuesto** salen de la tabla `canada_tax_rates` por provincia.
  Otro país necesita su propio origen de tasas.
- **Las retenciones de nómina** (`QUEBEC_2026_DEDUCTIONS`) son de Quebec. Fuera
  de Quebec la lista sale vacía, que es lo correcto, pero nadie la rellena.
- **Los rótulos de los PDF** dicen TPS/TVQ/PST/HST.
- **Los destinos de las remesas** son Revenu Québec, la CRA y la CNESST.

El registro es lo que hace que eso sea trabajo acotado en vez de una búsqueda.
