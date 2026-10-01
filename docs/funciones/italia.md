# Italia

**Estado:** en preparación. Se puede elegir al darse de alta, con aviso.
**Código:** `shared/paises.ts` (el país), `shared/iva.ts` (el impuesto),
`shared/fiscaleItalia.ts` (Partita IVA y codice fiscale).

---

## Por qué está en pruebas

En Italia **un PDF no es una factura**. La factura válida es un XML
(FatturaPA) que viaja por el Sistema di Interscambio (SDI) de la Agenzia delle
Entrate. Hasta que el producto genere ese XML, ofrecer Italia sería darle a
alguien documentos con aspecto de buenos que su contable tendría que rehacer.

Por eso `IT` lleva `enPruebas: true`. Quien se da de alta desde Italia puede
elegirla y lleva obras, presupuestos y facturas con IVA y en euros, pero el
alta y el panel le avisan de que la factura electrónica está en preparación
(`avisoDelPais`). Lo que no se puede es pasarse a Italia desde Configuración
siendo de otro país (`pais_no_ofrecido`).

---

## Cómo se elige el país

**Al darse de alta**, en el mismo formulario del correo y la contraseña
(`SelectorDePais`). Viene propuesto por `detectarPais`: la **zona horaria**
del aparato primero —dice dónde está, no en qué idioma lo tiene; un italiano
en Montreal tiene el móvil en italiano y vive en Quebec— y la región del
idioma si la zona no dice nada. Sin pedir permisos de ubicación.

| Elige | Qué pasa |
|---|---|
| Canadá | Lo de siempre: Quebec, retención del 10 %, TPS/TVQ |
| Italia | Provincia vacía, sin retención, IVA y euros. Aviso de que la factura electrónica está en preparación |
| Otro país (`OTROS_PAISES`) | Entra con su moneda y sin impuesto. Aviso en el alta y en el panel con el correo de soporte. **No puede emitir facturas** (`pais_sin_configurar`) ni conectar Stripe (`pagos_pais_no_listos`) |

Lo de Quebec son los valores por defecto de la tabla `businesses`, así que el
alta se los quita a quien no es de allí. Un negocio de otro país que naciera
con ellos tendría la TVQ en su primer presupuesto.

Desde Configuración no se puede cambiar a un país en pruebas o sin
configurar: eso sólo pasa al registrarse, o lo cambiamos nosotros.

---

## Lo que cambia respecto a Canadá

| | Canadá (Quebec) | Italia |
|---|---|---|
| Moneda | CAD | EUR |
| Impuesto | Por provincia: TPS + TVQ | Por obra: IVA 22 / 10 / 4 %, o inversione contabile |
| Identificadores | TPS, TVQ, licencia RBQ | Partita IVA, codice fiscale, PEC |
| Dirección | Una línea | Calle, CAP, municipio y provincia por separado |
| Retención | 10 % del Código Civil | Sólo si el contrato la prevé (ritenuta a garanzia) |
| Organismo del sector | CCQ | — (la Cassa Edile la lleva el consulente) |
| Nómina | Aquí | Fuera: la hace el consulente del lavoro |

### El IVA lo decide la obra

En Canadá el impuesto es el de la provincia del negocio y es igual en todas
sus facturas. En Italia depende del trabajo:

| Opción | Cuándo |
|---|---|
| 22 % | Lo ordinario |
| 10 % | Reformas y mantenimiento de viviendas |
| 4 % | Primera vivienda nueva |
| Inversione contabile (N6.3) | Subcontrato para otra empresa del sector. La factura va sin IVA y lo ingresa quien la recibe (art. 17, c. 6, lett. a, DPR 633/72) |

El negocio elige su IVA habitual en Configuración → Pagos, y cada factura
puede cambiarlo al crearla. Se guarda en `tax_breakdown` con
`{ country: "IT", ivaAliquota, iva, natura? }`, así que una factura ya emitida
se imprime igual para siempre aunque el negocio cambie su IVA habitual. Las
notas de crédito copian el tipo de la factura que corrigen.

El país se mira **antes** que la provincia en `computeInvoiceTax`: las siglas
se repiten (`PE` es Pescara y la Isla del Príncipe Eduardo), y buscar la
provincia en la tabla de Canadá sin mirar el país le pondría a una factura
italiana un impuesto de otro continente.

