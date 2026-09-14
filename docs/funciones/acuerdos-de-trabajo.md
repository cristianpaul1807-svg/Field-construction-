# Acuerdos de trabajo

**Dónde:** en la ficha de cada persona, en Técnicos y equipo y en
Subcontratistas — el botón de la firma
**Código:** `client/src/components/AcuerdosDeTrabajo.tsx`,
`client/src/components/WorkerAgreementBanner.tsx`,
`renderAgreementPdf()` en `server/documents.ts`
**Tabla:** `worker_agreements`

Lo que se acordó con cada empleado y con cada subcontratista: desde cuándo,
cuánto, cada cuánto se le paga y con qué condiciones. Se genera en PDF, se le
manda por la mensajería, y él puede firmarlo desde el móvil.

---

## Por qué existe

El software sabía cuánto cobraba cada uno **por hora** y nada más. Ni desde
cuándo, ni cada cuánto se le paga, ni qué se le prometió. Eso vivía en la
cabeza del contratista, que es exactamente donde se pierde en cuanto hay una
discusión sobre lo que se había dicho.

`documents` no servía para esto: cuelga de una obra y guarda un fichero que
alguien subió. Un acuerdo lo genera el sistema, cuelga de la persona, y tiene
estados.

---

## Qué lleva

| Campo | Para qué |
|---|---|
| Título | Opcional. Si no hay, el documento se llama por su tipo |
| Desde / Hasta | Sin fecha de fin es indefinido, que es lo normal en un empleo |
| Forma de pago | `por_hora`, `fijo` o `por_obra` |
| Importe | Lo acordado. No se rotula «total»: no hay nada que sumar |
| Frecuencia | `semanal`, `quincenal`, `mensual` o `al_terminar` |
| Horas por semana | Opcional |
| Vacaciones (%) | **Sólo en el empleo.** Quebec: 4 % hasta los tres años de servicio, 6 % a partir de ahí |
| Condiciones | Texto libre. Es lo que se imprime como cláusulas |

Un subcontratista **factura**, no cobra vacaciones. Por eso el campo no existe
para él en vez de existir puesto a cero: un cero invita a rellenarlo.

---

## Estados

| Estado | Qué significa |
|---|---|
| `borrador` | Lo estás montando. El trabajador no lo ve |
| `enviado` | Se lo mandaste. **Sólo desde aquí puede firmarlo** |
| `firmado` | Lo firmó desde su móvil |
| `rechazado` | Dijo que no |
| `terminado` | Se acabó |

Un acuerdo **firmado no se edita ni se borra**. Si cambian las condiciones se
hace otro. Poder retocarlo por detrás convertiría la firma en un adorno, y la
firma es precisamente lo único que hace que el papel valga.

---

## Las dos formas de cerrarlo

Las dos existen porque las dos pasan:

1. **Firmado dentro.** Se le manda por la mensajería, le sale un aviso arriba
   del todo en su móvil, lo lee y escribe su nombre. Se guardan **el nombre,
   la hora y la IP**. El PDF pasa a llevar impreso «Firmado por … el …».
2. **Firmado en papel.** Se descarga el PDF y se le manda por donde sea. El
   documento lleva las dos rayas para firmar a mano. El sistema no guarda
   prueba de nada, y eso está bien dicho: el estado sigue siendo `enviado`.

---

## El aviso en el móvil del trabajador

Va **encima de las pestañas**, no dentro. La aplicación de campo tiene tres
—qué le toca, fichar, hablar con la oficina— y son toda su navegación. Una
cuarta pestaña que casi siempre estaría vacía le cobraría a todo el mundo,
todos los días, el sitio de algo que pasa dos veces al año.

Así que aparece cuando hay algo que firmar y desaparece cuando se firma. Si la
llamada falla no pinta nada: un acuerdo pendiente no puede tumbarle la pantalla
de fichar.

---

## Mandárselo

**Mandárselo** lo deja en su conversación, como un adjunto que se abre en PDF.
No se sube ningún fichero: se referencia la fila, así que lo que abra dentro de
seis meses es lo que el sistema tiene escrito.

Si la persona **no tiene conversación abierta**, la ruta contesta
`worker_has_no_channel` en vez de crear un canal que el trabajador no sabe que
existe. Se le abre desde Mensajería y se vuelve a mandar.

---

## Rutas

| Ruta | Quién |
|---|---|
| `GET /api/agreements?employeeId=…` | Panel |
| `POST /api/agreements` | Panel |
| `PATCH /api/agreements/:id` | Panel — 409 si está firmado |
| `PATCH /api/agreements/:id/status` | Panel |
| `DELETE /api/agreements/:id` | Panel — 409 si está firmado |
| `GET /api/agreements/:id/pdf` | Panel |
| `POST /api/agreements/:id/send` | Panel |
| `GET /api/worker/agreements` | Trabajador — sólo enviados en adelante |
| `GET /api/worker/agreements/:id/pdf` | Trabajador — sólo el suyo |
| `POST /api/worker/agreements/:id/sign` | Trabajador |

Las rutas del trabajador comprueban **además** que el acuerdo sea suyo, no sólo
de su negocio: dos compañeros comparten `business_id` y no tienen por qué leer
lo que cobra el otro.

---

## El número

`ACU-2026-0001`, del mismo contador que las facturas y los presupuestos
(`siguiente_numero`, serie `acuerdo-<año>`). Lo pone un trigger al insertar. El
PDF se descarga con ese nombre, no con el uuid.

---

## Qué suele salir mal

**«No encontramos ese acuerdo» al firmar.** El acuerdo no está en `enviado`.
Un borrador no se puede firmar, y uno ya firmado tampoco se vuelve a firmar:
eso pisaría la fecha de la firma que vale.

**El botón de mandar contesta que no hay conversación.** Ábrele una desde
Mensajería. El canal del trabajador nace cuando la oficina le escribe, no
cuando se le da de alta.

**El título se monta encima del nombre de la empresa.** Ya no: `header()` mide
el título y lo encoge hasta que entra en su mitad de la hoja, y si ni al mínimo
entra, lo parte en dos líneas. Pasó con «CONTRAT DE SOUS-TRAITANCE», que es
mucho más largo que «FACTURE».
