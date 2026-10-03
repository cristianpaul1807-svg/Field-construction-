# MCP para trabajadores de campo

## Estado actual

La primera fase del MCP de Field-Construction está preparada como una interfaz HTTP de solo lectura en:

`https://logiciel-construction.com/api/mcp`

La identidad se obtiene del mismo bearer token que ya usa la PWA `/campo`. El servidor resuelve el token contra `employees.access_token_hash` y `subcontractors.access_token_hash`, y siempre conserva el par `worker_id + business_id`. No se acepta un `business_id` enviado por el cliente MCP.

Cada herramienta filtra explícitamente por el negocio y por el trabajador autenticado. Las herramientas de lectura no crean, actualizan ni eliminan información. Desde la Fase B, el propietario principal puede además preparar documentos y emitirlos con su confirmación (ver más abajo); nadie más.

## Política de fases

La **Fase 1 y las primeras fases de lectura** son exclusivamente informativas para todos los roles. Ninguna identidad MCP puede crear, modificar, eliminar ni ejecutar acciones externas. La IA puede resumir, comparar y analizar únicamente los datos que su identidad, rol, plan y asignaciones le permitan consultar.

Esto se aplica a trabajadores, subcontratistas, jefes de obra, oficina, contabilidad, administradores secundarios y propietarios. El hecho de que una persona tenga permisos de escritura dentro del panel web no le concede escritura mediante MCP durante esta fase.

La **Fase B** abre la escritura sólo para el propietario principal que creó la cuenta de empresa, y sólo si al conectar marcó la casilla «preparar y emitir con mi confirmación» (permiso `mcp:write`, desmarcada por defecto). No depende del nombre genérico `admin`: un administrador segundo con el mismo rol sigue en solo lectura, y el permiso se vuelve a comprobar en cada llamada, de modo que si la cuenta cambia de dueño no viaja con la conexión. Los demás roles —trabajadores, subcontratistas, oficina, contabilidad— continúan en solo lectura salvo decisión posterior documentada; ninguna identidad MCP distinta del propietario principal puede crear, modificar ni eliminar nada.

Siguen sin existir herramientas MCP como `clock_in`, `clock_out`, `report_incident`, `create_work_order`, `assign_worker`, `update_work_order`, borrar una factura o sincronizar QuickBooks.

## Herramientas iniciales

| Herramienta | Función |
|---|---|
| `get_my_schedule` | Agenda y órdenes de trabajo del trabajador para una fecha. |
| `get_my_work_orders` | Órdenes asignadas al trabajador, con filtro opcional por estado. |
| `get_my_projects` | Proyectos vinculados por asignación, agenda u orden de trabajo. |
| `get_my_tasks` | Tareas asignadas, con opción de incluir completadas. |
| `get_my_time_entries` | Horas propias registradas, sin posibilidad de modificarlas. |
| `get_my_documents` | Documentos del trabajador marcados explícitamente como visibles. |
| `get_projects` | Proyectos del perímetro de un encargado u oficina, derivados de sus asignaciones. |
| `get_project` | Detalle de un proyecto dentro del perímetro autorizado. |
| `get_project_schedule` | Eventos y órdenes de un proyecto autorizado. |
| `get_work_orders` | Órdenes de los proyectos autorizados, sin modificación. |
| `get_workers` | Equipo vinculado a los proyectos autorizados, sin salarios ni tokens. |
| `get_business_summary` | Resumen agregado para roles de administración u oficina con reportes. |
| `get_invoices` | Facturas del negocio en modo consulta. |
| `get_receivables` | Cuentas por cobrar mediante el reporte financiero existente. |
| `get_expenses` | Gastos registrados, opcionalmente por proyecto. |
| `get_payments` | Pagos recibidos y sus referencias. |
| `get_profitability` | Rentabilidad por obra para el propietario principal. |
| `audit_quickbooks_sync` | Estado y errores de QuickBooks, sin sincronizar. **Sólo en Canadá.** |
| `get_estimates` | Presupuestos del negocio. `total` es antes de impuestos, que es lo que se guarda. |
| `get_clients` | Clientes y contactos, con su Partita IVA o codice fiscale si los tienen. Nunca la llave del portal. |
| `calculate_invoice` | Cuánto sería una factura —impuesto del país, retención, lo que paga el cliente— sin crearla. Usa `calcularFactura`, la misma cuenta que la factura emitida. Canadá e Italia. |
| `get_monthly_hours` | Horas del mes por persona y día, con las ausencias: lo que necesita quien hace la nómina. |
| `get_expiring_documents` | Papeles vencidos o que vencen pronto (DURC, cursos, revisiones médicas…), de todo el equipo. Área de personas. |
| `get_bank_withholdings` | Lo que los bancos retuvieron (11 %) en el año por los pagos de obras con bonus. **Sólo en Italia.** |
| `get_e_invoice` | El XML FatturaPA de una factura o nota de crédito, o lo que falta para generarlo. **Sólo en Italia.** |
| `check_italian_tax_id` | Comprueba una Partita IVA o un codice fiscale con su dígito de control. **Sólo en Italia.** |
| `get_price_list_items` | Busca en el prezzario regional cargado: código, descripción, unidad y precio. **Sólo en Italia.** |

