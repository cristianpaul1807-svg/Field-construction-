/**
 * El aviso de «esto todavía es de pruebas» sale cuando tiene que salir.
 *
 *     node scripts/prueba-permisos/espera.mjs
 *
 * Existe por un fallo de verdad: el aviso colgaba del entorno de la *conexión*,
 * y al desconectar esa fila desaparece. Resultado — el aviso se iba justo
 * cuando más falta hacía: delante del botón de conectar, con el botón otra vez
 * pulsable. Lo enseñó una captura de pantalla, no una prueba.
 */

/** Copia fiel de lo que decide `estado()` en `server/quickbooks.ts`. */
function entornoQueVeLaPantalla({ filaDeConexion, configurado, entornoDelServidor }) {
  return filaDeConexion?.environment ?? (configurado ? entornoDelServidor : null);
}

/** Copia fiel de lo que decide `SettingsQuickBooks.tsx`. */
const enEspera = (estado) => estado.environment === "sandbox" && !estado.sandboxConnect;

const out = [];
const di = (q, ok, d) => out.push(`${ok ? "ok " : "XX "} ${q}${d ? ` — ${d}` : ""}`);

const servidorEnPruebas = { configurado: true, entornoDelServidor: "sandbox" };
const servidorEnProduccion = { configurado: true, entornoDelServidor: "production" };

// El caso que falló: desconectado, servidor en pruebas.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: null, ...servidorEnPruebas }), sandboxConnect: false };
  di("Sin conexión y servidor en pruebas: el aviso sale", enEspera(e), e.environment);
}
// Conectado a una empresa de pruebas.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: { environment: "sandbox" }, ...servidorEnPruebas }), sandboxConnect: false };
  di("Conectado a una de pruebas: también", enEspera(e));
}
// Con la puerta abierta a mano, para poder seguir probando.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: null, ...servidorEnPruebas }), sandboxConnect: true };
  di("Con QUICKBOOKS_SANDBOX_CONNECT se puede conectar", !enEspera(e));
}
// El día que Intuit apruebe.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: null, ...servidorEnProduccion }), sandboxConnect: false };
  di("Servidor en producción: sin aviso y con botón", !enEspera(e), e.environment);
}
// Conectado a pruebas con el servidor en producción: eso hay que decirlo igual.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: { environment: "sandbox" }, ...servidorEnProduccion }), sandboxConnect: false };
  di("Enganchado a una de pruebas desde producción: manda la conexión", enEspera(e), e.environment);
}
// Sin claves en el servidor no hay entorno que enseñar.
{
  const e = { environment: entornoQueVeLaPantalla({ filaDeConexion: null, configurado: false, entornoDelServidor: "sandbox" }), sandboxConnect: false };
  di("Sin configurar, no hay entorno", e.environment === null);
}

console.log(out.join("\n"));
const mal = out.filter((x) => x.startsWith("XX")).length;
console.log(`\n${out.length - mal} bien, ${mal} mal\n`);
process.exit(mal ? 1 : 0);
