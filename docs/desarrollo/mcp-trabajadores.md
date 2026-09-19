# MCP para trabajadores de campo

## Estado actual

La primera fase del MCP de Field-Construction está preparada como una interfaz HTTP de solo lectura en:

`https://logiciel-construction.com/api/mcp`

La identidad se obtiene del mismo bearer token que ya usa la PWA `/campo`. El servidor resuelve el token contra `employees.access_token_hash` y `subcontractors.access_token_hash`, y siempre conserva el par `worker_id + business_id`. No se acepta un `business_id` enviado por el cliente MCP.

Cada herramienta filtra explícitamente por el negocio y por el trabajador autenticado. Las herramientas no crean, actualizan ni eliminan información.

## Herramientas iniciales

| Herramienta | Función |
|---|---|
| `get_my_schedule` | Agenda y órdenes de trabajo del trabajador para una fecha. |
| `get_my_work_orders` | Órdenes asignadas al trabajador, con filtro opcional por estado. |
| `get_my_projects` | Proyectos vinculados por asignación, agenda u orden de trabajo. |
| `get_my_tasks` | Tareas asignadas, con opción de incluir completadas. |
| `get_my_time_entries` | Horas propias registradas, sin posibilidad de modificarlas. |
| `get_my_documents` | Documentos del trabajador marcados explícitamente como visibles. |

El servidor aplica la función de acceso y la capacidad de campo del plan antes de ejecutar una herramienta. Cuando el negocio está bloqueado o el plan no incluye el área de campo, responde con un error de autorización y registra el intento.

## Seguridad y borrado

Supabase contiene dos tablas nuevas:

- `mcp_connections`: preparada para registrar futuras conexiones de ChatGPT, Claude u otro proveedor, con estado revocable, alcance y referencia al trabajador.
- `mcp_audit_log`: registra negocio, trabajador, herramienta, autorización y resultado resumido, sin guardar tokens.

Ambas tablas tienen claves foráneas `ON DELETE CASCADE` hacia `businesses`, `employees` y `subcontractors`. Por tanto, eliminar un negocio elimina sus conexiones y auditorías; eliminar un trabajador elimina únicamente los registros que le pertenecen.

La tabla MCP tiene RLS activado y el servidor utiliza exclusivamente el cliente service-role en backend, nunca desde el navegador. No se debe exponer la service role key ni guardar tokens sin hash.

## Conexión técnica provisional

La versión actual usa el token bearer de trabajador como credencial de primera fase. Esto permite validar el modelo con una cuenta real de campo sin crear todavía un flujo OAuth público. El cliente MCP debe enviar:

```http
Authorization: Bearer TOKEN_DEL_TRABAJADOR
Content-Type: application/json
```

La conexión externa de ChatGPT o Claude no debe hacerse todavía con un token pegado en una conversación. El siguiente paso seguro será añadir OAuth 2.1 con autorización por negocio y trabajador, crear el registro correspondiente en `mcp_connections` y permitir revocación desde el panel.

## Criterios para la siguiente fase

Antes de activar acciones de escritura se debe comprobar que la lectura funciona con un trabajador de prueba, que un trabajador no puede ver proyectos de otro negocio, que un trabajador eliminado deja de autenticar y que el plan bloqueado no recibe datos. Después se podrán diseñar herramientas de escritura independientes, con confirmación explícita y auditoría ampliada.
