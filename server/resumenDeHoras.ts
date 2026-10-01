/**
 * Las horas del mes de cada persona, día a día, para quien hace la nómina.
 *
 * En Italia la nómina no se hace aquí: la hace el consulente del lavoro, y lo
 * que necesita de la empresa cada mes es esto —por trabajador y por día, las
 * horas ordinarias, las extraordinarias y por qué no vino cuando no vino—. Con
 * eso hace la busta paga y la denuncia a la Cassa Edile. Sin un resumen así,
 * alguien se lo copia del registro a mano, que es donde se cuelan los errores
 * que luego cuestan una multa o una nómina rehecha.
 *
 * Sirve igual en Canadá, para quien lleva la nómina fuera.
 *
 * Sólo cuentan los fichajes aprobados, como en la nómina: uno sin aprobar es lo
 * que alguien dice que trabajó, no lo que la empresa acepta. Se cuentan aparte
 * para que el resumen diga que le faltan, en vez de salir corto en silencio.
 */

import type { getSupabaseAdmin } from "./supabaseAdmin";
import { entryHours } from "./payroll";
import { diaEnZona, fechaEnZona, medianocheEnZona, zonaHorariaDelNegocio } from "../shared/zonaHoraria";
import { TIPOS_DE_AUSENCIA, type TipoDeAusencia } from "../shared/ausencias";

type Admin = ReturnType<typeof getSupabaseAdmin>;

const redondear = (n: number) => Math.round(n * 100) / 100;

export interface DiaDeLaPersona {
  ordinarias: number;
  extraordinarias: number;
  ausencia: TipoDeAusencia | null;
}

export interface PersonaDelMes {
  id: string;
  nombre: string;
  puesto: string | null;
  dias: Record<string, DiaDeLaPersona>;
  totales: {
    ordinarias: number;
    extraordinarias: number;
    /** Días laborables (lunes a viernes) de cada ausencia. */
    ausencias: Record<TipoDeAusencia, number>;
  };
}

export interface ResumenDeHoras {
  mes: string;
  zonaHoraria: string;
  fechas: string[];
  personas: PersonaDelMes[];
  /** Fichajes del mes que no entran porque nadie los ha aprobado. */
  sinAprobar: number;
}

/** «2026-10» → las fechas del mes, de la primera a la última. */
function fechasDelMes(mes: string): string[] {
  const [a, m] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: dias }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}

function esLaborable(fecha: string): boolean {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6;
}

