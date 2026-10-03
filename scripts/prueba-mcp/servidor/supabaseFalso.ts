/**
 * Una base de datos de mentira para `prueba.ts`.
 *
 * Cada tabla devuelve sus filas sin mirar el filtro: la prueba pone en cada
 * tabla sólo lo que ese negocio tiene. Apunta cada escritura para poder decir
 * que una herramienta de lectura no escribió nada.
 *
 * La excepción es `mcp_acciones`, la de los borradores de la Fase B: ahí sí
 * se guarda lo insertado y se respetan los `eq`, porque lo que se prueba es
 * justamente que una segunda confirmación no encuentra el borrador en espera.
 */
export const DATOS: Record<string, any[]> = {};
export const ESCRITO: { tabla: string; op: string }[] = [];
const CON_FILTROS = new Set(["mcp_acciones"]);
let siguiente = 0;
class Consulta {
  private porToken = false;
  private otroDueño = false;
  private filtros: [string, unknown][] = [];
  private cambios: Record<string, unknown> | null = null;
  private nuevas: any[] | null = null;
  constructor(private tabla: string, private op = "select") {}
  // Una de las dos búsquedas que sí se respetan: la del token de un trabajador. Sin
  // esto, en cuanto la prueba mete un empleado en la tabla, el token del dueño
  // «lo encuentra» y la conexión pasa a ser la de ese empleado.
  select() { return this; }
  eq(columna?: string, valor?: unknown) {
    if (columna === "access_token_hash" && (this.tabla === "employees" || this.tabla === "subcontractors")) this.porToken = true;
    // Y la del propietario principal, para poder probar a quien ya no lo es.
    if (columna === "primary_auth_user_id" && (DATOS.businesses ?? []).every((b) => b.primary_auth_user_id !== undefined && b.primary_auth_user_id !== valor)) this.otroDueño = true;
    if (columna) this.filtros.push([columna, valor]);
    return this;
  }
  neq() { return this; } in() { return this; } gte() { return this; }
  lt() { return this; } lte() { return this; } order() { return this; } limit() { return this; } ilike() { return this; }
  not() { return this; } is() { return this; } or() { return this; } filter() { return this; } range() { return this; }
  insert(filas: any) {
    ESCRITO.push({ tabla: this.tabla, op: "insert" });
    const c = new Consulta(this.tabla, "insert");
    if (CON_FILTROS.has(this.tabla)) {
      c.nuevas = (Array.isArray(filas) ? filas : [filas]).map((f) => ({ id: `00000000-0000-4000-8000-${String(++siguiente).padStart(12, "0")}`, estado: "awaiting_confirmation", ...f }));
      (DATOS[this.tabla] ??= []).push(...c.nuevas);
    }
    return c;
  }
  update(cambios: Record<string, unknown>) { ESCRITO.push({ tabla: this.tabla, op: "update" }); const c = new Consulta(this.tabla, "update"); c.cambios = cambios; return c; }
  delete() { ESCRITO.push({ tabla: this.tabla, op: "delete" }); return new Consulta(this.tabla, "delete"); }
  upsert() { ESCRITO.push({ tabla: this.tabla, op: "upsert" }); return new Consulta(this.tabla, "upsert"); }
  private filas() {
    if (this.nuevas) return this.nuevas;
    if (this.porToken || this.otroDueño) return [];
    const todas = DATOS[this.tabla] ?? [];
    if (!CON_FILTROS.has(this.tabla)) return todas;
    const que = todas.filter((f) => this.filtros.every(([c, v]) => f[c] === v));
    if (this.cambios) for (const f of que) Object.assign(f, this.cambios);
    return que;
  }
  single() { const f = this.filas(); return Promise.resolve({ data: f[0] ?? null, error: f[0] ? null : { code: "PGRST116", message: "no rows" } }); }
  maybeSingle() { const f = this.filas(); return Promise.resolve({ data: f[0] ?? null, error: null }); }
  then(ok: any, ko: any) {
    const f = this.filas();
    const devuelve = this.op === "select" || CON_FILTROS.has(this.tabla);
    return Promise.resolve({ data: devuelve ? f : null, error: null, count: f.length }).then(ok, ko);
  }
}
const cliente = { from: (t: string) => new Consulta(t), rpc: () => Promise.resolve({ data: null, error: null }) };
export function getSupabaseAdmin(): any { return cliente; }
export const DEMO_BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
export class SupabaseNotConfiguredError extends Error {}
