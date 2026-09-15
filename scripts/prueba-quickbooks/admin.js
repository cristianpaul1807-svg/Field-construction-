// Un doble de Supabase: encadena igual y contesta con las filas del caso.
// No valida SQL — lo que se está probando es el documento que sale hacia
// QuickBooks, no la base de datos.
export function hacerAdmin(filas) {
  const escrituras = [];

  function consulta(tabla) {
    const filtros = {};
    const b = {
      select() { return b; },
      eq(col, val) { filtros[col] = val; return b; },
      in() { return b; },
      gte() { return b; },
      order() { return b; },
      limit() { return b; },
      is() { return b; },
      not() { return b; },
      upsert(fila) { escrituras.push({ tabla, fila }); return Promise.resolve({ error: null }); },
      insert(fila) { escrituras.push({ tabla, fila }); return Promise.resolve({ error: null }); },
      update(fila) { escrituras.push({ tabla, fila }); return b; },
      delete() { return b; },
      maybeSingle() { return Promise.resolve({ data: resolver(tabla, filtros), error: null }); },
      single() { return Promise.resolve({ data: resolver(tabla, filtros), error: null }); },
      then(res, rej) {
        const d = resolver(tabla, filtros);
        return Promise.resolve({ data: Array.isArray(d) ? d : d ? [d] : [], error: null }).then(res, rej);
      },
    };
    return b;
  }

  function resolver(tabla, filtros) {
    const f = filas[tabla];
    if (typeof f === "function") return f(filtros);
    if (Array.isArray(f) && filtros.id) return f.find((x) => x.id === filtros.id) ?? null;
    return f ?? null;
  }

  return { from: consulta, escrituras };
}
