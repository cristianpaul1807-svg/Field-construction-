# Plan maestro del MCP de Logiciel Construction

**Fecha de actualización:** 20 de septiembre de 2026  
**Repositorio revisado:** `main`  
**Commit revisado:** `4872d52` (`UI: Add loading state to MCP OAuth form`)

## 1. Propósito de este documento

Este archivo resume el trabajo realizado, el modelo de seguridad acordado y todo lo que falta para completar el MCP de Logiciel Construction para trabajadores, subcontratistas, jefes de obra, oficina, contabilidad, propietarios principales, administradores secundarios y clientes. Su objetivo es servir como documento de transferencia cuando el trabajo continúe desde un proyecto MCP independiente con las herramientas de conexión habilitadas.

La regla principal sigue siendo que **la IA del cliente pertenece al usuario**. Claude aporta su propia capacidad de inteligencia artificial; Logiciel Construction solo entrega una conexión segura a los datos permitidos por la identidad, el rol, el plan, el negocio y las asignaciones de esa persona.

## 2. Estado ejecutivo

La conexión remota MCP de Claude ya fue integrada y probada en producción hasta la emisión OAuth. Se verificaron y corrigieron el endpoint público `/mcp`, OAuth 2.1 con PKCE, el formulario de consentimiento, la validación del código del trabajador, la normalización del proveedor `claude` y la reutilización de conexiones por trabajador. El endpoint que debe usar Claude es:

```text
https://logiciel-construction.com/mcp
```

La primera fase funcional de MCP es de **solo lectura**. El servidor dispone actualmente de 18 herramientas registradas y el comprobador estático confirma que no registran mutaciones de negocio.

El repositorio también contiene una base inicial de Fase 2: filtrado de herramientas por rol y plan, autorización del propietario principal, pantalla de conexiones MCP, revocación de conexiones, una matriz genérica de niveles de acción y tres archivos de herramientas administrativas más avanzadas. Esos tres archivos avanzados son todavía diseños/prototipos: contienen lógica simulada o comentarios de integración pendiente y no deben presentarse como funciones productivas terminadas.

## 3. Lo que ya está implementado

### 3.1 Transporte y autenticación externa

El servidor MCP utiliza HTTP streamable mediante `@modelcontextprotocol/sdk` y `StreamableHTTPServerTransport`. La ruta pública principal es `/mcp`; `/api/mcp` permanece como compatibilidad para clientes anteriores.

La autorización externa utiliza OAuth 2.1 Authorization Code con PKCE S256. Están implementados:

- descubrimiento del recurso protegido;
- metadata del servidor de autorización;
- registro dinámico de clientes;
- Client Metadata Document para identidades publicadas de Claude;
- pantalla de consentimiento alojada por Logiciel Construction;
- validación del código de acceso de trabajador;
- autorización del propietario principal mediante sus credenciales de cuenta;
- códigos OAuth de vida corta;
- access tokens con expiración;
- refresh tokens con rotación;
- revocación de conexiones;
- asociación de la conexión al negocio y a la identidad autorizada;
- aceptación del formulario OAuth enviado como `application/x-www-form-urlencoded`;
- compatibilidad con variantes de Claude que omiten `state` o `resource`.

Los tokens y códigos se almacenan únicamente como hashes. No se debe enviar el token de trabajador a Claude ni a una conversación: el cliente externo recibe un access token OAuth limitado al recurso MCP.

### 3.2 Identidad y aislamiento

La identidad de trabajadores y subcontratistas se obtiene de los hashes existentes en `employees.access_token_hash` y `subcontractors.access_token_hash`. La conexión conserva el vínculo entre identidad y `business_id`; el cliente MCP no puede enviar un `business_id` para ampliar el perímetro.

Para el propietario principal existe una ruta OAuth separada que comprueba la cuenta que creó el negocio. El propietario no debe confundirse con un nombre genérico de rol administrativo: debe mantenerse la comprobación del vínculo real de propietario principal.

