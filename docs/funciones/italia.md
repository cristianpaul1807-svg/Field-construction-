# Italia

**Estado:** en pruebas. No se ofrece a nadie todavía.
**Código:** `shared/paises.ts` (el país), `shared/iva.ts` (el impuesto),
`shared/fiscaleItalia.ts` (Partita IVA y codice fiscale).

---

## Por qué está en pruebas

En Italia **un PDF no es una factura**. La factura válida es un XML
(FatturaPA) que viaja por el Sistema di Interscambio (SDI) de la Agenzia delle
Entrate. Hasta que el producto genere ese XML, ofrecer Italia sería darle a
alguien documentos con aspecto de buenos que su contable tendría que rehacer.

Por eso `IT` lleva `enPruebas: true`: el selector de país no lo enseña, y el
servidor no deja elegirlo (`pais_no_ofrecido`). Sólo lo ve un negocio que ya
lo tenga puesto, que es como se prueba: poniéndoselo a mano en la base de
datos a un negocio de pruebas.

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
`formatCurrency` para todo el panel. En los PDF, la moneda sale del propio
desglose del documento, no del negocio.

### Lo que se esconde

- **Nómina:** fuera del menú (`Pais.nomina`).
- **CCQ:** `aplicaLaCcq` ya exigía Quebec.
- **Textos de ayuda** que hablaban de Quebec tienen su versión italiana.

---

## Fases

1. **País, EUR e IVA.** ✅ Hecho.
2. **XML FatturaPA descargable**, para que el negocio lo suba al SDI con su
   programa o su gestor.
3. **Stripe en euros:** cuentas conectadas italianas, cobros en EUR y precios
   de suscripción italianos (79 €/mes y 790 €/año Chantier, 199 €/mes y
   1.990 €/año Entreprise).
4. **PDFs, textos y web** para el mercado italiano, y legales para la UE.
5. **Envío directo al SDI** con un proveedor (A-Cube, Openapi, Invoicetronic…).

Italia deja de estar en pruebas al terminar la fase 2: es la que hace que sus
facturas sean válidas.

---

## Lo que no se hace, a propósito

- **Régimen forfettario** (facturas sin IVA con marca de bollo). Primero el
  régimen ordinario, que es el grueso del mercado.
- **Split payment** con la administración pública.
- **Nómina italiana.** Un producto entero, y un riesgo legal hecho a medias.
