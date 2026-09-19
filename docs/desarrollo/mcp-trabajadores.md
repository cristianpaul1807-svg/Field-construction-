# MCP para trabajadores de campo

## Estado actual

La primera fase del MCP de Field-Construction está preparada como una interfaz HTTP de solo lectura en:

`https://logiciel-construction.com/api/mcp`

La identidad se obtiene del mismo bearer token que ya usa la PWA `/campo`. El servidor resuelve el token contra `employees.access_token_hash` y `subcontractors.access_token_hash`, y siempre conserva el par `worker_id + business_id`. No se acepta un `business_id` enviado por el cliente MCP.

Cada herramienta filtra explícitamente por el negocio y por el trabajador autenticado. Las herramientas no crean, actualizan ni eliminan información.

## Política de fases

La **Fase 1 y las primeras fases de lectura** son exclusivamente informativas para todos los roles. Ninguna identidad MCP puede crear, modificar, eliminar ni ejecutar acciones externas. La IA puede resumir, comparar y analizar únicamente los datos que su identidad, rol, plan y asignaciones le permitan consultar.

Esto se aplica a trabajadores, subcontratistas, jefes de obra, oficina, contabilidad, administradores secundarios y propietarios. El hecho de que una persona tenga permisos de escritura dentro del panel web no le concede escritura mediante MCP durante esta fase.

La **Fase 2** solo podrá activar autonomía controlada inicialmente para el propietario principal que creó la cuenta de empresa. Esa autorización será independiente del nombre genérico `admin` y deberá comprobar el vínculo de propietario principal, el plan, el estado del negocio, la herramienta concreta y la confirmación explícita de la acción. Los demás roles continuarán en solo lectura salvo decisión posterior documentada.

No se deben implementar todavía herramientas MCP como `clock_in`, `clock_out`, `report_incident`, `create_work_order`, `assign_worker`, `update_work_order`, `create_invoice` o sincronizaciones con QuickBooks. Primero deben completarse y probarse las herramientas de lectura y sus límites de seguridad.

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
| `audit_quickbooks_sync` | Estado y errores de QuickBooks, sin sincronizar. |

El servidor aplica la función de acceso y la capacidad de campo del plan antes de ejecutar una herramienta. Cuando el negocio está bloqueado o el plan no incluye el área de campo, responde con un error de autorización y registra el intento.

Las herramientas operativas de encargado exigen un rol reconocido y limitan los resultados a proyectos donde la identidad está vinculada por asignación, agenda u orden. Las herramientas financieras exigen el rol correspondiente y la capacidad del plan. Todas son de lectura; las herramientas de creación, modificación, envío y sincronización siguen fuera del servidor MCP.

## Seguridad y borrado

Supabase contiene dos tablas nuevas:

- `mcp_connections`: registra conexiones de ChatGPT, Claude u otro proveedor, con estado revocable, alcance y referencia a trabajador, subcontratista o propietario principal.
- `mcp_audit_log`: registra negocio, identidad, herramienta, autorización y resultado resumido, sin guardar tokens.

Ambas tablas tienen claves foráneas `ON DELETE CASCADE` hacia `businesses`, `employees` y `subcontractors`. Por tanto, eliminar un negocio elimina sus conexiones y auditorías; eliminar un trabajador elimina únicamente los registros que le pertenecen.

La tabla MCP tiene RLS activado y el servidor utiliza exclusivamente el cliente service-role en backend, nunca desde el navegador. No se debe exponer la service role key ni guardar tokens sin hash.

## OAuth 2.1 y conexión externa

El servidor implementa **OAuth 2.1 Authorization Code con PKCE S256**. ChatGPT o Claude descubren automáticamente la autorización mediante:

- `GET /api/.well-known/oauth-protected-resource/mcp`
- `GET /api/.well-known/oauth-authorization-server`
- `POST /api/oauth/register`
- `GET/POST /api/oauth/authorize`
- `POST /api/oauth/token`
- `POST /api/oauth/revoke`

El recurso canónico es `https://logiciel-construction.com/api/mcp` y el único alcance de esta fase es `mcp:read`. Se aceptan redirecciones HTTPS y redirecciones HTTP únicamente para `localhost`.

La autorización abre una pantalla de consentimiento de Field. El trabajador introduce su código de acceso de `/campo`; el propietario principal introduce el email y la contraseña de la cuenta que creó la empresa. Field comprueba la identidad, el vínculo con el negocio, el estado de suscripción y el plan, y después crea una conexión revocable en `mcp_connections`. La contraseña del propietario solo se valida contra Supabase Auth y no se guarda. El código de autorización dura cinco minutos, el access token dura una hora y el refresh token dura treinta días con rotación: cada renovación revoca el token anterior.

Los access tokens, refresh tokens y códigos se almacenan solamente como hashes en `mcp_oauth_tokens` y `mcp_oauth_codes`. El registro de cliente y sus URI exactas se guardan en `mcp_oauth_clients`. La service role key nunca sale del servidor.

Después de la autorización, el cliente MCP envía:

```http
Authorization: Bearer MCP_ACCESS_TOKEN
Content-Type: application/json
```

No se debe pegar un token de trabajador en una conversación de ChatGPT o Claude. El token que recibe el cliente externo es el access token OAuth limitado al recurso MCP.

La guía paso a paso para Claude está en [conectar-mcp-claude.md](./conectar-mcp-claude.md). Incluye la URL del servidor, el Client ID específico de Claude y la indicación de dejar vacío el Client Secret.

## Criterios para la siguiente fase

Antes de activar acciones de escritura se debe comprobar que la lectura funciona con un trabajador de prueba, que un trabajador no puede ver proyectos de otro negocio, que un trabajador eliminado deja de autenticar, que revocar la conexión invalida sus tokens y que el plan bloqueado no recibe datos. Después se podrán diseñar herramientas de escritura independientes, con confirmación explícita y auditoría ampliada.

Además, la validación debe confirmar que todos los roles permanecen en solo lectura y que no existe ninguna herramienta MCP registrada cuyo nombre o comportamiento cree, actualice o elimine datos. La autonomía del propietario principal se evaluará únicamente después de cerrar esta batería de pruebas.
