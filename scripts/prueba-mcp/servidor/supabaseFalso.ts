/**
 * Una base de datos de mentira para `prueba.ts`.
 *
 * Cada tabla devuelve sus filas sin mirar el filtro: la prueba pone en cada
 * tabla sólo lo que ese negocio tiene. Apunta cada escritura para poder decir
 * que una herramienta de lectura no escribió nada.
 */
export const DATOS: Record<string, any[]> = {};
export const ESCRITO: { tabla: string; op: string }[] = [];
class Consulta {
  private porToken = false;
  constructor(private tabla: string, private op = "select") {}
  // La única búsqueda que sí se respeta: la del token de un trabajador. Sin
  // esto, en cuanto la prueba mete un empleado en la tabla, el token del dueño
  // «lo encuentra» y la conexión pasa a ser la de ese empleado.
  select() { return this; }
  eq(columna?: string) { if (columna === "access_token_hash" && (this.tabla === "employees" || this.tabla === "subcontractors")) this.porToken = true; return this; } neq() { return this; } in() { return this; } gte() { return this; }
  lt() { return this; } lte() { return this; } order() { return this; } limit() { return this; } ilike() { return this; }
  not() { return this; } is() { return this; } or() { return this; } filter() { return this; } range() { return this; }
  insert() { ESCRITO.push({ tabla: this.tabla, op: "insert" }); return new Consulta(this.tabla, "insert"); }
  update() { ESCRITO.push({ tabla: this.tabla, op: "update" }); return new Consulta(this.tabla, "update"); }
  delete() { ESCRITO.push({ tabla: this.tabla, op: "delete" }); return new Consulta(this.tabla, "delete"); }
  upsert() { ESCRITO.push({ tabla: this.tabla, op: "upsert" }); return new Consulta(this.tabla, "upsert"); }
  private filas() { return this.porToken ? [] : DATOS[this.tabla] ?? []; }
  single() { return Promise.resolve({ data: this.filas()[0] ?? null, error: this.filas()[0] ? null : { code: "PGRST116", message: "no rows" } }); }
  maybeSingle() { return Promise.resolve({ data: this.filas()[0] ?? null, error: null }); }
  then(ok: any, ko: any) { return Promise.resolve({ data: this.op === "select" ? this.filas() : null, error: null, count: this.filas().length }).then(ok, ko); }
}
const cliente = { from: (t: string) => new Consulta(t), rpc: () => Promise.resolve({ data: null, error: null }) };
export function getSupabaseAdmin(): any { return cliente; }
export const DEMO_BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
export class SupabaseNotConfiguredError extends Error {}