### El país

Cada conexión lleva el país del negocio (`WorkerIdentity.country`). De ahí
salen tres cosas:

- **La moneda.** `get_business_summary` devuelve `business.currency` y el
  sistema de impuestos; las herramientas de dinero añaden `currency` a su
  respuesta. Sin eso Claude adivinaba, y adivinaba dólares.
- **El catálogo.** `TOOL_ACCESS` (`shared/mcpRoles.ts`) puede pedir algo del
  país (`requierePais: "quickbooks"`) o limitar una herramienta a unos países
  (`soloEn: ["IT"]`). Igual que el menú del panel: fuera de Canadá no hay
  QuickBooks en el panel, y tampoco en Claude.
- **El impuesto** de `calculate_invoice`, por `computeInvoiceTax`.

Los títulos y las descripciones de las herramientas van en inglés: los lee el
modelo para decidir cuál usar. Lo que lee la persona es la respuesta de
Claude, que contesta en su idioma.

El servidor aplica la función de acceso y la capacidad de campo del plan antes de ejecutar una herramienta. Cuando el negocio está bloqueado o el plan no incluye el área de campo, responde con un error de autorización y registra el intento.

Las herramientas operativas de encargado exigen un rol reconocido y limitan los resultados a proyectos donde la identidad está vinculada por asignación, agenda u orden. Las herramientas financieras exigen el rol correspondiente y la capacidad del plan. Las de lectura —también las que calculan o comprueban— no guardan nada.

## Fase B: preparar y emitir con confirmación

Siempre en dos pasos, y es lo único que importa:

1. Una herramienta `draft_*` comprueba lo que se pide, lo calcula con la misma función que el panel y guarda un **borrador** en `mcp_acciones` con el resumen exacto: cliente, obra, impuesto del país, retención, lo que paga el cliente, a quién se le avisa. No toca nada más.
2. Sólo `confirm_action`, con el `actionId` de ese borrador, lo ejecuta. Claude lo llama cuando la persona ha dicho que sí. Si cambia de idea, `cancel_action`; si no dice nada, el borrador caduca a los 15 minutos.

| Herramienta | Al confirmar |
|---|---|
| `draft_invoice` | Emite la factura con su número y avisa al cliente, como desde el panel. Canadá e Italia. |
| `draft_invoice_from_progress_claim` | Factura un SAL ya certificado, descontando el anticipo que recupera. Canadá e Italia. |
| `draft_progress_claim` | Certifica un SAL nuevo: % acumulado por partida, a precios del contrato; nunca hacia atrás. |
| `draft_payment` | Marca cobrada una factura (efectivo, transferencia, cheque u otro). |
| `draft_estimate` | Guarda un presupuesto **en borrador** en el panel; no se le manda al cliente. |
| `confirm_action` / `cancel_action` | Ejecutan o descartan un borrador. Cada uno se confirma una sola vez. |

Las garantías, cada una con su prueba en `scripts/prueba-mcp/servidor.mjs`:

- **Preparar no escribe** fuera de `mcp_acciones` y la auditoría. `scripts/check-mcp-readonly.py` sigue prohibiendo cualquier `insert`/`update`/`delete` dentro de `createMcpServer`: la escritura vive en `server/mcpAcciones.ts`.
- **Una confirmación, una factura.** El paso de `awaiting_confirmation` a `running` es un `update` condicionado al estado: si Claude confirma dos veces, la segunda no encuentra el borrador en espera (`action_already_done`).
- **Lo ejecuta el panel.** Los ejecutores se registran desde `server/api.ts` con las funciones de las rutas (`createInvoiceRecord`, `registrarCobro`, `certificarSal`, `facturarSal`), así que lo que el panel rechaza —emitir sin impuesto configurado, cobrar una factura anulada, facturar dos veces un SAL— lo rechaza también la voz.
- **Caducado o cancelado no se ejecuta** (`action_expired`, `action_cancelled`).
- **Sólo con el permiso.** Sin `mcp:write`, o sin ser el propietario principal, las herramientas `draft_*` ni siquiera aparecen en `tools/list` (`escritura: true` en `TOOL_ACCESS`).

