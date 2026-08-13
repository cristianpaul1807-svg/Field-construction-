import type { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * The eight-hour day, and what comes after it.
 *
 * A shift that runs past eight hours in a day is not more of the same: those
 * hours usually cost more, they are the ones worth watching, and a business
 * that cannot see them cannot tell a job that ran long from a crew that simply
 * stayed. So the shift is cut at the moment the eighth hour is reached — the
 * ordinary part closes there and an overtime entry carries on.
 *
 * The cut is made on check-out rather than by a timer, because that is the
 * first moment the total is actually known and this product has no scheduler.
 * The result is identical: two rows whose times add up to the shift that was
 * worked, with the boundary at the instant it was crossed.
 */

type Admin = ReturnType<typeof getSupabaseAdmin>;

export const REGULAR_HOURS_PER_DAY = 8;
const MS_PER_HOUR = 3_600_000;

/** Local midnight for a timestamp, which is the day a shift belongs to. */
function startOfDay(iso: string): Date {
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  return day;
}

export interface SplitResult {
  /** Milliseconds of the shift that counted as ordinary time. */
  regularMs: number;
  /** Milliseconds that became overtime. Zero when the day stayed under eight. */
  overtimeMs: number;
  /** The instant the eighth hour was reached, when there is one. */
  boundary: Date | null;
}

/**
 * Where a shift crosses the eighth hour of its day.
 *
 * `priorMs` is what the same person already worked that day on other entries,
 * so a second shift starting at hour seven goes to overtime after one hour,
 * not after eight.
 */
export function splitAtEightHours(checkIn: Date, checkOut: Date, priorMs: number): SplitResult {
  const shiftMs = checkOut.getTime() - checkIn.getTime();
  if (!Number.isFinite(shiftMs) || shiftMs <= 0) return { regularMs: 0, overtimeMs: 0, boundary: null };

  const budgetMs = Math.max(0, REGULAR_HOURS_PER_DAY * MS_PER_HOUR - priorMs);
  if (shiftMs <= budgetMs) return { regularMs: shiftMs, overtimeMs: 0, boundary: null };

  return {
    regularMs: budgetMs,
    overtimeMs: shiftMs - budgetMs,
    boundary: new Date(checkIn.getTime() + budgetMs),
  };
}

/**
 * Closes an entry, splitting it if the day went past eight hours.
 *
 * Returns the id of the overtime entry when one was created. Never throws into
 * the caller: a worker's check-out must succeed even if the bookkeeping behind
 * it does not, because the alternative is somebody stuck on the clock.
 */
export async function closeEntryWithOvertime(
  admin: Admin,
  input: {
    businessId: string;
    entryId: string;
    checkOutTime: Date;
    location: string;
    latitude: number;
    longitude: number;
  }
): Promise<{ overtimeEntryId: string | null }> {
  const { data: entry } = await admin
    .from("time_entries")
    .select(
      "id, business_id, project_id, employee_id, subcontractor_id, check_in_time, check_out_time, billable, service_type, check_in_location, check_in_lat, check_in_lng, overtime"
    )
    .eq("business_id", input.businessId)
    .eq("id", input.entryId)
    .maybeSingle();

  const close = {
    check_out_time: input.checkOutTime.toISOString(),
    check_out_location: input.location,
    check_out_lat: input.latitude,
    check_out_lng: input.longitude,
  };

  // Nothing to reason about: close it the plain way.
  if (!entry || entry.check_out_time || entry.overtime) {
    await admin.from("time_entries").update(close).eq("business_id", input.businessId).eq("id", input.entryId);
    return { overtimeEntryId: null };
  }

  try {
    const checkIn = new Date(entry.check_in_time);
    const day = startOfDay(entry.check_in_time);
    const nextDay = new Date(day.getTime() + 86_400_000);
    const workerColumn = entry.employee_id ? "employee_id" : "subcontractor_id";
    const workerId = entry.employee_id ?? entry.subcontractor_id;

    // Everything else this person already closed today. Only regular hours
    // consume the eight-hour budget; overtime is already past it.
    const { data: sameDay } = await admin
      .from("time_entries")
      .select("id, check_in_time, check_out_time, overtime")
      .eq("business_id", input.businessId)
      .eq(workerColumn, workerId)
      .gte("check_in_time", day.toISOString())
      .lt("check_in_time", nextDay.toISOString())
      .not("check_out_time", "is", null);

    const priorMs = (sameDay ?? [])
      .filter((row) => row.id !== entry.id && !row.overtime)
      .reduce((sum, row) => sum + (new Date(row.check_out_time!).getTime() - new Date(row.check_in_time).getTime()), 0);

    const split = splitAtEightHours(checkIn, input.checkOutTime, priorMs);

    if (split.overtimeMs <= 0 || !split.boundary) {
      await admin.from("time_entries").update(close).eq("business_id", input.businessId).eq("id", input.entryId);
      return { overtimeEntryId: null };
    }

    // The ordinary part ends exactly where the eighth hour was reached. The
    // location is the check-out location for both halves: the person did not
    // move at the boundary, and inventing a coordinate would be worse.
    await admin
      .from("time_entries")
      .update({
        check_out_time: split.boundary.toISOString(),
        check_out_location: input.location,
        check_out_lat: input.latitude,
        check_out_lng: input.longitude,
      })
      .eq("business_id", input.businessId)
      .eq("id", entry.id);

    const { data: created, error } = await admin
      .from("time_entries")
      .insert({
        business_id: entry.business_id,
        project_id: entry.project_id,
        employee_id: entry.employee_id,
        subcontractor_id: entry.subcontractor_id,
        billable: entry.billable,
        service_type: entry.service_type,
        overtime: true,
        split_from: entry.id,
        check_in_time: split.boundary.toISOString(),
        check_in_location: entry.check_in_location,
        check_in_lat: entry.check_in_lat,
        check_in_lng: entry.check_in_lng,
        ...close,
      })
      .select("id")
      .single();
    if (error) throw error;

    return { overtimeEntryId: created.id };
  } catch (err) {
    console.error("[workTime] overtime split failed", input.entryId, err);
    // The split is bookkeeping; being clocked out is not. Close it plainly.
    await admin.from("time_entries").update(close).eq("business_id", input.businessId).eq("id", input.entryId);
    return { overtimeEntryId: null };
  }
}

// ---------- Planned against actual ----------

export interface WorkerPerformance {
  workerId: string;
  kind: "employee" | "subcontractor";
  name: string;
  /** Hours booked on the calendar for the period. */
  plannedHours: number;
  /** Hours actually clocked, ordinary time only. */
  actualHours: number;
  /** Hours past eight in a day. */
  overtimeHours: number;
  /** actual − planned. Negative means less time than the plan expected. */
  differenceHours: number;
  /** actual ÷ planned as a percentage, null when nothing was planned. */
  adherencePercent: number | null;
  /** Scheduled jobs whose window closed with no overlapping check-in. */
  missedJobs: number;
  plannedJobs: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * What was planned for each worker against what they actually did.
 *
 * The comparison a foreman makes in their head and nobody writes down. It is
 * deliberately three numbers rather than a score: hours planned, hours worked,
 * and jobs that passed with nobody on them. A single "efficiency %" would
 * flatten a crew who worked longer than planned and a crew who skipped a job
 * into the same figure, and those need different conversations.
 */
export async function workerPerformance(
  admin: Admin,
  businessId: string,
  from: string,
  to: string
): Promise<WorkerPerformance[]> {
  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999`).toISOString();

  const [events, entries, employees, subcontractors] = await Promise.all([
    admin
      .from("schedule_events")
      .select("id, start_time, end_time, assigned_employee_id, assigned_subcontractor_id")
      .eq("business_id", businessId)
      .gte("start_time", fromIso)
      .lte("start_time", toIso),
    admin
      .from("time_entries")
      .select("employee_id, subcontractor_id, check_in_time, check_out_time, overtime")
      .eq("business_id", businessId)
      .gte("check_in_time", fromIso)
      .lte("check_in_time", toIso)
      .not("check_out_time", "is", null),
    admin.from("employees").select("id, name").eq("business_id", businessId),
    admin.from("subcontractors").select("id, name").eq("business_id", businessId),
  ]);

  const people = new Map<string, WorkerPerformance>();
  const add = (id: string, name: string, kind: "employee" | "subcontractor") => {
    people.set(id, {
      workerId: id,
      kind,
      name,
      plannedHours: 0,
      actualHours: 0,
      overtimeHours: 0,
      differenceHours: 0,
      adherencePercent: null,
      missedJobs: 0,
      plannedJobs: 0,
    });
  };
  for (const e of employees.data ?? []) add(e.id, e.name, "employee");
  for (const s of subcontractors.data ?? []) add(s.id, s.name, "subcontractor");

  // Worked intervals per person, so a scheduled job can be checked against
  // whether anybody was actually on the clock while it was meant to happen.
  const worked = new Map<string, { start: number; end: number }[]>();

  for (const entry of entries.data ?? []) {
    const id = entry.employee_id ?? entry.subcontractor_id;
    const person = id ? people.get(id) : undefined;
    if (!person || !entry.check_out_time) continue;
    const start = new Date(entry.check_in_time).getTime();
    const end = new Date(entry.check_out_time).getTime();
    const hours = (end - start) / MS_PER_HOUR;
    if (hours <= 0) continue;
    if (entry.overtime) person.overtimeHours = round(person.overtimeHours + hours);
    else person.actualHours = round(person.actualHours + hours);
    worked.set(id!, [...(worked.get(id!) ?? []), { start, end }]);
  }

  for (const event of events.data ?? []) {
    const id = event.assigned_employee_id ?? event.assigned_subcontractor_id;
    const person = id ? people.get(id) : undefined;
    if (!person) continue;
    const start = new Date(event.start_time).getTime();
    const end = new Date(event.end_time).getTime();
    const hours = (end - start) / MS_PER_HOUR;
    if (hours <= 0) continue;
    person.plannedHours = round(person.plannedHours + hours);
    person.plannedJobs += 1;

    // Missed means nobody was clocked in at any point during the window. A
    // partial overlap is not missed — they were there, just not for all of it,
    // and that already shows in the hours.
    const overlaps = (worked.get(id!) ?? []).some((w) => w.start < end && w.end > start);
    if (!overlaps) person.missedJobs += 1;
  }

  return Array.from(people.values())
    .filter((p) => p.plannedHours > 0 || p.actualHours > 0 || p.overtimeHours > 0)
    .map((p) => ({
      ...p,
      differenceHours: round(p.actualHours + p.overtimeHours - p.plannedHours),
      adherencePercent:
        p.plannedHours > 0 ? Math.round(((p.actualHours + p.overtimeHours) / p.plannedHours) * 100) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
