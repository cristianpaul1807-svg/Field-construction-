# La competencia en Italia, y el hueco del MCP

**Mirado:** 1 de octubre de 2026.
**Para qué:** decidir qué construir para Italia, y en qué orden, sabiendo que
el producto se va a usar sobre todo **hablando** —«hazle la factura del
acconto a Bianchi», «¿cuánto me falta por cobrar este mes?», «calcula el IVA
de esta reforma»— a través del MCP, y no tocando pantallas.

---

## 1. Qué usa hoy una impresa edile

Una impresa pequeña (menos de 20 personas, que es el grueso del sector) no
tiene un programa: tiene cuatro o cinco que no se hablan entre sí.

| Para qué | Qué usa | Qué le falta |
|---|---|---|
| Facturar | Fatture in Cloud (TeamSystem), Aruba, Danea Easyfatt, o el commercialista | Saben de facturas, no de obras: no saben qué SAL toca, qué obra va retrasada ni cuánto queda por cobrar de cada una |
| Presupuestos y computo | PriMus (ACCA) en escritorio, myAEDES o Edilizia in Cloud en la nube, Excel con el prezzario regional | El presupuesto vive aparte de la factura y de la obra; se copia a mano |
| Obra (diario, rapportini, presencias) | myAEDES (gratis hasta 3 obras), PlanRadar (inspecciones y planos), Fare Cantiere, WhatsApp | La obra no sabe nada del dinero |
| Seguridad y papeles | Blumatica, CerTus (ACCA), carpetas | Vencimientos que nadie avisa: cursos, revisiones médicas, el DURC |
| Nóminas y Cassa Edile | El consulente del lavoro | — (y está bien que siga así) |
| Empresa grande | TeamSystem (TSE Costruzioni AI, CPM AI): ERP completo | Caro y pensado para empresas estructuradas, no para la de 8 personas |

**TeamSystem es el gigante**: dice tener más de 60.000 empresas de
construcción, y ya vende IA *dentro* de su programa (lee pliegos de licitación
en PDF y convierte computi en datos). Pero es IA **dentro de TeamSystem**: un
asistente que contesta en su pantalla, para empresas que ya pagan su ERP.

**Nadie más tiene un MCP de obra.** Lo que existe son conectores **hechos por
terceros** para facturar desde Claude con Fatture in Cloud o Aruba. Sirven
para «haz una factura», pero no saben qué obra es, qué SAL toca, si el cliente
tiene derecho a una deducción ni cuánto margen queda. En el resto del mundo,
Procore deja que sus agentes creen registros (más de 150 acciones), y
JobTread, Bluebeam o VIABUILD publican servidores MCP; Buildertrend todavía
no tiene uno propio. **En Italia, para la impresa pequeña, el hueco está
vacío.**

---

## 2. Lo que a todos les falta, y que nosotros podemos hacer hablado

Ordenado por lo que más le duele a la impresa y lo que más nos diferencia.

### 2.1 Una sola conversación de punta a punta

> «Hazme el presupuesto de la reforma de los Bianchi con el prezzario de
> Lombardía, 10 % de IVA, y mándaselo para firmar.»
> «Ya firmó. Emite la factura del acconto del 30 %.»
> «¿Qué me queda por cobrar de esa obra?»

Hoy eso son tres programas y un Excel. Con nosotros es la misma obra, el mismo
cliente y el mismo número, de principio a fin. **Esto es el producto**; lo
demás son razones para elegirlo.

### 2.2 La factura electrónica sale de la obra (fases 2 y 5 de Italia)

El XML FatturaPA generado desde la factura que ya existe, con la natura N6.3
cuando es un subcontrato, el CIG/CUP si es obra pública, y la mención de la
deducción cuando corresponde. Al principio se descarga y lo sube el
commercialista; después se envía directo al SDI con un intermediario.

*Hablado:* «Mándale al SDI las facturas de septiembre», «¿alguna factura
rechazada?».

### 2.3 Las deducciones fiscales del cliente (bonus edilizi)