La resolución comprueba el plan, el estado de suscripción y el acceso operativo. Si el negocio está bloqueado, la herramienta no devuelve datos operativos. Si el trabajador se elimina o se revoca la conexión, los tokens dejan de resolver una identidad válida.

### 3.3 Herramientas de lectura productivas

Las 18 herramientas registradas actualmente son:

| Área | Herramientas | Estado |
|---|---|---|
| Trabajador o subcontratista | `get_my_schedule`, `get_my_work_orders`, `get_my_projects`, `get_my_tasks`, `get_my_time_entries`, `get_my_documents` | Implementadas como lectura con filtros de identidad y negocio |
| Jefe de obra, oficina o propietario | `get_projects`, `get_project`, `get_project_schedule`, `get_work_orders`, `get_workers` | Implementadas con perímetro derivado de asignaciones, agenda u órdenes; el propietario puede ver su negocio |
| Administración | `get_business_summary` | Lectura agregada para propietario principal |
| Facturación y reportes | `get_invoices`, `get_receivables`, `get_expenses`, `get_payments` | Lectura protegida por rol y capacidad del plan |
| Rentabilidad | `get_profitability` | Solo propietario principal y plan con capacidad correspondiente |
| Contabilidad | `audit_quickbooks_sync` | Consulta estado, errores y divergencias; no sincroniza |

Cada herramienta aplica una segunda comprobación dentro del handler, además de ocultar del listado las herramientas que la identidad no puede utilizar. Los resultados están limitados por negocio, identidad, asignación, rol y capacidad del plan.

### 3.4 Auditoría y conexiones

Las tablas MCP principales son:

- `mcp_connections`: conexiones externas revocables, proveedor, sujeto externo, alcance, identidad, negocio y estado;
- `mcp_audit_log`: herramienta solicitada, negocio, identidad, autorización y detalle resumido sin tokens;
- `mcp_oauth_clients`: clientes OAuth y sus URI exactas;
- `mcp_oauth_codes`: códigos de autorización hashados y de corta duración;
- `mcp_oauth_tokens`: access y refresh tokens hashados, expiración y revocación.

La aplicación incluye la pantalla `SettingsMcpConnections.tsx`, que muestra URL MCP, alcance `mcp:read`, estado OAuth, conexiones activas y la acción de revocar. La revocación está limitada al negocio y al propietario autenticado que administra esa conexión.

La interfaz enseña **sólo Claude**, que es la única que hoy se puede conectar de punta a punta. El backend normaliza el proveedor como `claude` u `other`, que es lo único con lo que se decide algo.

El día que haya otra se añade entonces, con su Client ID registrado, su retorno propio y una conexión completada de verdad. Nombrar una plataforma en una pantalla es prometerla.

## 4. Modelo de roles y planes

### Roles operativos previstos

- **Propietario principal:** la persona que creó la cuenta y el negocio. Es la única identidad que puede recibir autonomía controlada en una fase posterior, siempre con confirmación explícita.
- **Administrador secundario:** administración interna sin equivalencia automática al propietario principal.
- **Oficina:** proyectos, equipo y reportes operativos dentro del perímetro autorizado; algunas funciones financieras según plan.
- **Contabilidad o financiero:** facturas, pagos, gastos, cuentas por cobrar, rentabilidad o estado contable según capacidades del plan.
- **Jefe de obra o encargado:** proyectos, agenda, órdenes y equipo de los proyectos vinculados por asignación.
- **Trabajador de campo:** agenda, órdenes, proyectos, tareas, horas y documentos visibles propios.
- **Subcontratista:** perímetro equivalente al trabajador, siempre filtrado por su propia identidad y asignaciones.
- **Cliente:** portal de cliente y sus propios documentos, proyectos, facturas o pagos cuando se implemente su identidad MCP específica.

### Capacidades del plan

