/**
 * El aviso de «esto es el QuickBooks de pruebas» sale cuando tiene que salir.
 *
 *     node scripts/prueba-permisos/espera.mjs
 *
 * Existe por un fallo de verdad: el aviso colgaba del entorno de la *conexión*,
 * y al desconectar esa fila desaparece. Resultado — el aviso se iba justo
 * cuando más falta hacía: delante del botón de conectar. Lo enseñó una captura
 * de pantalla, no una prueba.
 *
 * Lo que el aviso significa ya no es lo mismo. Mientras Intuit no aprobaba la
 * app decía «pronto» y apagaba el botón. Ahora Intuit aprobó, el botón no se
 * bloquea nunca, y lo único que queda es decir contra qué QuickBooks habla
 * este servidor: una contabilidad que parece estar yéndose y no se va es peor
 * que una que no se va.
 */

/** Copia fiel de lo que decide `estado()` en `server/quickbooks.ts`. */
function entornoQueVeLaPantalla({ filaDeConexion, configurado, entornoDelServidor }) {
  return filaDeConexion?.environment ?? (configurado ? entornoDelServidor : null);
}

/** Copia fiel de lo que decide `SettingsQuickBooks.tsx`. */
const enPruebas = (estado) => estado.environment === "sandbox";

const out = [];
const di = (q, ok, d) => out.push(`${ok ? "ok " : "XX "} ${q}${d ? ` — ${d}` : ""}`);

const servidorEnPruebas = { configurado: true, entornoDelServidor: "sandbox" };
const servidorEnProduccion = { configurado: true, entornoDelServidor: "production" };

// El caso que falló en su día: desconectado, con el servidor en pruebas.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: null, ...servidorEnPruebas }) };
  di("Sin conexión y servidor en pruebas: el aviso sale", enPruebas(e), e.environment);
}
// Conectado a una empresa de pruebas.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: { environment: "sandbox" }, ...servidorEnPruebas }) };
  di("Conectado a una de pruebas: también", enPruebas(e));
}
// Lo normal desde que Intuit aprobó.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: null, ...servidorEnProduccion }) };
  di("Servidor en producción: sin aviso", !enPruebas(e), e.environment);
}
// Conectado a pruebas con el servidor en producción: eso hay que decirlo igual.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: { environment: "sandbox" }, ...servidorEnProduccion }) };
  di("Enganchado a una de pruebas desde producción: manda la conexión", enPruebas(e), e.environment);
}
// Y al revés: el servidor en pruebas no puede tapar una conexión de verdad.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: { environment: "production" }, ...servidorEnPruebas }) };
  di("Conexión de producción desde un servidor de pruebas: sin aviso", !enPruebas(e), e.environment);
}
// Sin claves en el servidor no hay entorno que enseñar.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: null, configurado: false, entornoDelServidor: "sandbox" }) };
  di("Sin configurar, no hay entorno ni aviso", e.environment === null && !enPruebas(e));
}

console.log(out.join("\n"));
const mal = out.filter((x) => x.startsWith("XX")).length;
console.log(`\n${out.length - mal} bien, ${mal} mal\n`);
process.exit(mal ? 1 : 0);