En 2026 la reforma de la primera vivienda deduce el **50 %** y el resto el
**36 %**, hasta 96.000 € por vivienda. Para no perderla, el cliente tiene que
pagar con **bonifico parlante**: transferencia con la ley citada, número y
fecha de factura, su codice fiscale y la Partita IVA de la impresa. La banca le
retiene a la impresa un **11 %** a cuenta.

Nadie se lo prepara al cliente. Nosotros podemos:

- poner en la factura y en el portal **el texto exacto del bonifico**, listo
  para copiar;
- avisar a la impresa de que lo que entra es el 89 % y no el 100 %, y
  conciliar el 11 % como retención y no como impago.

*Hablado:* «¿Qué obras van con bonus?», «¿cuánto me han retenido los bancos
este año?».

### 2.4 La congruità de la mano de obra (DURC di congruità)

Una obra privada de **70.000 € o más** (sin IVA) tiene que demostrar ante la
Cassa Edile que la mano de obra declarada es la que corresponde a ese trabajo.
Sin certificado, no hay saldo final ni, en obras con bonus, deducción para el
cliente.

Nosotros ya tenemos las horas fichadas por obra y el importe de la obra. Lo
que falta es **comparar la incidencia** con la mínima de su tipo de trabajo y
avisar **antes** del final, cuando todavía se puede corregir.

*Hablado:* «¿Alguna obra por encima de 70.000 sin la congruità en regla?».

### 2.5 La patente a crediti y los papeles de seguridad

Desde octubre de 2024 la empresa que trabaja físicamente en obra necesita la
**patente a crediti**: 30 créditos de partida y por debajo de 15 no puede
trabajar. Sin ella, la multa es del 10 % del valor de los trabajos (mínimo
6.000 €). Desde 2026 hay que **subir las pruebas** (cursos, compras de EPI),
no basta una autocertificación.

Lo mismo con la **tessera di riconoscimento** de cada trabajador (foto, datos,
empresa, fecha de alta, y la autorización si es subcontrato) y el badge de
obra digital que llega con el SIISL.

Ya tenemos **Papeles** por persona. Falta que cada papel tenga **fecha de
caducidad** y que alguien avise: el curso de seguridad que vence, el DURC del
subcontratista que caduca en 120 días.

*Hablado:* «¿Qué vence este mes?», «¿Puedo meter a la empresa de Rossi en la
obra de Via Roma?» → DURC, patente y tessera en una respuesta.

### 2.6 Computo metrico con prezzario regional y SAL

El presupuesto italiano serio es un **computo metrico estimativo** con las
partidas del prezzario de la región, y la obra se cobra por **SAL** (stato
avanzamento lavori). myAEDES y Edilizia in Cloud ya lo hacen; nosotros no.

Es la pieza más grande de esta lista. Va **después** de la factura electrónica,
pero sin ella no entramos en obras medianas ni en obra pública.

*Hablado:* «Saca el SAL 2 de Via Roma al 40 %», «¿Cuánto llevo certificado?».

---

## 3. Lo mismo para cada país

La idea no cambia de un país a otro: **cada país tiene su factura, su
impuesto y sus papeles**, y la conversación tiene que saberlo sin que nadie se
lo diga.

| | Canadá (Quebec) | Italia | España (siguiente) | Francia |
|---|---|---|---|---|
| Factura válida | PDF con TPS/TVQ y RBQ | XML FatturaPA por el SDI | **Verifactu**: sociedades desde el 1-1-2027, autónomos desde el 1-7-2027 | Factur-X: todos **reciben** desde el 1-9-2026, la pyme **emite** desde el 1-9-2027 |
| Impuesto | Provincia | Obra (22/10/4, N6.3) | IVA 21/10 % + inversión del sujeto pasivo en subcontrata | TVA 20/10/5,5 % + autoliquidation |
| Lo que retiene alguien | Holdback 10 % | Ritenuta a garanzia; 11 % del banco con bonus | — | Retenue de garantie 5 % |
| Organismo del sector | CCQ (informe mensual) | Cassa Edile, congruità | Fundación Laboral, TPC | CIBTP (vacaciones) |
| Permiso de la empresa | Licencia RBQ | Patente a crediti | REA (Registro de Empresas Acreditadas) | Assurance décennale |
| Contabilidad | QuickBooks | Commercialista | Gestoría | Expert-comptable |

