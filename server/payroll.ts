import type { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * What a worker costs, from the hours they clocked.
 *
 * The check-ins were already there and already approved; nothing turned them
 * into money. So a contractor could see that Luc worked 38 hours and still had
 * no idea what the job cost, and Control de costos compared an estimate
 * against typed-in expenses with the biggest line — labour — missing.
 *
 * Everything here is optional. A worker with no rate contributes no cost and
 * appears in no payroll: the software goes back to behaving exactly as it did.
 * Whoever wants the control fills in a rate and gets it.
 *
 * The deduction rates are the business's, not ours. Quebec's change every
 * January, Ontario's list is different, and CNESST and the health services fund
 * depend on the industry and size of the specific company. We seed the
 * structure with real figures and say where each came from; confirming them is
 * the business's job, and the software says so rather than pretending to be an
 * authority it is not.
 */

export type DeductionPayer = "empleado" | "empleador";

export interface DeductionRule {
  code: string;
  label: string;
  paidBy: DeductionPayer;
  ratePercent: number;
  annualExemption: number;
  annualMaximum: number | null;
  enabled: boolean;
  sourceNote: string | null;
  /** Who this line is remitted to. Free text: the lines belong to the business. */
  remitTo: string;
}

export interface PayrollLine {
  code: string;
  label: string;
  paidBy: DeductionPayer;
  ratePercent: number;
  amount: number;
  /** True when the annual ceiling clipped this line — the worker is done for the year. */
  cappedByMaximum: boolean;
  remitTo: string;
}

export interface PayrollBreakdown {
  hours: number;
  hourlyRate: number;
  gross: number;
  lines: PayrollLine[];
  employeeDeductions: number;
  employerContributions: number;
  /** What lands in the worker's account. */
  net: number;
  /** What the job actually costs the business: gross plus employer side. */
  totalCost: number;
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The starting point for a business in Quebec, as published for 2026.
 *
 * These are seeded once, editable afterwards, and every line carries where it
 * came from — because a rate nobody can trace is a rate nobody should trust,
 * and these move every January. Income tax is deliberately a single editable
 * line rather than a bracket calculation: real withholding depends on the
 * worker's TP-1015.3-V and TD1 claims, and a bracket table applied without them
 * would be confidently wrong more often than right.
 */
export const QUEBEC_2026_DEDUCTIONS: Omit<DeductionRule, "enabled">[] = [
  {
    code: "rrq",
    remitTo: "revenu_quebec",
    label: "RRQ — Régie des rentes du Québec",
    paidBy: "empleado",
    ratePercent: 6.3,
    annualExemption: 3500,
    annualMaximum: 4479.3,
    sourceNote: "Revenu Québec 2026 · 6,30 % entre 3 500 $ et 74 600 $ · confirmar antes de usar",
  },
  {
    code: "rrq_employeur",
    remitTo: "revenu_quebec",
    label: "RRQ — part de l'employeur",
    paidBy: "empleador",
    ratePercent: 6.3,
    annualExemption: 3500,
    annualMaximum: 4479.3,
    sourceNote: "Revenu Québec 2026 · el empleador iguala la del trabajador · confirmar antes de usar",
  },
  {
    code: "rqap",
    remitTo: "revenu_quebec",
    label: "RQAP — Régime québécois d'assurance parentale",
    paidBy: "empleado",
    ratePercent: 0.43,
    annualExemption: 0,
    annualMaximum: 442.9,
    sourceNote: "Revenu Québec 2026 · 0,430 % hasta 103 000 $ · confirmar antes de usar",
  },
  {
    code: "rqap_employeur",
    remitTo: "revenu_quebec",
    label: "RQAP — part de l'employeur",
    paidBy: "empleador",
    ratePercent: 0.602,
    annualExemption: 0,
    annualMaximum: 620.06,
    sourceNote: "Revenu Québec 2026 · 0,602 % hasta 103 000 $ · confirmar antes de usar",
  },
  {
    code: "ae",
    remitTo: "cra",
    label: "AE — Assurance-emploi (taux Québec)",
    paidBy: "empleado",
    ratePercent: 1.3,
    annualExemption: 0,
    annualMaximum: 895.7,
    sourceNote: "CRA 2026 · 1,30 $ por 100 $ hasta 68 900 $ · confirmar antes de usar",
  },
  {
    code: "ae_employeur",
    remitTo: "cra",
    label: "AE — part de l'employeur",
    paidBy: "empleador",
    ratePercent: 1.82,
    annualExemption: 0,
    annualMaximum: 1253.98,
    sourceNote: "CRA 2026 · 1,4 × la del trabajador · confirmar antes de usar",
  },
  {
    code: "impuesto",
    remitTo: "revenu_quebec",
    label: "Impôt retenu à la source (fédéral + Québec)",
    paidBy: "empleado",
    ratePercent: 0,
    annualExemption: 0,
    annualMaximum: null,
    sourceNote: "Ponlo tú: depende del TP-1015.3-V y del TD1 de cada persona",
  },
  {
    code: "cnesst",
    remitTo: "cnesst",
    label: "CNESST — santé et sécurité du travail",
    paidBy: "empleador",
    ratePercent: 0,
    annualExemption: 0,
    annualMaximum: null,
    sourceNote: "Ponlo tú: la tasa depende de tu unidad de clasificación",
  },
  {
    code: "fss",
    remitTo: "revenu_quebec",
    label: "FSS — Fonds des services de santé",
    paidBy: "empleador",
    ratePercent: 0,
    annualExemption: 0,
    annualMaximum: null,
    sourceNote: "Ponlo tú: depende de tu masa salarial total y del sector",
  },
];

/**
 * Reads the business's deduction rules, seeding the jurisdiction's defaults the
 * first time. Seeding on read rather than at signup means a business that
 * existed before this feature gets the list the first time they open the page,
 * instead of an empty screen that looks broken.
 */
export async function readDeductions(admin: Admin, businessId: string): Promise<DeductionRule[]> {
  const { data } = await admin
    .from("payroll_deductions")
    .select("code, label, paid_by, rate_percent, annual_exemption, annual_maximum, enabled, source_note, remit_to")
    .eq("business_id", businessId)
    .order("position");

  if (data && data.length > 0) {
    return data.map((d) => ({
      code: d.code,
      label: d.label,
      paidBy: d.paid_by as DeductionPayer,
      ratePercent: Number(d.rate_percent),
      annualExemption: Number(d.annual_exemption),
      annualMaximum: d.annual_maximum === null ? null : Number(d.annual_maximum),
      enabled: d.enabled,
      sourceNote: d.source_note,
      remitTo: d.remit_to ?? "otro",
    }));
  }

  const { data: business } = await admin
    .from("businesses")
    .select("province")
    .eq("id", businessId)
    .maybeSingle();

  // Only Quebec has a published starting list here. Everywhere else opens
  // empty rather than being handed Quebec's numbers under another name.
  const seed = business?.province === "QC" ? QUEBEC_2026_DEDUCTIONS : [];
  if (seed.length === 0) return [];

  await admin.from("payroll_deductions").insert(
    seed.map((rule, index) => ({
      business_id: businessId,
      position: index + 1,
      code: rule.code,
      label: rule.label,
      paid_by: rule.paidBy,
      rate_percent: rule.ratePercent,
      annual_exemption: rule.annualExemption,
      annual_maximum: rule.annualMaximum,
      source_note: rule.sourceNote,
      remit_to: rule.remitTo,
      enabled: true,
    }))
  );
  return seed.map((rule) => ({ ...rule, enabled: true }));
}

/**
 * What each worker has already contributed this calendar year, per rule.
 *
 * Two sources, summed: the sheets issued here, and the opening balance typed in
 * when the business moved over mid-year. A ceiling is an annual figure, so a
 * business that switched in June with no opening balance would keep deducting
 * RRQ months after the worker actually reached the maximum — and would have to
 * keep the old payroll open beside this one to know that. The opening balance
 * is what makes leaving the old system final.
 */
export async function yearToDate(
  admin: Admin,
  businessId: string,
  workerId: string,
  kind: "employee" | "subcontractor",
  year: number
): Promise<Record<string, number>> {
  const column = kind === "employee" ? "employee_id" : "subcontractor_id";
  const [runs, opening] = await Promise.all([
    admin
      .from("payroll_runs")
      .select("lines")
      .eq("business_id", businessId)
      .eq(column, workerId)
      .gte("period_end", `${year}-01-01`)
      .lte("period_end", `${year}-12-31`),
    admin
      .from("payroll_opening_balances")
      .select("lines")
      .eq("business_id", businessId)
      .eq(column, workerId)
      .eq("year", year)
      .maybeSingle(),
  ]);

  const totals: Record<string, number> = {};
  const add = (lines: unknown) => {
    for (const line of (lines ?? []) as Array<{ code?: string; amount?: number }>) {
      if (!line.code) continue;
      totals[line.code] = round((totals[line.code] ?? 0) + Number(line.amount ?? 0));
    }
  };
  for (const run of runs.data ?? []) add(run.lines);
  add(opening.data?.lines);
  return totals;
}

/**
 * Everything a worker earned and paid in one calendar year — issued sheets plus
 * the opening balance.
 *
 * This is what the year-end forms ask for. The software does not produce a T4
 * or an RL-1 (those are filed documents with their own rules and their own
 * boxes) but it does hold every figure they want, which is the part a business
 * would otherwise reopen another payroll system to recover.
 */
export interface AnnualTotals {
  workerId: string;
  kind: "employee" | "subcontractor";
  name: string;
  gross: number;
  employeeDeductions: number;
  employerContributions: number;
  net: number;
  totalCost: number;
  hours: number;
  byCode: Array<{ code: string; label: string; paidBy: DeductionPayer; amount: number; remitTo: string }>;
  /** True when part of the year came from a previous system. */
  includesOpeningBalance: boolean;
}

export async function annualTotals(admin: Admin, businessId: string, year: number): Promise<AnnualTotals[]> {
  const [runs, openings, employees, subcontractors] = await Promise.all([
    admin
      .from("payroll_runs")
      .select("employee_id, subcontractor_id, worker_name, hours, gross, lines")
      .eq("business_id", businessId)
      .gte("period_end", `${year}-01-01`)
      .lte("period_end", `${year}-12-31`),
    admin
      .from("payroll_opening_balances")
      .select("employee_id, subcontractor_id, gross, lines")
      .eq("business_id", businessId)
      .eq("year", year),
    admin.from("employees").select("id, name").eq("business_id", businessId),
    admin.from("subcontractors").select("id, name").eq("business_id", businessId),
  ]);

  const names = new Map<string, { name: string; kind: "employee" | "subcontractor" }>();
  for (const e of employees.data ?? []) names.set(e.id, { name: e.name, kind: "employee" });
  for (const s of subcontractors.data ?? []) names.set(s.id, { name: s.name, kind: "subcontractor" });

  const totals = new Map<string, AnnualTotals>();
  const bucket = (workerId: string | null, fallbackName: string) => {
    if (!workerId) return null;
    let entry = totals.get(workerId);
    if (!entry) {
      const known = names.get(workerId);
      entry = {
        workerId,
        kind: known?.kind ?? "employee",
        name: known?.name ?? fallbackName,
        gross: 0,
        employeeDeductions: 0,
        employerContributions: 0,
        net: 0,
        totalCost: 0,
        hours: 0,
        byCode: [],
        includesOpeningBalance: false,
      };
      totals.set(workerId, entry);
    }
    return entry;
  };

  const codes = new Map<string, Map<string, { code: string; label: string; paidBy: DeductionPayer; amount: number; remitTo: string }>>();
  const addLines = (entry: AnnualTotals, lines: unknown) => {
    const perWorker = codes.get(entry.workerId) ?? new Map();
    codes.set(entry.workerId, perWorker);
    for (const raw of (lines ?? []) as Array<Record<string, unknown>>) {
      const code = String(raw.code ?? "");
      if (!code) continue;
      const amount = Number(raw.amount ?? 0);
      const paidBy: DeductionPayer = raw.paidBy === "empleador" ? "empleador" : "empleado";
      const existing = perWorker.get(code);
      perWorker.set(code, {
        code,
        label: String(raw.label ?? code),
        paidBy,
        remitTo: String(raw.remitTo ?? "otro"),
        amount: round((existing?.amount ?? 0) + amount),
      });
      if (paidBy === "empleado") entry.employeeDeductions = round(entry.employeeDeductions + amount);
      else entry.employerContributions = round(entry.employerContributions + amount);
    }
  };

  for (const run of runs.data ?? []) {
    const entry = bucket(run.employee_id ?? run.subcontractor_id, run.worker_name);
    if (!entry) continue;
    entry.gross = round(entry.gross + Number(run.gross));
    entry.hours = round(entry.hours + Number(run.hours));
    addLines(entry, run.lines);
  }
  for (const opening of openings.data ?? []) {
    const entry = bucket(opening.employee_id ?? opening.subcontractor_id, "—");
    if (!entry) continue;
    entry.gross = round(entry.gross + Number(opening.gross));
    entry.includesOpeningBalance = true;
    addLines(entry, opening.lines);
  }

  for (const entry of Array.from(totals.values())) {
    entry.byCode = Array.from(codes.get(entry.workerId)?.values() ?? []);
    entry.net = round(entry.gross - entry.employeeDeductions);
    entry.totalCost = round(entry.gross + entry.employerContributions);
  }
  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Applies the rules to one period's gross pay.
 *
 * Two different mechanics, because Revenu Québec and the CRA treat them
 * differently and conflating them is the usual way payroll goes wrong:
 *
 * - The **exemption** is spread across the year's pay periods. RRQ's $3,500 is
 *   not free money in January; each period gets its slice.
 * - The **ceiling** is annual and hard. It is checked against what this worker
 *   has already contributed this year, so their RRQ stops the period they
 *   actually reach the maximum — not gradually, by being clipped in every
 *   period, which is what prorating the ceiling did and which quietly
 *   under-deducted all year.
 *
 * `ytd` is what they have contributed so far this calendar year, per rule code.
 * Pass an empty object for a standalone estimate.
 */
export function computePayroll(
  hours: number,
  hourlyRate: number,
  rules: DeductionRule[],
  periodDays: number,
  ytd: Record<string, number> = {}
): PayrollBreakdown {
  const gross = round(hours * hourlyRate);
  const yearShare = Math.min(1, Math.max(0, periodDays / 365));

  const lines: PayrollLine[] = [];
  for (const rule of rules) {
    if (!rule.enabled || rule.ratePercent === 0) continue;

    const periodExemption = round(rule.annualExemption * yearShare);
    const base = Math.max(0, gross - periodExemption);
    const raw = round(base * (rule.ratePercent / 100));

    let amount = raw;
    let capped = false;
    if (rule.annualMaximum !== null) {
      const room = round(Math.max(0, rule.annualMaximum - (ytd[rule.code] ?? 0)));
      if (raw > room) {
        amount = room;
        capped = true;
      }
    }
    if (amount <= 0) continue;

    lines.push({
      code: rule.code,
      label: rule.label,
      paidBy: rule.paidBy,
      ratePercent: rule.ratePercent,
      amount,
      cappedByMaximum: capped,
      remitTo: rule.remitTo,
    });
  }

  const employeeDeductions = round(
    lines.filter((l) => l.paidBy === "empleado").reduce((sum, l) => sum + l.amount, 0)
  );
  const employerContributions = round(
    lines.filter((l) => l.paidBy === "empleador").reduce((sum, l) => sum + l.amount, 0)
  );

  return {
    hours: round(hours),
    hourlyRate: round(hourlyRate),
    gross,
    lines,
    employeeDeductions,
    employerContributions,
    net: round(gross - employeeDeductions),
    totalCost: round(gross + employerContributions),
  };
}

/** Whole hours worked in a closed time entry, to two decimals. */
export function entryHours(checkIn: string, checkOut: string | null): number {
  if (!checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return round(ms / 3_600_000);
}

export interface WorkerHours {
  workerId: string;
  kind: "employee" | "subcontractor";
  name: string;
  hourlyRate: number | null;
  hours: number;
  /** Of those hours, the ones past the eighth of a day. */
  overtimeHours: number;
  /** Hours per project, for the cost figures rather than the payslip. */
  byProject: Record<string, number>;
}

/**
 * Approved hours per worker for a period.
 *
 * Only approved entries count. An unapproved check-in is a claim, not a cost,
 * and the whole point of the approve button is that somebody looked at it —
 * paying against unreviewed hours would make that button decorative.
 */
export async function approvedHours(
  admin: Admin,
  businessId: string,
  from: string,
  to: string
): Promise<WorkerHours[]> {
  const [entries, employees, subcontractors] = await Promise.all([
    admin
      .from("time_entries")
      .select("employee_id, subcontractor_id, project_id, check_in_time, check_out_time, overtime")
      .eq("business_id", businessId)
      .eq("approved", true)
      .gte("check_in_time", from)
      .lte("check_in_time", to),
    admin.from("employees").select("id, name, hourly_rate").eq("business_id", businessId),
    admin.from("subcontractors").select("id, name, hourly_rate").eq("business_id", businessId),
  ]);

  const people = new Map<string, WorkerHours>();
  for (const e of employees.data ?? []) {
    people.set(e.id, {
      workerId: e.id,
      kind: "employee",
      name: e.name,
      hourlyRate: e.hourly_rate === null ? null : Number(e.hourly_rate),
      hours: 0,
      overtimeHours: 0,
      byProject: {},
    });
  }
  for (const s of subcontractors.data ?? []) {
    people.set(s.id, {
      workerId: s.id,
      kind: "subcontractor",
      name: s.name,
      hourlyRate: s.hourly_rate === null ? null : Number(s.hourly_rate),
      hours: 0,
      overtimeHours: 0,
      byProject: {},
    });
  }

  for (const entry of entries.data ?? []) {
    const id = entry.employee_id ?? entry.subcontractor_id;
    const person = id ? people.get(id) : undefined;
    if (!person) continue;
    const hours = entryHours(entry.check_in_time, entry.check_out_time);
    if (hours <= 0) continue;
    person.hours = round(person.hours + hours);
    if (entry.overtime) person.overtimeHours = round(person.overtimeHours + hours);
    if (entry.project_id) {
      person.byProject[entry.project_id] = round((person.byProject[entry.project_id] ?? 0) + hours);
    }
  }

  return Array.from(people.values());
}

/**
 * Labour actually worked, per project, valued at each worker's rate.
 *
 * Workers with no rate contribute nothing — not zero hours, no money — so a
 * business that never fills in rates sees the cost figures it always saw.
 */
export async function labourCostByProject(
  admin: Admin,
  businessId: string
): Promise<Record<string, number>> {
  const workers = await approvedHours(admin, businessId, "1970-01-01", new Date(Date.now() + 86_400_000).toISOString());
  const byProject: Record<string, number> = {};
  for (const worker of workers) {
    if (worker.hourlyRate === null || worker.hourlyRate <= 0) continue;
    for (const [projectId, hours] of Object.entries(worker.byProject)) {
      byProject[projectId] = round((byProject[projectId] ?? 0) + hours * worker.hourlyRate);
    }
  }
  return byProject;
}
