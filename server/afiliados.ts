/**
 * Quién nos trae clientes, y cuánto le debemos por ello.
 *
 * Esto es dinero **nuestro**, no del contratista: las tablas no llevan
 * `business_id` como los datos de un negocio, y tienen RLS activada sin
 * ninguna política para que sólo entre la clave de servicio.
 *
 * ## El programa es abierto
 *
 * Cualquiera se apunta solo en `/afiliados`, acepta las condiciones y recibe
 * su enlace en el acto. Cobra el 30 % de lo que paga cada cliente que trae,
 * durante los 12 primeros meses de ese cliente. Cada comisión espera 30 días
 * antes de poder cobrarse: si en ese plazo hay un reembolso o un contracargo,
 * se anula sin que haya salido dinero. Se retira a partir de 50 $.
 *
 * Al cliente que llega por un enlace no se le regala nada: tiene la misma
 * prueba de 30 días que todo el mundo.
 *
 * ## Lo que aquí no se decide
 *
 * Si un cliente se puede ir. Se puede, siempre, y ninguna cláusula lo cambia.
 * Lo único que se corta al cancelar un afiliado es su comisión.
 */

import { getSupabaseAdmin } from "./supabaseAdmin";

type Admin = ReturnType<typeof getSupabaseAdmin>;

/** Lo que cobra un afiliado del programa abierto, y durante cuánto. */
export const COMISION_DEL_PROGRAMA = 30;
export const MESES_DE_COMISION = 12;
/** Lo que espera una comisión antes de poder retirarse. */
export const DIAS_DE_ESPERA = 30;
/** Por debajo de esto no se transfiere: la comisión de la transferencia se comería el pago. */
export const MINIMO_PARA_RETIRAR_CAD = 50;
/**
 * La versión de las condiciones que se acepta al apuntarse. Cambiar el texto
 * de las condiciones es cambiar esto: queda apuntado qué aceptó cada uno.
 */
export const VERSION_DE_LAS_CONDICIONES = "2026-10";

