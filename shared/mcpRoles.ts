/**
 * Quién puede pedir qué por MCP.
 *
 * Vive en `shared/` y no en `server/mcp.ts` por una razón concreta: la prueba
 * que comprueba estas reglas —`scripts/prueba-mcp/roles.mjs`— no puede
 * importar el servidor, que arrastra Supabase y el SDK entero. Cuando la
 * prueba tenía su propia copia de la tabla, encontró un agujero real en la
 * copia y no en el original, y el original se quedó roto un rato más. Una
 * tabla copiada es exactamente la enfermedad que estas reglas existen para
 * curar, así que aquí sólo hay una y la leen los tres: el listado de
 * herramientas, el guardia de cada llamada, y la prueba.
 */

// Con extensión a propósito: `scripts/prueba-mcp/roles.mjs` importa este
// archivo con node a pelo, que no resuelve `./permisos` sin ella. El build
// pasa por esbuild y le da igual.
import { puede, type Area } from "./permisos.ts";

export type McpRole = "worker" | "manager" | "office" | "admin";

/**
 * Lo mínimo que hace falta saber de alguien para decidir su papel.
 *
 * Estructural a propósito: `WorkerIdentity` del servidor encaja sin declararlo,
 * y así este archivo no tiene que conocer nada de lo que hay al otro lado.
 */
export type IdentidadParaRol = {
  workerKind: "employee" | "subcontractor" | "owner";
  areas: Area[] | null;
};

/**
 * Qué puede pedir esta identidad, decidido por sus **áreas** y no por el
 * nombre de su rol.
 *
 * Antes esto miraba el texto del rol con expresiones regulares, y eso abría un
 * agujero que no se ve leyéndolo: el nombre del rol **lo escribe el
 * contratista**. Un negocio que llamara a un papel «Administración de obra»
 * casaba con `admin` y esa persona recibía en Claude las herramientas de
 * administrador —incluida la rentabilidad por obra—, aunque en el panel sólo
 * tuviera el área de campo. Y al revés: un «Responsable de obra» no casaba con
 * nada y se quedaba en trabajador, viendo menos de lo que ya tenía.
 *
 * Las áreas son lo que el panel usa de verdad para abrir o cerrar pantallas.
 * Usar aquí lo mismo es lo que hace cierta la regla permanente del plan
 * maestro: una conexión MCP no amplía lo que la persona ya puede ver. Con el
 * nombre del rol esa regla era una intención; con las áreas es una propiedad.
 *
 * ## Por qué el tipo de identidad se mira primero
 *
 * `areas === null` significa «sin límite» **para quien entra al panel**. Un
 * trabajador de campo no entra al panel: entra por su código en `/campo`, y lo
 * normal es que no tenga rol ninguno. Leer su `null` como «sin límite» le daría
 * la facturación del negocio entero por no tener papel asignado — que es el
 * fallo más caro que se podría cometer aquí. Por eso el campo y la oficina se
 * separan antes de mirar ninguna área.
 */
export function roleOf(identity: IdentidadParaRol): McpRole {
  // El terreno nunca sube de ahí por su cuenta. Sólo un papel del panel
  // asignado a propósito puede darle más, y entonces `areas` lo dice.
  if (identity.workerKind !== "owner" && identity.areas === null) return "worker";

  const areas = identity.areas;
  // Sin límite: es quien lleva el negocio.
  if (areas === null) return "admin";
  // El dinero de la empresa y la configuración: quien tiene las dos, lo tiene
  // todo aunque nadie le haya llamado «admin».
  if (puede(areas, "dinero") && puede(areas, "ajustes")) return "admin";
  // Los números, sin la configuración: contabilidad u oficina.
  if (puede(areas, "dinero") || puede(areas, "clientes")) return "office";
  // El terreno: obras, órdenes, agenda y quién va.
  if (puede(areas, "campo")) return "manager";
  return "worker";
}

export type Capacidad = "campo" | "facturacion" | "reportes" | "contabilidad" | "margen";

/**
 * Quién puede pedir cada herramienta, en **un solo sitio**.
 *
 * Tres condiciones, y las tres tienen que cumplirse:
 *
 * - `roles` — el papel que le corresponde por sus áreas. Expresa la intención:
 *   esta herramienta es de encargado para arriba.
 * - `area` — el área del panel a la que pertenece lo que devuelve. Es la que
 *   **garantiza** que MCP no amplía nada, y no es redundante con la anterior:
 *   los cuatro papeles son cubos gruesos y no saben decir «tiene dinero pero
 *   no campo». Sin esta línea, alguien con sólo `clientes` caía en `office` y
 *   podía pedir obras y facturas que en su panel están cerradas. Lo encontró
 *   `scripts/prueba-mcp/roles.mjs` recorriendo todas las combinaciones.
 * - `capability` — que el plan del negocio la incluya. Otra cosa distinta:
 *   «no es para ti» y «no lo habéis contratado» no se arreglan igual.
 *
 * La tabla la leen **el listado y el guardia**. Antes el listado la usaba y
 * cada herramienta repetía sus roles a mano al comprobarlos, que es la forma
 * de que un día una esté escondida y sea invocable, o al revés.
 */
export const TOOL_ACCESS: Record<string, { roles: McpRole[]; area: Area; capability: Capacidad }> = {
  get_projects: { roles: ["manager", "office", "admin"], area: "campo", capability: "campo" },
  get_project: { roles: ["manager", "office", "admin"], area: "campo", capability: "campo" },
  get_project_schedule: { roles: ["manager", "office", "admin"], area: "campo", capability: "campo" },
  get_work_orders: { roles: ["manager", "office", "admin"], area: "campo", capability: "campo" },
  get_workers: { roles: ["manager", "office", "admin"], area: "campo", capability: "campo" },
  get_business_summary: { roles: ["admin"], area: "dinero", capability: "reportes" },
  get_invoices: { roles: ["office", "admin"], area: "dinero", capability: "facturacion" },
  get_receivables: { roles: ["office", "admin"], area: "dinero", capability: "reportes" },
  get_expenses: { roles: ["office", "admin"], area: "dinero", capability: "reportes" },
  get_payments: { roles: ["office", "admin"], area: "dinero", capability: "facturacion" },
  get_profitability: { roles: ["admin"], area: "dinero", capability: "margen" },
  audit_quickbooks_sync: { roles: ["office", "admin"], area: "dinero", capability: "contabilidad" },
};

/**
 * Las dos condiciones que dependen de la persona, juntas.
 *
 * El plan del negocio se comprueba aparte en cada sitio: el listado esconde lo
 * que no está contratado y el guardia lo niega con otro código de error,
 * porque «no es para ti» y «no lo habéis contratado» no se arreglan igual.
 */
export function puedeUsarHerramienta(identity: IdentidadParaRol, toolName: string): boolean {
  const access = TOOL_ACCESS[toolName];
  if (!access) return false;
  return access.roles.includes(roleOf(identity)) && puede(identity.areas, access.area);
}