La autorización no depende solo del rol. También se debe comprobar la capacidad del plan mediante `shared/planes.ts`. Las capacidades usadas por las herramientas actuales incluyen `campo`, `facturacion`, `reportes`, `contabilidad` y `margen`.

El plan `pilot` conserva acceso activo según las reglas actuales del producto. Los planes comerciales principales son `chantier` y `entreprise`. El acceso bloqueado conserva únicamente las áreas que el producto ha definido como abiertas para suscripción, autenticación, exportación y soporte; el MCP no debe convertirse en una vía para saltarse ese bloqueo.

## 5. Trabajo pendiente para completar el MCP

### Prioridad 0: cerrar la base actual antes de ampliar funciones

1. **Corregir el error de TypeScript actual.** `pnpm check:mcp-readonly` pasa correctamente, pero `pnpm check` falla en `client/src/pages/SettingsUsers.tsx` porque se envía el tono `critical` a `StatusBadge`, cuyo tipo `StatusTone` no lo acepta. Debe corregirse sin alterar la lógica MCP.
2. **Ejecutar la matriz de pruebas con datos reales de prueba.** El archivo `docs/desarrollo/mcp-fase1-pruebas.md` define casos para dos negocios, dos trabajadores, negocio bloqueado, plan sin `campo`, conexión revocada, trabajador eliminado y token inválido. La mayoría sigue marcada como pendiente.
3. **Probar cada rol con una cuenta controlada.** No basta con que la herramienta esté escondida de `tools/list`; también hay que intentar invocarla directamente y verificar el rechazo.
4. **Verificar el aislamiento de clientes.** El rol cliente todavía no está completo como identidad MCP equivalente a trabajador y propietario. Debe definirse su tabla, sujeto OAuth, perímetro y catálogo de herramientas antes de anunciarlo.
5. **Actualizar la documentación antigua.** Algunos párrafos todavía mencionan `/api/mcp` como recurso canónico, aunque Claude debe utilizar `/mcp`. La documentación transferida debe tomar `/mcp` como URL principal y dejar `/api/mcp` como compatibilidad.

### Resuelto: la identidad del propietario tenía dos reglas

El formulario de consentimiento aceptaba a un dueño por **dos** caminos —ser
`businesses.primary_auth_user_id`, o ser un usuario activo del negocio—, pero
la resolución del token en cada llamada exigía **sólo el primero**.

Un segundo administrador pasaba el consentimiento, recibía su código, canjeaba
su token, y entonces cada llamada MCP resolvía `null` y devolvía 401. Claude lo
lee como token caducado: refresca, reintenta, vuelve a fallar. En la base
quedaron **27 tokens emitidos y 25 revocados en 45 minutos**, todos de la misma
persona. Desde fuera se veía como «Logiciel no responde», que es el síntoma que
no lleva a la causa. El trabajador nunca lo notó porque no pasa por esa rama.

Ahora hay **una sola función**, `resolveOwnerIdentity()` en `server/mcp.ts`, y
la usan los dos lados. Lo que valida un acceso es lo mismo que lo concedió.

Y de paso se corrigió el rol: «sin rol asignado» se traducía por `tecnico`, que
en MCP es un trabajador de campo. En el panel significa lo contrario —
`shared/permisos.ts` trata `areas === null` como «sin límite»—, así que esa
persona veía en Claude *menos* de lo que ya tiene en su pantalla. La regla
permanente de este documento leída en su otra dirección: una conexión MCP no
puede ampliar lo que alguien ya ve, pero tampoco tiene por qué recortarlo.

Queda pendiente lo de abajo, que es lo mismo un escalón más arriba: derivar el
rol MCP de las **áreas** de `shared/permisos.ts` en vez de comparar el nombre
del rol con expresiones regulares en `roleOf()`.

### Prioridad 1: consolidar el modelo de permisos