`mcp_acciones` tiene RLS activado sin políticas: sólo el servidor la lee y escribe, con el cliente service-role, y cada fila lleva `business_id` y `owner_auth_user_id`.

## Seguridad y borrado

Supabase contiene dos tablas nuevas:

- `mcp_connections`: registra la conexión y su proveedor —hoy sólo Claude se puede completar—, con estado revocable, alcance y referencia a trabajador, subcontratista o propietario principal.
- `mcp_audit_log`: registra negocio, identidad, herramienta, autorización y resultado resumido, sin guardar tokens.

Ambas tablas tienen claves foráneas `ON DELETE CASCADE` hacia `businesses`, `employees` y `subcontractors`. Por tanto, eliminar un negocio elimina sus conexiones y auditorías; eliminar un trabajador elimina únicamente los registros que le pertenecen.

La tabla MCP tiene RLS activado y el servidor utiliza exclusivamente el cliente service-role en backend, nunca desde el navegador. No se debe exponer la service role key ni guardar tokens sin hash.

## OAuth 2.1 y conexión externa

El servidor implementa **OAuth 2.1 Authorization Code con PKCE S256**. Claude descubre automáticamente la autorización mediante:

- `GET /api/.well-known/oauth-protected-resource/mcp`
- `GET /api/.well-known/oauth-authorization-server`
- `POST /api/oauth/register`
- `GET/POST /api/oauth/authorize`
- `POST /api/oauth/token`
- `POST /api/oauth/revoke`

El recurso canónico es `https://logiciel-construction.com/api/mcp`. El alcance por defecto es `mcp:read`; `mcp:write` sólo se concede al propietario principal que marca la casilla de escritura en el consentimiento, y siempre junto a `mcp:read`. Se aceptan redirecciones HTTPS y redirecciones HTTP únicamente para `localhost`.

La autorización abre una pantalla de consentimiento de Field. El trabajador introduce su código de acceso de `/campo`; el propietario principal introduce el email y la contraseña de la cuenta que creó la empresa. Field comprueba la identidad, el vínculo con el negocio, el estado de suscripción y el plan, y después crea una conexión revocable en `mcp_connections`. La contraseña del propietario solo se valida contra Supabase Auth y no se guarda. El código de autorización dura cinco minutos, el access token dura una hora y el refresh token dura treinta días con rotación: cada renovación revoca el token anterior.

Los access tokens, refresh tokens y códigos se almacenan solamente como hashes en `mcp_oauth_tokens` y `mcp_oauth_codes`. El registro de cliente y sus URI exactas se guardan en `mcp_oauth_clients`. La service role key nunca sale del servidor.

Después de la autorización, el cliente MCP envía:

```http
Authorization: Bearer MCP_ACCESS_TOKEN
Content-Type: application/json
```

No se debe pegar un token de trabajador en una conversación de Claude. El token que recibe el cliente externo es el access token OAuth limitado al recurso MCP.

La guía paso a paso para Claude está en [conectar-mcp-claude.md](./conectar-mcp-claude.md). Incluye la URL del servidor, el Client ID específico de Claude y la indicación de dejar vacío el Client Secret.

## Criterios para seguir ampliando

Antes de abrir más escritura se debe comprobar que la lectura funciona con un trabajador de prueba, que un trabajador no puede ver proyectos de otro negocio, que un trabajador eliminado deja de autenticar, que revocar la conexión invalida sus tokens y que el plan bloqueado no recibe datos.

Toda herramienta nueva que cree algo sigue el patrón de la Fase B —borrador, resumen, `confirm_action`— y lleva `escritura: true` en `TOOL_ACCESS`; el guardia lo exige. Todos los demás roles permanecen en solo lectura: ninguna identidad MCP que no sea el propietario principal con `mcp:write` puede ver una herramienta que cree, actualice o elimine datos.