### La moneda sale del país

`AuthContext` lee el país en `/api/auth/me` y fija la moneda de
`formatCurrency` para todo el panel. El portal del cliente la fija con el país
que le llega en `/client-portal/me`, y los correos con `importeEnTexto`. En
los PDF, la moneda sale del propio desglose del documento, no del negocio; el
acuerdo de trabajo, que no tiene desglose, la saca del país del negocio.

### Lo que se esconde

- **Nómina:** fuera del menú (`Pais.nomina`).
- **CCQ:** `aplicaLaCcq` ya exigía Quebec.
- **Lo de Quebec en el personal:** el bloque de la CCQ de los acuerdos de
  trabajo y el «% de vacaciones» (en Italia lo paga la Cassa Edile).
- **Cobrar, enlace de pago y QuickBooks:** fuera del menú y cerrados en el
  servidor (`cobrosConTarjeta`, `quickbooks`). El portal y el correo de la
  factura no ofrecen «pagar ahora»: dicen el importe y que el negocio dirá
  cómo pagarlo.
- **El bot de ayuda** enseña a Italia sus temas —el IVA, la inversione
  contabile, la factura electrónica, cobrar sin tarjeta— y ninguno de los de
  Canadá (TPS/TVQ, CCQ, T4, Stripe, QuickBooks). Los demás países ven los
  suyos: que todavía no se factura allí y a quién escribir.

---

## Lo que tiene el consulente del lavoro

La nómina no se hace aquí, pero el consulente necesita de la empresa las
horas de cada mes. En Registro de trabajo hay un resumen por persona —horas
ordinarias, horas extra, y los días de vacaciones, malattia, permesso,
festività, **maltempo** e **infortunio**— que se descarga en CSV con los
encabezados en italiano, o se pide por MCP. Ver
[control-de-trabajo.md](control-de-trabajo.md#las-horas-del-mes-para-la-nómina).

Y el commercialista recibe sus facturas con imponibile, aliquota, IVA y natura
(ver [finanzas.md](finanzas.md#exportar-para-el-contable)).

---

## Fases

1. **País, EUR e IVA.** ✅ Hecho. Y el resto del producto según el país: bot de
   ayuda, portal, correos, menú (sin Cobrar, Nómina ni QuickBooks). ✅
2. **XML FatturaPA descargable**, para que el negocio lo suba al SDI con su
   programa o su gestor. Con la natura N6.3, el CIG/CUP en obra pública y la
   mención de la deducción cuando la hay.
3. **Stripe en euros:** cuentas conectadas italianas, cobros en EUR y precios
   de suscripción italianos (79 €/mes y 790 €/año Chantier, 199 €/mes y
   1.990 €/año Entreprise). Stripe opera en Italia y la plataforma española
   puede crear esas cuentas.
4. **PDFs, textos y web** para el mercado italiano, y legales para la UE.
5. **Envío directo al SDI** con un intermediario (A-Cube, Openapi,
   Invoicetronic…), y el estado de cada factura (entregada, rechazada).
6. **Bonus edilizi:** el texto del *bonifico parlante* en la factura y en el
   portal, y el 11 % que retiene la banca conciliado como retención y no como
   impago.
7. **Vencimientos:** fecha de caducidad en los Papeles de cada persona y de
   cada subcontratista (DURC, patente a crediti, cursos de seguridad,
   tessera), con aviso.
8. **Congruità:** obras de 70.000 € o más, horas fichadas frente a la
   incidencia mínima de mano de obra, avisando antes del final.
9. **Computo metrico con prezzario regional y SAL.** La pieza más grande; la
   que abre la obra mediana y la pública.

Italia deja de estar en pruebas al terminar la fase 2: es la que hace que sus
facturas sean válidas. Cada fase llega también **hablada** por el MCP (ver la
sección 11 de [plan-maestro-mcp.md](../desarrollo/plan-maestro-mcp.md)); el
porqué de este orden está en
[competencia-italia.md](../desarrollo/competencia-italia.md).

---

## Lo que no se hace, a propósito

- **Régimen forfettario** (facturas sin IVA con marca de bollo). Primero el
  régimen ordinario, que es el grueso del mercado.
- **Split payment** con la administración pública.
- **Nómina italiana.** Un producto entero, y un riesgo legal hecho a medias.