6. Unificar `server/mcp/roles.ts`, la resolución de identidad de `server/mcp.ts` y `shared/planes.ts`. Actualmente existe una matriz genérica de niveles de acción (`admin`, `financial`, `site_manager`, `worker`) y, además, una matriz concreta MCP con `admin`, `office`, `manager` y trabajador. Debe existir una sola fuente de verdad para evitar que un rol tenga un permiso en una capa y otro permiso diferente en otra.
7. Definir explícitamente el mapa producto → rol MCP. No se debe inferir `admin` desde cualquier usuario con permisos de escritura en el panel.
8. Definir las capacidades exactas de cada plan para cada herramienta, incluyendo qué queda disponible durante prueba, impago, cancelación y bloqueo.
9. Decidir si clientes, administradores secundarios y contabilidad usarán sus propios tokens de acceso o el OAuth de la cuenta principal. La recomendación de seguridad es identidad propia y conexión revocable propia.
10. Añadir límites de volumen, paginación y protección contra consultas amplias para propietarios y roles administrativos.

### Prioridad 2: hacer productivas las herramientas administrativas

Los archivos siguientes existen, pero todavía son prototipos y no deben activarse sin integración real:

- `server/mcp/tools/generateQuarterlyInvoicePackage.ts`;
- `server/mcp/tools/importHistoricalData.ts`;
- `server/mcp/tools/prepareCcqReport.ts`.

Antes de activarlos hay que:

11. Sustituir datos simulados por consultas reales a Supabase y por los generadores de documentos existentes.
12. Guardar la máquina de estados en Supabase, no en un `Map` en memoria. El archivo `server/mcp/stateMachine.ts` es actualmente un esqueleto que se pierde al reiniciar el servidor.
13. Crear tablas de acciones MCP, confirmaciones, resultados, documentos generados y errores.
14. Asegurar que una URL de descarga esté firmada, limitada al negocio y con expiración.
15. Impedir que un borrador se interprete como una presentación oficial a la CCQ, Revenu Québec, ARC o cualquier organismo externo.
16. Mantener separado el trabajo de preparación de documentos de la presentación externa. La presentación debe ser manual al principio.
17. No importar datos históricos directamente en la primera ejecución: primero analizar, mostrar previsualización, pedir confirmación explícita y permitir cancelar.

## 6. Fase de escritura y acciones controladas

La escritura no debe activarse para todos los roles de una vez. El orden previsto es:

1. **Solo lectura cerrada y auditada para todos los roles.**
2. **Propietario principal únicamente:** acciones de bajo riesgo con confirmación explícita, como preparar un documento, generar una exportación o crear un borrador no enviado.
3. **Propietario principal con doble confirmación:** acciones que modifiquen datos internos, siempre mostrando el resumen exacto, registros afectados y efecto esperado antes de ejecutar.
4. **Roles de oficina, financiero y jefe de obra:** acciones limitadas y específicas solo después de demostrar que la lectura y los perímetros son correctos.
5. **Trabajadores y subcontratistas:** acciones operativas independientes como fichaje o reporte, con límites propios, sin acceso a facturación ni administración.
6. **Clientes:** nunca deben recibir herramientas internas de administración; sus acciones se limitan a su portal, solicitudes, documentos y pagos según el producto.

La máquina de estados prevista es:

```text
requested
  → validated
  → awaiting_confirmation
  → running
  → completed
```

También debe soportar `failed`, `partially_completed`, `cancelled`, `exported` y `submitted_externally_by_user`. Toda transición debe quedar persistida y auditada. Una acción no debe saltar de `requested` a una modificación real sin validación y confirmación cuando corresponda.

Las primeras acciones que **no** deben activarse todavía son:

- `clock_in` y `clock_out`;
- `report_incident`;
- `create_work_order`;
- `assign_worker`;
- `update_work_order`;
- `create_invoice`;
- enviar facturas o mensajes externos;
- sincronizar o modificar QuickBooks;
- presentar declaraciones oficiales;
- borrar datos;
- cambiar suscripción, facturación, permisos o seguridad de cuenta.