export function esMesValido(mes: unknown): mes is string {
  return typeof mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

export async function resumenDeHoras(admin: Admin, businessId: string, mes: string): Promise<ResumenDeHoras> {
  const { data: negocio } = await admin.from("businesses").select("country, province").eq("id", businessId).maybeSingle();
  const zona = zonaHorariaDelNegocio(negocio?.country, negocio?.province);
  const fechas = fechasDelMes(mes);
  const primera = fechas[0];
  const ultima = fechas[fechas.length - 1];
  // El mes de la obra, de medianoche a medianoche en su zona.
  const desde = medianocheEnZona(primera, zona);
  const hasta = diaEnZona(medianocheEnZona(ultima, zona), zona).hasta;

  const [empleados, fichajes, ausencias] = await Promise.all([
    // Sólo la plantilla: un subcontratista factura, no tiene nómina.
    admin.from("employees").select("id, name, role").eq("business_id", businessId).order("name"),
    admin
      .from("time_entries")
      .select("employee_id, check_in_time, check_out_time, overtime, approved")
      .eq("business_id", businessId)
      .not("employee_id", "is", null)
      .gte("check_in_time", desde.toISOString())
      .lt("check_in_time", hasta.toISOString()),
    admin
      .from("time_off")
      .select("employee_id, start_date, end_date, kind")
      .eq("business_id", businessId)
      .eq("status", "aprobada")
      .not("employee_id", "is", null)
      .lte("start_date", ultima)
      .gte("end_date", primera),
  ]);
  if (empleados.error) throw empleados.error;
  if (fichajes.error) throw fichajes.error;
  if (ausencias.error) throw ausencias.error;

  const vacio = (): DiaDeLaPersona => ({ ordinarias: 0, extraordinarias: 0, ausencia: null });
  const personas = new Map<string, PersonaDelMes>();
  const asegurar = (id: string, nombre: string, puesto: string | null) => {
    let p = personas.get(id);
    if (!p) {
      p = {
        id,
        nombre,
        puesto,
        dias: Object.fromEntries(fechas.map((f) => [f, vacio()])),
        totales: {
          ordinarias: 0,
          extraordinarias: 0,
          ausencias: Object.fromEntries(TIPOS_DE_AUSENCIA.map((k) => [k, 0])) as Record<TipoDeAusencia, number>,
        },
      };
      personas.set(id, p);
    }
    return p;
  };
  const porId = new Map((empleados.data ?? []).map((e) => [e.id, e]));

  let sinAprobar = 0;
  for (const f of fichajes.data ?? []) {
    if (!f.check_out_time) continue;
    if (!f.approved) {
      sinAprobar++;
      continue;
    }
    const e = porId.get(f.employee_id!);
    if (!e) continue;
    const horas = entryHours(f.check_in_time, f.check_out_time);
    if (horas <= 0) continue;
    const p = asegurar(e.id, e.name, e.role ?? null);
    const dia = p.dias[fechaEnZona(new Date(f.check_in_time), zona)];
    if (!dia) continue;
    if (f.overtime) dia.extraordinarias = redondear(dia.extraordinarias + horas);
    else dia.ordinarias = redondear(dia.ordinarias + horas);
  }

  for (const a of ausencias.data ?? []) {
    const e = porId.get(a.employee_id!);
    if (!e) continue;
    const p = asegurar(e.id, e.name, e.role ?? null);
    for (const fecha of fechas) {
      if (fecha < a.start_date || fecha > a.end_date) continue;
      // Si un día tiene horas y ausencia —se fue a media mañana— se apuntan
      // las dos: el consulente decide, y esconder una sería decidir por él.
      p.dias[fecha].ausencia = a.kind as TipoDeAusencia;
    }
  }

  // Quien está de alta sale aunque no haya fichado nada: un mes en blanco es
  // información para el consulente, no algo que esconder.
  for (const e of empleados.data ?? []) {
    asegurar(e.id, e.name, e.role ?? null);
  }

  for (const p of Array.from(personas.values())) {
    for (const fecha of fechas) {
      const d = p.dias[fecha];
      p.totales.ordinarias = redondear(p.totales.ordinarias + d.ordinarias);
      p.totales.extraordinarias = redondear(p.totales.extraordinarias + d.extraordinarias);
      if (d.ausencia && esLaborable(fecha)) p.totales.ausencias[d.ausencia]++;
    }
  }

  return {
    mes,
    zonaHoraria: zona,
    fechas,
    personas: Array.from(personas.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    sinAprobar,
  };
}

/** Una celda de CSV: comillas si hace falta, y nunca una fórmula. */
function celda(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Una fila por persona y día, que es lo que se importa en cualquier hoja de
 * cálculo o programa de nóminas sin rehacer columnas. Los encabezados van en
 * el idioma de quien lo descarga; los valores de ausencia también, porque
 * quien lo lee es una persona y no un sistema.
 */
export function resumenEnCsv(
  r: ResumenDeHoras,
  encabezados: { persona: string; puesto: string; fecha: string; ordinarias: string; extraordinarias: string; ausencia: string },
  nombreDeAusencia: (k: TipoDeAusencia) => string
): string {
  const filas = [[encabezados.persona, encabezados.puesto, encabezados.fecha, encabezados.ordinarias, encabezados.extraordinarias, encabezados.ausencia]];
  for (const p of r.personas) {
    for (const fecha of r.fechas) {
      const d = p.dias[fecha];
      if (!d.ordinarias && !d.extraordinarias && !d.ausencia) continue;
      filas.push([p.nombre, p.puesto ?? "", fecha, String(d.ordinarias), String(d.extraordinarias), d.ausencia ? nombreDeAusencia(d.ausencia) : ""]);
    }
  }
  // BOM: sin él, Excel abre los acentos rotos.
  return "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n") + "\r\n";
}

/** Los encabezados y las ausencias del CSV, en el idioma de quien lo pide. */
export const TEXTOS_DEL_RESUMEN: Record<
  "es" | "en" | "fr" | "it",
  { encabezados: Parameters<typeof resumenEnCsv>[1]; ausencias: Record<TipoDeAusencia, string> }
> = {
  es: {
    encabezados: { persona: "Persona", puesto: "Puesto", fecha: "Fecha", ordinarias: "Horas ordinarias", extraordinarias: "Horas extra", ausencia: "Ausencia" },
    ausencias: { vacaciones: "Vacaciones", enfermedad: "Enfermedad", permiso: "Permiso", festivo: "Festivo", maltempo: "Mal tiempo", infortunio: "Accidente de trabajo" },
  },
  en: {
    encabezados: { persona: "Person", puesto: "Role", fecha: "Date", ordinarias: "Regular hours", extraordinarias: "Overtime hours", ausencia: "Absence" },
    ausencias: { vacaciones: "Holiday", enfermedad: "Sick leave", permiso: "Leave", festivo: "Public holiday", maltempo: "Bad weather", infortunio: "Work injury" },
  },
  fr: {
    encabezados: { persona: "Personne", puesto: "Poste", fecha: "Date", ordinarias: "Heures normales", extraordinarias: "Heures supplémentaires", ausencia: "Absence" },
    ausencias: { vacaciones: "Vacances", enfermedad: "Maladie", permiso: "Congé", festivo: "Férié", maltempo: "Intempéries", infortunio: "Accident du travail" },
  },
  it: {
    encabezados: { persona: "Lavoratore", puesto: "Mansione", fecha: "Data", ordinarias: "Ore ordinarie", extraordinarias: "Ore straordinarie", ausencia: "Assenza" },
    ausencias: { vacaciones: "Ferie", enfermedad: "Malattia", permiso: "Permesso", festivo: "Festività", maltempo: "Maltempo", infortunio: "Infortunio" },
  },
};
