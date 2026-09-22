/**
 * Quién nos trae clientes, y cuánto le debemos por ello.
 *
 * Esto es dinero **nuestro**, no del contratista: las tres tablas no llevan
 * `business_id` como los datos de un negocio, y tienen RLS activada sin
 * ninguna política para que sólo entre la clave de servicio.
 *
 * ## Los enlaces los damos a mano, a propósito
 *
 * No hay alta de afiliados ni formulario público. Se crea la fila cuando
 * decidimos dársela a alguien, y no cobra nada hasta que `contrato_en` tenga
 * fecha. Un programa de afiliados abierto antes de saber si el producto se
 * adopta reparte comisiones sobre clientes que se van, y el afiliado al que le
 * pasa eso no vuelve a recomendarte.
 *
 * ## Lo que aquí no se decide
 *
 * Si un cliente se puede ir. Se puede, siempre, y ninguna cláusula lo cambia.
 * Lo único que se corta al cancelar un afiliado es su comisión.
 */

import { getSupabaseAdmin } from "./supabaseAdmin";

type Admin = ReturnType<typeof getSupabaseAdmin>;

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

export interface AltaDeAfiliado {
  titularTipo: "negocio" | "persona";
  /** El negocio dueño del enlace, si lo es. Un contable de fuera no tiene. */
  titularId?: string | null;
  nombre: string;
  email?: string | null;
  /** Sin fecha, el enlace funciona y atribuye, pero no devenga comisión. */
  contratoEn?: string | null;
  comisionPct?: number;
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
        nombre: alta.nombre,
        email: alta.email ?? null,
        codigo: codigoNuevo(),
        contrato_en: alta.contratoEn ?? null,
        comision_pct: alta.comisionPct ?? 10,
        notas: alta.notas ?? null,
      })
      .select("id, codigo, nombre, comision_pct, contrato_en")
      .single();

    if (!error) return data;
    // 23505 es el índice único del código. Cualquier otro error es de verdad.
    if ((error as { code?: string }).code !== "23505") throw error;
  }
  throw new Error("No se pudo generar un código de afiliado libre");
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
 * - Nadie se refiere a sí mismo. Sin esto, el primer «afiliado» es alguien
 *   descontándose un 10 % de su propia suscripción.
 */
export async function atribuirNegocio(admin: Admin, businessId: string, codigo: string | null | undefined) {
  const limpio = String(codigo ?? "").trim().toUpperCase();
  if (!limpio) return null;

  try {
    const { data: afiliado } = await admin
      .from("afiliados")
      .select("id, estado, titular_id")
      .eq("codigo", limpio)
      .maybeSingle();

    if (!afiliado || afiliado.estado === "cancelado") return null;
    if (afiliado.titular_id && afiliado.titular_id === businessId) {
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
 * `contrato_en` sin fecha significa que ese afiliado todavía no ha firmado.
 * Entonces no se devenga nada, y es a propósito: prometerle por escrito lo que
 * cobrará es lo primero, apuntárselo en una tabla es después.
 */
export async function anotarComision(
  admin: Admin,
  businessId: string,
  cobro: { stripeInvoice: string; baseCad: number; periodo: Date }
) {
  try {
    const { data: referido } = await admin
      .from("referidos")
      .select("id, estado, afiliados(id, estado, contrato_en, comision_pct)")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!referido || referido.estado === "anulado") return;
    const afiliado = (referido as { afiliados?: { estado?: string; contrato_en?: string | null; comision_pct?: number } | null }).afiliados;
    if (!afiliado || afiliado.estado !== "activo" || !afiliado.contrato_en) return;

    const pct = Number(afiliado.comision_pct ?? 10);
    // Redondeado una vez, aquí, que es donde deja de ser un cálculo y pasa a
    // ser un número que alguien va a cobrar.
    const importe = Math.round(cobro.baseCad * (pct / 100) * 100) / 100;

    const { error } = await admin.from("comisiones").insert({
      referido_id: referido.id,
      periodo: cobro.periodo.toISOString().slice(0, 10),
      base_cad: cobro.baseCad,
      importe_cad: importe,
      stripe_invoice: cobro.stripeInvoice,
    });
    // 23505: ya estaba anotada. El webhook llegó dos veces y eso está bien.
    if (error && (error as { code?: string }).code !== "23505") throw error;

    if (referido.estado === "prueba") {
      await admin
        .from("referidos")
        .update({ estado: "pagando", primera_paga_en: new Date().toISOString() })
        .eq("id", referido.id);
    }
  } catch (err) {
    // Un fallo aquí no puede tumbar el webhook: el cobro del negocio ya está
    // hecho y lo que se pierde es nuestra anotación, que se puede rehacer.
    console.error("[afiliados] no se pudo anotar la comisión", businessId, err instanceof Error ? err.message : err);
  }
}

/** Lo que ve un negocio de su propio enlace. Nunca datos de otros afiliados. */
export async function panelDelAfiliado(admin: Admin, businessId: string) {
  const { data: afiliado } = await admin
    .from("afiliados")
    .select("id, codigo, estado, contrato_en, comision_pct")
    .eq("titular_tipo", "negocio")
    .eq("titular_id", businessId)
    .maybeSingle();

  if (!afiliado) return { tieneEnlace: false as const };

  const { data: referidos } = await admin
    .from("referidos")
    .select("id, estado, atribuido_en")
    .eq("afiliado_id", afiliado.id);

  const ids = (referidos ?? []).map((r) => r.id);
  const { data: comisiones } = ids.length
    ? await admin.from("comisiones").select("importe_cad, estado").in("referido_id", ids)
    : { data: [] as { importe_cad: number; estado: string }[] };

  const suma = (estado: string) =>
    Math.round((comisiones ?? []).filter((c) => c.estado === estado).reduce((total, c) => total + Number(c.importe_cad), 0) * 100) / 100;

  return {
    tieneEnlace: true as const,
    codigo: afiliado.codigo,
    estado: afiliado.estado,
    // Sin contrato firmado el enlace atribuye pero no paga, y la pantalla
    // tiene que decirlo: prometer una comisión que no se va a devengar es la
    // forma más rápida de perder al afiliado y la confianza a la vez.
    firmado: Boolean(afiliado.contrato_en),
    comisionPct: Number(afiliado.comision_pct),
    referidos: (referidos ?? []).length,
    pagando: (referidos ?? []).filter((r) => r.estado === "pagando").length,
    devengadoCad: suma("devengada"),
    pagadoCad: suma("pagada"),
  };
}
