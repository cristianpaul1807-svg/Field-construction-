# Pruebas de Fase 1: MCP de solo lectura

## Objetivo

La Fase 1 valida que MCP pueda informar sin modificar datos. La prueba no considera suficiente que una herramienta devuelva una respuesta correcta: también debe demostrar que la identidad no puede ampliar su negocio, trabajador, asignaciones ni plan.

## Invariantes automáticas

El comando siguiente debe ejecutarse antes de integrar cualquier cambio MCP:

```bash
pnpm check:mcp-readonly
```

El comando comprueba que todas las herramientas registradas son de lectura, que no hay mutaciones dentro de los handlers MCP, que cada consulta contiene el filtro `business_id`, que OAuth solo usa `mcp:read` y que la política de fase está documentada.

La auditoría de accesos puede escribir en `mcp_audit_log`; esa escritura técnica no es una acción de negocio y no concede ningún permiso adicional.

## Matriz de pruebas de comportamiento

| Caso | Identidad | Resultado esperado | Estado |
|---|---|---|---|
| Consulta de agenda propia | Trabajador activo | Devuelve solo eventos y órdenes asignados a ese trabajador | Pendiente de ejecutar con datos de prueba |
| Consulta de órdenes propias | Trabajador activo | No devuelve órdenes de otro trabajador | Pendiente de ejecutar con datos de prueba |
| Consulta de proyectos propios | Trabajador activo | Solo devuelve proyectos vinculados por asignación, agenda u orden | Pendiente de ejecutar con datos de prueba |
| Consulta de horas propias | Trabajador activo | Solo devuelve fichajes del trabajador autenticado | Pendiente de ejecutar con datos de prueba |
| Consulta de documentos | Trabajador activo | Solo devuelve documentos con `visible_to_worker = true` | Pendiente de ejecutar con datos de prueba |
| Lectura de proyectos | Encargado u oficina | Solo devuelve proyectos vinculados por asignación, agenda u orden | Pendiente de ejecutar con datos de prueba |
| Detalle fuera de perímetro | Encargado u oficina | Devuelve `project_out_of_scope` y no revela si existe | Pendiente de ejecutar con datos de prueba |
| Lectura de equipo | Encargado u oficina | Solo devuelve personas vinculadas a proyectos autorizados y nunca salarios o tokens | Pendiente de ejecutar con datos de prueba |
| Lectura financiera | Administración u oficina | Requiere el rol y la capacidad del plan correspondiente | Pendiente de ejecutar con datos de prueba |
| Rentabilidad | Propietario principal | Devuelve el reporte existente, sin escritura | Pendiente de ejecutar cuando exista identidad de propietario MCP |
| QuickBooks | Administración autorizada | Solo devuelve estado, errores y divergencias; no sincroniza | Pendiente de ejecutar con conexión contable |
| Negocio distinto | Token de trabajador A | Nunca devuelve filas del negocio B | Pendiente de ejecutar con dos negocios |
| Plan sin capacidad `campo` | Trabajador de negocio restringido | Devuelve `plan_capability_required` y registra rechazo | Pendiente de ejecutar con plan de prueba |
| Negocio bloqueado | Trabajador de negocio bloqueado | Devuelve `business_access_blocked` | Pendiente de ejecutar con suscripción bloqueada |
| Token inválido o caducado | Cualquier cliente | Devuelve 401 sin consultar datos | Pendiente de ejecutar |
| Conexión revocada | OAuth revocado | El token deja de resolver identidad | Pendiente de revisar en la etapa de conexiones |
| Trabajador eliminado | Token de trabajador eliminado | El token deja de autenticar | Pendiente de ejecutar con datos de prueba |
| Intento de escritura | Cualquier rol | No existe herramienta MCP de escritura | Protegido por comprobación estática |

## Alcance de esta fase

Durante esta fase no se implementan `clock_in`, `clock_out`, `report_incident`, `create_work_order`, `assign_worker`, `update_work_order`, `create_invoice` ni sincronizaciones con QuickBooks mediante MCP. Los roles distintos del propietario principal permanecen en solo lectura.

Las herramientas de administración que ya están registradas son únicamente de consulta: `get_business_summary`, `get_invoices`, `get_receivables`, `get_expenses`, `get_payments`, `get_profitability` y `audit_quickbooks_sync`. Su disponibilidad efectiva todavía depende de que la conexión MCP de negocio y la identidad de propietario se revisen en la siguiente etapa.

Las pruebas con OAuth y clientes externos se realizarán en una etapa separada, después de cerrar la implementación interna y revisar las conexiones.

## Criterio de cierre

La Fase 1 queda cerrada cuando el comando automático pasa, `pnpm check` y `pnpm build` pasan, y la matriz de comportamiento se ejecuta con datos de prueba que cubran dos negocios, dos trabajadores, un negocio bloqueado, un plan sin `campo`, una conexión revocada y un trabajador eliminado.