/**
 * El alfabeto del código.
 *
 * Sin `0/O`, sin `1/I/L`: un afiliado dicta su código por teléfono y quien lo
 * apunta se equivoca justo ahí. Ocho caracteres de este alfabeto son
 * suficientes para no chocar nunca y cortos para caber en una tarjeta.
 */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function codigoNuevo(largo = 8): string {
  let salida = "";
  for (let i = 0; i < largo; i += 1) {
    salida += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return salida;
}

const centimos = (valor: number) => Math.round(valor * 100) / 100;

export interface AltaDeAfiliado {
  titularTipo: "negocio" | "persona";
  /** El negocio dueño del enlace, si lo es. Un contable de fuera no tiene. */
  titularId?: string | null;
  /** Su cuenta de acceso, si se apuntó él solo. */
  authUserId?: string | null;
  nombre: string;
  email?: string | null;
  /** Sin fecha, el enlace funciona y atribuye, pero no devenga comisión. */
  contratoEn?: string | null;
  comisionPct?: number;
  mesesComision?: number;
  dondeComparte?: string | null;
  pais?: string | null;
  idioma?: string | null;
  condicionesVersion?: string | null;
  /** La firma del contrato: su nombre escrito, el trazo si lo hizo, desde dónde. */
  firma?: { nombre: string; imagen: string | null; ip: string | null; agente: string | null } | null;
  notas?: string | null;
}

/**
 * Da de alta un afiliado y le asigna su código.
 *
 * Reintenta si el código ya existía. No es paranoia gratuita: con un alfabeto
 * de 31 y ocho posiciones el choque es improbable, pero el índice único es
 * quien manda y un choque sin reintento sería un alta fallida sin explicación.
 */
export async function crearAfiliado(admin: Admin, alta: AltaDeAfiliado) {
  for (let intento = 0; intento < 5; intento += 1) {
    const { data, error } = await admin
      .from("afiliados")
      .insert({
        titular_tipo: alta.titularTipo,
        titular_id: alta.titularId ?? null,
        auth_user_id: alta.authUserId ?? null,
        nombre: alta.nombre,
        email: alta.email ?? null,
        codigo: codigoNuevo(),
        contrato_en: alta.contratoEn ?? null,
        comision_pct: alta.comisionPct ?? COMISION_DEL_PROGRAMA,
        meses_comision: alta.mesesComision ?? MESES_DE_COMISION,
        donde_comparte: alta.dondeComparte ?? null,
        pais: alta.pais ?? null,
        idioma: alta.idioma ?? null,
        condiciones_version: alta.condicionesVersion ?? null,
        firma_nombre: alta.firma?.nombre ?? null,
        firma_imagen: alta.firma?.imagen ?? null,
        firma_ip: alta.firma?.ip ?? null,
        firma_agente: alta.firma?.agente ?? null,
        notas: alta.notas ?? null,
      })
      .select("id, codigo, nombre, comision_pct, contrato_en")
      .single();

    if (!error) return data;
    // 23505 es el índice único del código. Cualquier otro error es de verdad.
    if ((error as { code?: string; message?: string }).code !== "23505") throw error;
    // El otro único de la tabla es la cuenta de acceso: ya era afiliado.
    if (/auth_user_id/.test((error as { message?: string }).message ?? "")) throw error;
  }
  throw new Error("No se pudo generar un código de afiliado libre");
}

/**
 * Apuntarse al programa: la persona que acaba de crear su cuenta en
 * `/afiliados`, o quien ya la tenía (un contratista cliente que además
 * recomienda).
 *
 * El enlace se da **después de firmar el contrato**, no antes: se guarda su
 * nombre escrito como firma, el trazo si lo hizo, la versión exacta de las
 * condiciones, la hora (`contrato_en`), la IP y el navegador. Es lo que
 * prueba, el día que haga falta, quién aceptó qué y cuándo.
 *
 * Si ya era afiliado, devuelve el que había: pulsar dos veces no da dos
 * enlaces.
 */
export async function apuntarAlPrograma(
  admin: Admin,
  datos: {
    authUserId: string;
    email: string | null;
    nombre: string;
    dondeComparte: string;
    pais: string | null;
    idioma: string | null;
    firma: { nombre: string; imagen: string | null; ip: string | null; agente: string | null };
  }
) {
  const { data: ya } = await admin.from("afiliados").select("id, codigo").eq("auth_user_id", datos.authUserId).maybeSingle();
  if (ya) return ya;

  // Si es el dueño de un negocio, el enlace queda a nombre de ese negocio:
  // es lo que impide que se refiera a sí mismo (ver atribuirNegocio).
  const { data: suNegocio } = await admin.from("users").select("business_id").eq("auth_user_id", datos.authUserId).maybeSingle();

  return crearAfiliado(admin, {
    titularTipo: suNegocio?.business_id ? "negocio" : "persona",
    titularId: suNegocio?.business_id ?? null,
    authUserId: datos.authUserId,
    nombre: datos.nombre,
    email: datos.email,
    contratoEn: new Date().toISOString(),
    dondeComparte: datos.dondeComparte,
    pais: datos.pais,
    idioma: datos.idioma,
    condicionesVersion: VERSION_DE_LAS_CONDICIONES,
    firma: datos.firma,
  });
}

/**
 * Apunta que este negocio lo trajo este código.
 *
 * Se llama al crear el negocio y **no rompe el alta si falla**: alguien que
 * está dándose de alta no puede quedarse fuera del producto porque un código
 * de afiliado estuviera mal escrito. Se apunta el fallo y se sigue.
 *
 * Reglas, y las tres importan:
 *
 * - Un código que no existe o está cancelado no atribuye. Un afiliado
 *   suspendido **sí** atribuye: la suspensión para el pago, no el histórico,
 *   y si se levanta queremos saber a quién trajo mientras tanto.
 * - Un negocio se atribuye **una sola vez**. Lo garantiza el índice único
 *   sobre `business_id`, no esta función.
 * - Nadie se refiere a sí mismo: ni el negocio dueño del enlace, ni la misma
 *   cuenta de acceso creando un negocio con su propio enlace. Sin esto, el
 *   primer «afiliado» es alguien descontándose un 30 % de su suscripción.
 */
export async function atribuirNegocio(
  admin: Admin,
  businessId: string,
  codigo: string | null | undefined,
  authUserIdDelQueSeDaDeAlta?: string | null
) {
  const limpio = String(codigo ?? "").trim().toUpperCase();
  if (!limpio) return null;

  try {
    const { data: afiliado } = await admin
      .from("afiliados")
      .select("id, estado, titular_id, auth_user_id")
      .eq("codigo", limpio)
      .maybeSingle();

    if (!afiliado || afiliado.estado === "cancelado") return null;
    const esElMismo =
      (afiliado.titular_id && afiliado.titular_id === businessId) ||
      (afiliado.auth_user_id && authUserIdDelQueSeDaDeAlta && afiliado.auth_user_id === authUserIdDelQueSeDaDeAlta);
    if (esElMismo) {
      console.error(`[afiliados] ${businessId} intentó usar su propio código`);
      return null;
    }

    const { data, error } = await admin
      .from("referidos")
      .insert({ afiliado_id: afiliado.id, business_id: businessId })
      .select("id")
      .single();
    if (error) {
      // 23505: ya estaba atribuido a otro. El primero se lo queda.
      if ((error as { code?: string }).code !== "23505") throw error;
      return null;
    }
    return data.id as string;
  } catch (err) {
    console.error("[afiliados] no se pudo atribuir", businessId, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Anota la comisión de un cobro.
 *
 * Se llama cuando Stripe confirma que el dinero entró, no cuando se crea la
 * suscripción: se paga sobre lo cobrado de verdad. `stripe_invoice` es único,
 * así que una entrega repetida del webhook no puede pagar dos veces — la
 * misma protección que ya tienen los cobros de facturas.
 *
 * - `contrato_en` sin fecha: ese afiliado no ha aceptado las condiciones y no
 *   devenga nada.
 * - Pasados sus meses (12 en el programa) desde el primer pago del cliente,
 *   ese cliente deja de generar comisión. El afiliado sigue cobrando por los
 *   demás.
 * - La comisión nace en espera: `disponible_en` es dentro de 30 días.
 */
export async function anotarComision(
  admin: Admin,
  businessId: string,
  cobro: { stripeInvoice: string; baseCad: number; periodo: Date; monedaDelCobro?: string | null }
) {
  try {
    const { data: referido } = await admin
      .from("referidos")
      .select("id, estado, primera_paga_en, afiliados(id, estado, contrato_en, comision_pct, meses_comision)")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!referido || referido.estado === "anulado") return;
    const afiliado = (referido as {
      afiliados?: { estado?: string; contrato_en?: string | null; comision_pct?: number; meses_comision?: number } | null;
    }).afiliados;
    if (!afiliado || afiliado.estado !== "activo" || !afiliado.contrato_en) return;

    if (referido.primera_paga_en) {
      const fin = new Date(referido.primera_paga_en);
      fin.setMonth(fin.getMonth() + Number(afiliado.meses_comision ?? MESES_DE_COMISION));
      if (cobro.periodo >= fin) return;
    }

    const pct = Number(afiliado.comision_pct ?? COMISION_DEL_PROGRAMA);
    // Redondeado una vez, aquí, que es donde deja de ser un cálculo y pasa a
    // ser un número que alguien va a cobrar.
    const importe = centimos(cobro.baseCad * (pct / 100));
    if (importe <= 0) return;

    const { error } = await admin.from("comisiones").insert({
      referido_id: referido.id,
      periodo: cobro.periodo.toISOString().slice(0, 10),
      base_cad: cobro.baseCad,
      importe_cad: importe,
      stripe_invoice: cobro.stripeInvoice,
      moneda_cobro: cobro.monedaDelCobro ?? null,
      disponible_en: new Date(cobro.periodo.getTime() + DIAS_DE_ESPERA * 86_400_000).toISOString(),
    });
    // 23505: ya estaba anotada. El webhook llegó dos veces y eso está bien.
    if (error && (error as { code?: string }).code !== "23505") throw error;

    if (referido.estado === "prueba") {
      await admin
        .from("referidos")
        .update({ estado: "pagando", primera_paga_en: cobro.periodo.toISOString() })
        .eq("id", referido.id);
    }
  } catch (err) {
    // Un fallo aquí no puede tumbar el webhook: el cobro del negocio ya está
    // hecho y lo que se pierde es nuestra anotación, que se puede rehacer.
    console.error("[afiliados] no se pudo anotar la comisión", businessId, err instanceof Error ? err.message : err);
  }
}

/**
 * Un cobro que se devolvió o se disputó no genera comisión.
 *
 * Sólo se anula lo que todavía no se ha pagado: para eso existe la espera de
 * 30 días. Lo ya transferido no se reclama desde aquí; se apunta en el error
 * para verlo a mano, porque reclamar dinero a un afiliado es una conversación,
 * no una línea de código.
 */
export async function anularComisionDelCobro(admin: Admin, stripeInvoice: string, motivo: "reembolso" | "contracargo") {
  try {
    const { data } = await admin
      .from("comisiones")
      .update({ estado: "anulada", anulada_por: motivo })
      .eq("stripe_invoice", stripeInvoice)
      .eq("estado", "devengada")
      .is("pago_id", null)
      .select("id");
    if (!data?.length) {
      const { data: pagada } = await admin.from("comisiones").select("id, estado").eq("stripe_invoice", stripeInvoice).maybeSingle();
      if (pagada?.estado === "pagada") {
        console.error(`[afiliados] ${motivo} de ${stripeInvoice}, cuya comisión ya se había pagado (${pagada.id})`);
      }
    }
  } catch (err) {
    console.error("[afiliados] no se pudo anular la comisión", stripeInvoice, err instanceof Error ? err.message : err);
  }
}

interface FilaDeComision {
  id: string;
  importe_cad: number | string;
  estado: string;
  disponible_en: string;
  pago_id: string | null;
  periodo: string;
}

/** Las cuentas de un afiliado, a partir de sus comisiones. */
function cuentas(comisiones: FilaDeComision[], ahora = Date.now()) {
  const suma = (filas: FilaDeComision[]) => centimos(filas.reduce((total, c) => total + Number(c.importe_cad), 0));
  const vivas = comisiones.filter((c) => c.estado === "devengada" && !c.pago_id);
  return {
    enEsperaCad: suma(vivas.filter((c) => new Date(c.disponible_en).getTime() > ahora)),
    disponibleCad: suma(vivas.filter((c) => new Date(c.disponible_en).getTime() <= ahora)),
    pagadoCad: suma(comisiones.filter((c) => c.estado === "pagada")),
    anuladoCad: suma(comisiones.filter((c) => c.estado === "anulada")),
  };
}

/** Las comisiones de todos los clientes de un afiliado. */
async function comisionesDe(admin: Admin, afiliadoId: string) {
  const { data: referidos } = await admin.from("referidos").select("id, estado, atribuido_en").eq("afiliado_id", afiliadoId);
  const ids = (referidos ?? []).map((r) => r.id);
  const { data: comisiones } = ids.length
    ? await admin
        .from("comisiones")
        .select("id, importe_cad, estado, disponible_en, pago_id, periodo")
        .in("referido_id", ids)
        .order("periodo", { ascending: false })
    : { data: [] as FilaDeComision[] };
  return { referidos: referidos ?? [], comisiones: (comisiones ?? []) as FilaDeComision[] };
}

/**
 * Lo que ve un afiliado en su panel. Nunca datos de otros afiliados, ni de
 * quiénes son sus clientes más allá de cuántos y en qué estado: el nombre de
 * un negocio que paga es de ese negocio.
 */
export async function panelDeAfiliado(admin: Admin, afiliadoId: string) {
  const { data: afiliado } = await admin
    .from("afiliados")
    .select("id, codigo, estado, nombre, contrato_en, condiciones_version, firma_nombre, comision_pct, meses_comision, pais, stripe_account_id")
    .eq("id", afiliadoId)
    .maybeSingle();
  if (!afiliado) return null;

  const { referidos, comisiones } = await comisionesDe(admin, afiliado.id);
  const { data: pagos } = await admin
    .from("pagos_afiliados")
    .select("id, importe_cad, estado, creado_en")
    .eq("afiliado_id", afiliado.id)
    .order("creado_en", { ascending: false })
    .limit(24);

  return {
    codigo: afiliado.codigo,
    nombre: afiliado.nombre,
    estado: afiliado.estado,
    comisionPct: Number(afiliado.comision_pct),
    meses: Number(afiliado.meses_comision),
    diasDeEspera: DIAS_DE_ESPERA,
    minimoCad: MINIMO_PARA_RETIRAR_CAD,
    pais: afiliado.pais,
    firmado: Boolean(afiliado.contrato_en),
    // Lo que firmó, a la vista: es su contrato tanto como el nuestro.
    contrato: afiliado.contrato_en
      ? { fecha: afiliado.contrato_en, nombre: afiliado.firma_nombre, version: afiliado.condiciones_version }
      : null,
    stripeConectado: Boolean(afiliado.stripe_account_id),
    clientes: {
      total: referidos.length,
      enPrueba: referidos.filter((r) => r.estado === "prueba").length,
      pagando: referidos.filter((r) => r.estado === "pagando").length,
    },
    ...cuentas(comisiones),
    ultimasComisiones: comisiones.slice(0, 12).map((c) => ({
      periodo: c.periodo,
      importeCad: Number(c.importe_cad),
      estado: c.estado === "devengada" && !c.pago_id && new Date(c.disponible_en).getTime() > Date.now() ? "en_espera" : c.estado === "devengada" ? "disponible" : c.estado,
      disponibleEn: c.disponible_en,
    })),
    pagos: (pagos ?? []).map((p) => ({ importeCad: Number(p.importe_cad), estado: p.estado, fecha: p.creado_en })),
  };
}

/**
 * Reservar lo disponible para un pago.
 *
 * Primero se apunta el pago y se le cuelgan las comisiones, y sólo después se
 * transfiere: si dos «Retirar» llegan a la vez, el segundo no encuentra
 * comisiones libres y no paga dos veces. Si la transferencia falla, `liberar`
 * las devuelve a disponibles.
 */
export async function reservarParaPagar(admin: Admin, afiliadoId: string) {
  const { comisiones } = await comisionesDe(admin, afiliadoId);
  const libres = comisiones.filter((c) => c.estado === "devengada" && !c.pago_id && new Date(c.disponible_en).getTime() <= Date.now());
  const total = centimos(libres.reduce((t, c) => t + Number(c.importe_cad), 0));
  if (total < MINIMO_PARA_RETIRAR_CAD) return { pagoId: null, totalCad: total };

  const { data: pago, error } = await admin
    .from("pagos_afiliados")
    .insert({ afiliado_id: afiliadoId, importe_cad: total })
    .select("id")
    .single();
  if (error) throw error;

  const { data: tomadas, error: errorAlTomar } = await admin
    .from("comisiones")
    .update({ pago_id: pago.id })
    .in("id", libres.map((c) => c.id))
    .is("pago_id", null)
    .eq("estado", "devengada")
    .select("id, importe_cad");
  if (errorAlTomar) throw errorAlTomar;

  // Si otro pago se llevó alguna mientras tanto, el importe es el de las que
  // de verdad quedaron colgadas de éste.
  const real = centimos((tomadas ?? []).reduce((t, c) => t + Number(c.importe_cad), 0));
  if (real < MINIMO_PARA_RETIRAR_CAD) {
    await liberar(admin, pago.id, "otro pago se llevó las comisiones");
    return { pagoId: null, totalCad: real };
  }
  if (real !== total) await admin.from("pagos_afiliados").update({ importe_cad: real }).eq("id", pago.id);
  return { pagoId: pago.id as string, totalCad: real };
}

/** La transferencia salió: el pago y sus comisiones quedan pagados. */
export async function marcarPagado(admin: Admin, pagoId: string, stripeTransfer: string) {
  await admin.from("pagos_afiliados").update({ estado: "enviado", stripe_transfer: stripeTransfer }).eq("id", pagoId);
  await admin.from("comisiones").update({ estado: "pagada" }).eq("pago_id", pagoId);
}

/** La transferencia no salió: las comisiones vuelven a estar disponibles. */
export async function liberar(admin: Admin, pagoId: string, motivo: string) {
  await admin.from("comisiones").update({ pago_id: null }).eq("pago_id", pagoId).eq("estado", "devengada");
  await admin.from("pagos_afiliados").update({ estado: "fallido", error: motivo.slice(0, 500) }).eq("id", pagoId);
}

/**
 * Lo que ve un negocio de su propio enlace, en Ajustes. Es el mismo panel
 * que en `/afiliados`, para el afiliado que es dueño de este negocio.
 */
export async function panelDelAfiliado(admin: Admin, businessId: string) {
  const { data: afiliado } = await admin
    .from("afiliados")
    .select("id")
    .eq("titular_tipo", "negocio")
    .eq("titular_id", businessId)
    .maybeSingle();

  if (!afiliado) return { tieneEnlace: false as const };
  const panel = await panelDeAfiliado(admin, afiliado.id);
  if (!panel) return { tieneEnlace: false as const };

  return {
    tieneEnlace: true as const,
    codigo: panel.codigo,
    estado: panel.estado,
    firmado: panel.firmado,
    comisionPct: panel.comisionPct,
    referidos: panel.clientes.total,
    pagando: panel.clientes.pagando,
    devengadoCad: centimos(panel.enEsperaCad + panel.disponibleCad),
    pagadoCad: panel.pagadoCad,
  };
}
