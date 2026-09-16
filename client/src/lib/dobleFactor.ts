/**
 * El segundo paso al entrar: seis dígitos de una app del móvil.
 *
 * No hay servicio de terceros detrás y no hace falta ninguno. Esto es **TOTP**,
 * un estándar abierto: el servidor guarda un secreto, la app del móvil guarda
 * el mismo secreto, y los dos calculan el mismo número de seis cifras a partir
 * de la hora. Nada viaja entre ellos. Por eso vale cualquier app —Google
 * Authenticator, Microsoft, Authy, 1Password, el propio llavero del iPhone— y
 * por eso no le contamos a Google quién entra en este sistema.
 *
 * Es **opcional y nace apagado**. Quien no lo encienda entra como siempre. Un
 * segundo paso obligatorio el día que alguien se pone a trabajar con el móvil
 * en una obra, sin cobertura y con las manos sucias, es la clase de seguridad
 * que acaba con la contraseña apuntada en el camión.
 */
import { supabase } from "@/lib/supabaseClient";

/**
 * Si a esta sesión le falta el segundo paso.
 *
 * Supabase lo dice comparando dos niveles: el que la sesión tiene ahora y el
 * que podría alcanzar. Si el segundo es mayor, es que esta persona tiene el
 * doble factor puesto y todavía no lo ha pasado.
 */
export async function faltanLosSeisDigitos(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return false;
    return data.currentLevel === "aal1" && data.nextLevel === "aal2";
  } catch {
    // Si no se puede preguntar, no se bloquea la entrada. Quedarse fuera por
    // un fallo de red es peor que entrar con un solo factor, que es lo que
    // pasaba ayer con todo el mundo.
    return false;
  }
}

/** El factor verificado de esta persona, que es contra el que se comprueba. */
async function factorVerificado(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  const totp = (data.totp ?? []).find((f) => f.status === "verified");
  return totp?.id ?? null;
}

/**
 * Comprobar los seis dígitos y subir la sesión al segundo nivel.
 *
 * Devuelve el motivo del fallo en vez de lanzarlo: el que llama tiene que
 * poder dejar a la persona en la misma pantalla, con el campo puesto, para
 * que lo vuelva a intentar. Un código caducado es lo más normal del mundo.
 */
export async function comprobarLosSeisDigitos(codigo: string): Promise<string | null> {
  const factorId = await factorVerificado();
  if (!factorId) return "no_factor";
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo.trim() });
  return error ? error.message : null;
}

export interface Alta {
  factorId: string;
  /** El código QR, ya dibujado por Supabase. */
  qr: string;
  /** El mismo secreto en letras, para quien no pueda escanear. */
  secreto: string;
}

/**
 * Empezar el alta: crea el factor y devuelve el QR.
 *
 * El factor queda en `unverified` hasta que la persona teclea el primer
 * código. Eso es deliberado de Supabase y es lo correcto: dar por bueno un
 * secreto que nadie ha demostrado tener en el móvil es cómo se deja a alguien
 * fuera de su propia cuenta.
 */
export async function empezarAlta(): Promise<Alta | { error: string }> {
  // Un alta a medias de otro día deja un factor sin verificar que impide
  // crear el siguiente. Se limpian antes de empezar.
  const previos = await supabase.auth.mfa.listFactors();
  for (const f of previos.data?.totp ?? []) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `movil-${Date.now()}`,
  });
  if (error || !data) return { error: error?.message ?? "no" };
  return { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret };
}

/** Terminar el alta con el primer código, que es la prueba de que funciona. */
export async function terminarAlta(factorId: string, codigo: string): Promise<string | null> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo.trim() });
  return error ? error.message : null;
}

/** Qué tiene puesto ahora mismo esta persona. */
export async function estaPuesto(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return false;
  return (data.totp ?? []).some((f) => f.status === "verified");
}

/** Quitarlo. Se borran todos, verificados o no, para no dejar cabos sueltos. */
export async function quitar(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return error.message;
  for (const f of data.totp ?? []) {
    const r = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (r.error) return r.error.message;
  }
  return null;
}
