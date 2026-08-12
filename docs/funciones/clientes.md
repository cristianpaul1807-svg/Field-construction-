# Clientes: CRM y Portal del cliente

---

## CRM

**Dónde:** menú → Clientes → CRM
**Código:** `client/src/pages/Crm.tsx`, `ClientDetail.tsx`

### Para qué sirve

Es la lista de todo el que te ha contactado alguna vez, con su estado en el
embudo de ventas. Un contacto no se pierde porque se te olvidó apuntarlo: si
llegó por el chat público, entra solo.

### El embudo

Cinco estados, en orden:

| Estado | Qué significa |
|---|---|
| `nuevo` | Ha contactado, todavía no le has presupuestado |
| `cotizado` | Le has enviado un presupuesto |
| `negociando` | Está discutiendo precio o alcance |
| `ganado` | Aceptó — hay obra |
| `perdido` | No salió |

Las cinco tarjetas de arriba filtran la lista. Sirven también como resumen:
si tienes veinte en `cotizado` y dos en `ganado`, ahí tienes un problema de
seguimiento, no de captación.

### Paso a paso

**Añadir un contacto a mano**

1. **Nuevo contacto**.
2. Nombre (lo único obligatorio), y teléfono, correo y dirección si los
   tienes.
3. **Crear**. Entra como `nuevo`.

**Mover a alguien por el embudo**

1. Pulsa el lápiz al final de su fila.
2. Cambia **Estado**, y de paso corrige lo que haga falta.
3. **Guardar**.

**Ver su ficha completa**

Pulsa el nombre. Ahí están sus proyectos, sus presupuestos, sus facturas y su
conversación.

### De dónde vienen los contactos

- **Chat público**: el visitante termina el flujo y el cliente se crea solo,
  con un presupuesto en borrador ya asociado ([guía](chat-publico.md)).
- **A mano**: cuando te llaman por teléfono o te los recomienda alguien.

### Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/clients` | La lista |
| `POST /api/clients` | Alta |
| `PATCH /api/clients/:id` | Editar, incluido `leadStatus` |
| `GET /api/clients/:id` | La ficha completa |
| `POST /api/clients/:id/access-token` | Genera su código de acceso al portal |

`lead_status` guarda el slug en español. Se traduce solo al mostrarlo, con
`t(\`crm.status.${valor}\`)` — nunca al escribir.

---

## Portal del cliente

**Dónde:** el cliente entra en `tu-dominio/portal`. Tú lo previsualizas en
menú → Clientes → Portal del cliente.
**Código:** `client/src/pages/ClientPortalMe.tsx` (el real),
`ClientPortal.tsx` (tu vista previa)

### Para qué sirve

Es lo que ve tu cliente: el avance de su obra, su presupuesto, sus facturas y
un chat contigo. Le quita de encima la llamada de "¿cómo va lo mío?" — y a ti
también.

### Cómo entra tu cliente

**Sin correo ni contraseña.** Tú generas un código desde su ficha en el CRM y
se lo pasas por donde ya habláis. Con eso entra.

1. CRM → abre el cliente → **Generar código de acceso**.
2. Cópialo y mándaselo.
3. Él abre `tu-dominio/portal` y lo escribe.

Si además tiene cuenta con correo (porque aceptó un presupuesto y el sistema
se la creó), también puede entrar así. Las dos puertas llevan al mismo sitio.

Generar un código nuevo **invalida el anterior**. Es la forma de revocar el
acceso.

### Qué puede hacer ahí

- **Ver el avance** de su proyecto, con la barra que tú actualizas desde el
  hub del proyecto.
- **Descargar su presupuesto** en PDF ([guía](documentos-pdf.md)).
- **Aceptar el presupuesto** — pero solo uno que tú ya hayas marcado como
  enviado. Un borrador que estás afinando no se le puede aceptar por detrás.
- **Aprobar o rechazar órdenes de cambio** ([guía](proyectos.md#órdenes-de-cambio)).
- **Pagar** el depósito o la factura pendiente con tarjeta
  ([guía](pagos-stripe.md)).
- **Escribirte** por el chat.
- **Ver las fotos** que tú hayas marcado como visibles
  ([guía](documentos-y-fotos.md#galería-de-fotos)).

Lo que **no** ve: tus costes, tus márgenes, tus proveedores, ni las líneas del
presupuesto que hayas marcado como internas.

### Por dentro

| Ruta | Qué hace |
|---|---|
| `POST /api/client-auth/login` | Entrar con código |
| `GET /api/client-portal/me` | Todo lo que ve en su pantalla |
| `GET /api/client-portal/estimates/:id/pdf` | Su presupuesto |
| `POST /api/client-portal/estimates/:id/accept` | Aceptarlo |
| `GET /api/client-portal/change-orders` | Sus órdenes de cambio |
| `POST /api/client-portal/change-orders/:id/decide` | Aprobar o rechazar |
| `POST /api/client/invoices/:id/checkout` | Pagar |

Todas estas rutas van **por encima** de `requireBusinessAuth` en
`server/api.ts`. Si una acaba por debajo, devuelve 401 aunque el código sea
correcto — ver
[../arquitectura.md](../arquitectura.md#el-orden-de-las-rutas-importa).

Un cliente que entró por código no tiene `auth.uid()`, así que estas rutas
usan el cliente administrador y comprueban a mano que cada fila es suya antes
de tocarla. Devuelven **404**, no 403: confirmar que algo existe pero no es
tuyo ya es filtrar información.
