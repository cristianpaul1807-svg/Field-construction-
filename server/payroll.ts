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
}

export interface PayrollLine {
  code: string;
  label: string;
  paidBy: DeductionPayer;
  ratePercent: number;
  amount: number;
  /** True when the annual ceiling clipped this line for the period. */
  cappedByMaximum: boolean;
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
    label: "RRQ — Régie des rentes du Québec",
    paidBy: "empleado",
    ratePercent: 6.3,
    annualExemption: 3500,
    annualMaximum: 4479.3,
    sourceNote: "Revenu Québec 2026 · 6,30 % entre 3 500 $ et 74 600 $ · confirmar antes de usar",
  },
  {
    code: "rrq_employeur",
    label: "RRQ — part de l'employeur",
    paidBy: "empleador",
    ratePercent: 6.3,
    annualExemption: 3500,
    annualMaximum: 4479.3,
    sourceNote: "Revenu Québec 2026 · el empleador iguala la del trabajador · confirmar antes de usar",
  },
  {
    code: "rqap",
    label: "RQAP — Régime québécois d'assurance parentale",
    paidBy: "empleado",
    ratePercent: 0.43,
    annualExemption: 0,
    annualMaximum: 442.9,
    sourceNote: "Revenu Québec 2026 · 0,430 % hasta 103 000 $ · confirmar antes de usar",
  },
  {
    code: "rqap_employeur",
    label: "RQAP — part de l'employeur",
    paidBy: "empleador",
    ratePercent: 0.602,
    annualExemption: 0,
    annualMaximum: 620.06,
    sourceNote: "Revenu Québec 2026 · 0,602 % hasta 103 000 $ · confirmar antes de usar",
  },
  {
    code: "ae",
    label: "AE — Assurance-emploi (taux Québec)",
    paidBy: "empleado",
    ratePercent: 1.3,
    annualExemption: 0,
    annualMaximum: 895.7,
    sourceNote: "CRA 2026 · 1,30 $ por 100 $ hasta 68 900 $ · confirmar antes de usar",
  },
  {
    code: "ae_employeur",
    label: "AE — part de l'employeur",
    paidBy: "empleador",
    ratePercent: 1.82,
    annualExemption: 0,
    annualMaximum: 1253.98,
    sourceNote: "CRA 2026 · 1,4 × la del trabajador · confirmar antes de usar",
  },
  {
    code: "impuesto",
    label: "Impôt retenu à la source (fédéral + Québec)",
    paidBy: "empleado",
    ratePercent: 0,
    annualExemption: 0,
    annualMaximum: null,
    sourceNote: "Ponlo tú: depende del TP-1015.3-V y del TD1 de cada persona",
  },
  {
    code: "cnesst",
    label: "CNESST — santé et sécurité du travail",
    paidBy: "empleador",
    ratePercent: 0,
    annualExemption: 0,
    annualMaximum: null,
    sourceNote: "Ponlo tú: la tasa depende de tu unidad de clasificación",
  },
  {
    code: "fss",
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
    .select("code, label, paid_by, rate_percent, annual_exemption, annual_maximum, enabled, source_note")
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
      enabled: true,
    }))
  );
  return seed.map((rule) => ({ ...rule, enabled: true }));
}

/**
 * Applies the rules to one period's gross pay.
 *
 * The annual exemption and ceiling are annual figures being applied to a slice
 * of the year, so they are prorated by the period's share of it. That is an
 * approximation — real payroll tracks year-to-date contributions per person and
 * stops the moment the ceiling is actually reached — and the UI says so. It is
 * the right approximation for the job it does here, which is telling a
 * contractor what a week of work costs, not filing a T4.
 */
export function computePayroll(
  hours: number,
  hourlyRate: number,
  rules: DeductionRule[],
  periodDays: number
): PayrollBreakdown {
  const gross = round(hours * hourlyRate);
  const yearShare = Math.min(1, Math.max(0, periodDays / 365));

  const lines: PayrollLine[] = [];
  for (const rule of rules) {
    if (!rule.enabled || rule.ratePercent === 0) continue;

    const exemption = round(rule.annualExemption * yearShare);
    const base = Math.max(0, gross - exemption);
    let amount = round(base * (rule.ratePercent / 100));

    let capped = false;
    if (rule.annualMaximum !== null) {
      const ceiling = round(rule.annualMaximum * yearShare);
      if (amount > ceiling) {
        amount = ceiling;
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
      .select("employee_id, subcontractor_id, project_id, check_in_time, check_out_time")
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