## 7. Conectores e integraciones que deben revisarse

### Claude

Ya probado hasta autorización OAuth con el endpoint público `/mcp`. Debe conservarse el flujo de Client ID manual y la identidad publicada de Claude como alternativas. Falta repetir una prueba completa de llamada MCP posterior al callback y verificar renovación y revocación desde la cuenta real.

### QuickBooks

La integración existente de QuickBooks debe permanecer separada. MCP solo consulta el estado, errores y divergencias en esta fase. No debe sincronizar ni corregir registros automáticamente.

### Stripe

Stripe es la integración de suscripciones, pagos y facturación de la plataforma. MCP puede consultar datos autorizados cuando una herramienta financiera esté permitida, pero no debe cambiar planes, emitir reembolsos, modificar facturación ni ejecutar pagos.

### Resend y correo

Los correos de suscripción, prueba, suspensión y cancelación pertenecen al proceso interno de la aplicación. No deben exponerse como herramienta MCP de envío sin una política separada de destinatarios, plantillas, confirmación y auditoría.

### Supabase

Supabase es la capa de persistencia interna, no un conector que deba entregarse al cliente. La service role key nunca debe salir del backend ni llegar a la IA del cliente.

## 8. Criterio de aceptación antes de la siguiente fase

La fase de lectura se considera cerrada cuando se cumpla todo lo siguiente:

- `pnpm check:mcp-readonly` pasa;
- `pnpm check` pasa;
- `pnpm build` pasa;
- las 18 herramientas aparecen solo para las identidades autorizadas;
- dos negocios no pueden cruzar datos;
- un trabajador no puede consultar datos de otro trabajador;
- un encargado no puede consultar proyectos fuera de su perímetro;
- un rol financiero no obtiene herramientas de campo que no le correspondan;
- el plan sin la capacidad requerida recibe `plan_capability_required`;
- el negocio bloqueado recibe `business_access_blocked`;
- un token inválido, expirado o revocado devuelve 401;
- eliminar un trabajador invalida su identidad;
- revocar una conexión invalida sus tokens;
- ningún handler de lectura crea, actualiza o elimina datos de negocio;
- no se guardan tokens en texto plano;
- las herramientas de exportación no exponen datos fuera del negocio;
- Claude completa una llamada real después del callback OAuth.

## 9. Orden recomendado para continuar en el proyecto MCP independiente

1. Importar este documento y el código de `server/mcp.ts`, `server/mcpOAuth.ts`, `server/mcp/roles.ts`, `server/mcp/stateMachine.ts` y las migraciones MCP.
2. Conectar las herramientas del nuevo proyecto a Supabase sin duplicar tablas ni claves.
3. Ejecutar primero el inventario de tablas, columnas, funciones y planes reales.
4. Corregir el error TypeScript general y pasar las comprobaciones existentes.
5. Crear datos de prueba aislados para dos negocios y todos los roles.
6. Ejecutar la matriz de seguridad de Fase 1 y guardar resultados reproducibles.
7. Unificar roles y capacidades en una política única.
8. Completar clientes y administradores secundarios como identidades independientes.
9. Probar el conector de Claude de punta a punta contra la cuenta real.
10. Persistir la máquina de estados en Supabase.
11. Implementar primero acciones de preparación o exportación, no acciones destructivas.
12. Añadir confirmaciones explícitas, auditoría y revocación para cada acción.
13. Solo después evaluar fichaje, reportes y operaciones de escritura por rol.

## 10. Regla de seguridad permanente

> Ninguna conexión MCP debe ampliar lo que la persona ya puede ver dentro de Logiciel Construction. La IA puede facilitar la consulta y el análisis, pero no puede convertirse en una ruta alternativa para saltarse el plan, el rol, la suscripción, el perímetro del negocio o la confirmación humana.
