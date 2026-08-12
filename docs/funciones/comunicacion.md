# Comunicación

**Dónde:** menú → Clientes → Comunicación
**Código:** `client/src/pages/Communication.tsx`,
`client/src/components/chat/`

---

## Para qué sirve

Todos los mensajes del negocio en una pantalla, separados en dos sistemas
porque son dos cosas distintas:

| Pestaña | Con quién | De dónde vienen |
|---|---|---|
| **Sistema público** | Gente que todavía no es cliente | El chat público `/c/tu-negocio` |
| **Sistema interno** | Clientes, empleados y subcontratistas | El portal y la app de campo |

---

## Sistema público

Las conversaciones que entran por tu enlace. Cada una muestra en qué punto del
flujo está el visitante y qué ha respondido.

### Bot o humano

Cada conversación tiene un interruptor:

- **Bot** — el flujo de botones sigue su curso solo.
- **Humano** — tomas el control y escribes tú.

Pásalo a humano cuando alguien pregunta algo que el flujo no cubre. Devuélvelo
a bot para que siga recogiendo los datos que faltan.

### Solicitudes de cita

Si el visitante pidió cita, aparece como pendiente. **Confirmar** crea el
evento en la agenda; **Rechazar** lo descarta. Ver
[chat-publico.md](chat-publico.md#citas).

---

## Sistema interno

La lista de contactos, con su etiqueta:

| Etiqueta | Quién |
|---|---|
| Cliente | Un cliente con portal |
| Trabajador | Un empleado |
| Subcontrato | Un subcontratista |
| General | Otros canales |

Busca por nombre, abre la conversación y escribe.

### Canales que se crean solos

Al dar de alta un empleado o un subcontratista, su canal se abre
automáticamente. No hay que invitar a nadie ni configurar nada: en cuanto
existe, se le puede escribir.

### Selección múltiple

Mantén pulsado (o clic largo) sobre una conversación para entrar en modo
selección, marca varias y bórralas de una vez.

> Este gesto tuvo un fallo que se corrigió: la misma pulsación que entraba en
> modo selección disparaba después el clic normal y deseleccionaba lo que
> acababa de marcar. Ahora la primera pulsación solo selecciona.

---

## Mensajes que desaparecen

Un canal se puede configurar para que sus mensajes se borren solos pasado un
tiempo. Útil en canales operativos donde el histórico no aporta y ocupa.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/chat/channels` | Canales internos |
| `GET /api/chat/channels/:id/messages` | Mensajes |
| `POST /api/chat/channels/:id/messages` | Escribir |
| `PATCH /api/chat/channels/:id` | Modo de control, caducidad |
| `POST /api/chat/channels/bulk-delete` | Borrado múltiple |
| `GET /api/chat/directory` | Contactos disponibles |
| `GET /api/conversations` · `/:id/messages` | Chat público |
| `PATCH /api/conversations/:id` | Bot ↔ humano |

Dos modelos distintos por una razón: `conversations` guarda a alguien que
**todavía no existe** como cliente — solo un visitante con una conversación
abierta. `chat_channels` / `chat_messages` guarda a alguien que ya es cliente,
empleado o subcontratista. Cuando un visitante se convierte en cliente, pasa
de un modelo al otro.

Cada lado tiene sus rutas: `/api/chat/*` para el panel, `/api/client/chat/*`
para el portal, `/api/worker/chat/*` para la app de campo. Las dos últimas van
**por encima** de `requireBusinessAuth` — ver
[../arquitectura.md](../arquitectura.md#el-orden-de-las-rutas-importa).