España y Francia tienen su factura electrónica obligatoria a uno o dos años
vista: la impresa de allí va a cambiar de programa de todos modos. **Ése es el
momento de estar.**

---

## 4. Lo que hay que cambiar en el MCP para que todo esto sea hablado

El MCP hoy es **sólo lectura** (18 herramientas) y **no sabe de países**:

- devuelve importes **sin moneda**; Claude tiene que adivinar si son dólares o
  euros;
- `get_invoices` no devuelve el desglose del impuesto, así que no puede decir
  cuánto IVA o cuánta TVQ lleva una factura;
- `audit_quickbooks_sync` aparece también para un negocio italiano;
- los títulos de las herramientas están mezclados en francés y castellano.

El plan detallado está en [plan-maestro-mcp.md](plan-maestro-mcp.md), sección
11.

---

## Fuentes

- [TeamSystem Construction: TSE Costruzioni AI y CPM AI](https://www.teamsystem.com/construction/gestione-imprese/)
- [Funciones de TeamSystem CPM AI](https://www.teamsystem.com/construction/project-management/funzionalita/)
- [myAEDES: qué hace y para quién](https://www.myaedes.com/blog/gestionale-cantieri-edili-software-e-app/)
- [Edilizia in Cloud: presupuesto, SAL y factura electrónica](https://www.ediliziaincloud.com/funzionalita/preventivi-edilizia/)
- [Los mejores programas de construcción en Italia (PlanRadar)](https://www.planradar.com/it/migliori-software-edilizia-italia/)
- [Conector MCP de Fatture in Cloud, hecho por terceros](https://github.com/aringad/fattureincloud-mcp)
- [Conector MCP de Aruba Fatturazione Elettronica](https://anythingmcp.com/marketplace/aruba-fatturazione)
- [MCP y programas de construcción en 2026 (Procore, Buildertrend…)](https://constructable.ai/blog/construction-mcp-server-integration)
- [Patente a crediti: guía actualizada](https://www.edafos.it/patente-a-crediti-in-cantiere-edile-come-funziona/)
- [Patente a crediti y decreto Sicurezza 2026 (IPSOA)](https://www.ipsoa.it/documents/quotidiano/2026/02/17/patente-crediti-decreto-sicurezza-cambia-imprese)
- [DURC di congruità: FAQ de la CNCE](https://www.lavoripubblici.it/news/durc-congruita-faq-cnce-27087)
- [DURC di congruità por encima de 70.000 € (Il Sole 24 Ore)](https://ntplusfisco.ilsole24ore.com/art/durc-congruita-necessario-se-singolo-appalto-supera-70mila-euro-AEtRhGoC)
- [Bonus ristrutturazione 2026: 50 % y 36 %](https://www.studiomadera.it/news/70-detrazioni)
- [Bonifico parlante 2026](https://www.dove.it/guida/bonifico-parlante-2026-come-compilarlo-per-la-detrazione/cmoh89boqlw4v07te24lpqbmq)
- [Badge de obra y tessera di riconoscimento](https://www.edilportale.com/news/2026/01/sicurezza/badge-digitale-nei-cantieri-e-sicurezza-cosa-cambia_108688_22.html)
- [Prezzari regionales para el computo metrico](https://www.myaedes.com/blog/prezzari-regionali-per-lavori-pubblici/)
- [Verifactu aplazado a 2027](https://www.infobae.com/espana/2025/12/02/hacienda-aplaza-hasta-2027-la-obligacion-de-facturar-con-verifactu-para-autonomos-y-pymes/)
- [Calendario de la factura electrónica en Francia](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/facturation-electronique-dates-cles-et-calendrier)
