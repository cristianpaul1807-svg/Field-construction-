import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useApi, apiFetch, readJson, downloadFile } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * The office's view of what the crew costs.
 *
 * Nothing here is required. A contractor who pays cash and keeps it in their
 * head never sets a rate, sees an empty table, and loses nothing — every other
 * part of the product works exactly as before. Whoever wants the control fills
 * in rates and gets hours, deductions, net pay and a PDF.
 *
 * It never appears in the field app. What someone earns is between them and
 * the office.
 */

interface PayrollLine {
  code: string;
  label: string;
  paidBy: "empleado" | "empleador";
  ratePercent: number;
  amount: number;
  cappedByMaximum: boolean;
}

interface Breakdown {
  hours: number;
  hourlyRate: number;
  gross: number;
  lines: PayrollLine[];
  employeeDeductions: number;
  employerContributions: number;
  net: number;
  totalCost: number;
}

interface WorkerRow {
  workerId: string;
  kind: "employee" | "subcontractor";
  name: string;
  hourlyRate: number | null;
  hours: number;
  breakdown: Breakdown | null;
}

interface Remittance {
  runCount: number;
  grossTotal: number;
  destinations: {
    destination: string;
    employee: number;
    employer: number;
    total: number;
    lines: { code: string; label: string; paidBy: string; amount: number }[];
  }[];
}

interface Deduction {
  code: string;
  label: string;
  paidBy: "empleado" | "empleador";
  ratePercent: number;
  annualExemption: number;
  annualMaximum: number | null;
  enabled: boolean;
  sourceNote: string | null;
  remitTo: string;
}

interface Run {
  id: string;
  workerName: string;
  periodStart: string;
  periodEnd: string;
  hours: number;
  gross: number;
  net: number;
  totalCost: number;
}

/** Default to the fortnight just gone: the period most crews are paid on. */
function defaultPeriod() {
  const end = new Date();
  const start = new Date(end.getTime() - 13 * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export default function Payroll() {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState(defaultPeriod);
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: hours, loading } = useApi<{ periodDays: number; workers: WorkerRow[] }>(
    `/api/payroll/hours?from=${period.from}&to=${period.to}&_r=${reloadToken}`
  );
  const { data: runs, reload: reloadRuns } = useApi<Run[]>(`/api/payroll/runs?_r=${reloadToken}`);

  const record = async (worker: WorkerRow) => {
    setBusyId(worker.workerId);
    setError(null);
    try {
      const res = await apiFetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: worker.workerId, kind: worker.kind, from: period.from, to: period.to }),
      });
      if (!res.ok) {
        const body = await readJson<{ error?: string }>(res);
        throw new Error(body?.error || t("common.genericError"));
      }
      reloadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setBusyId(null);
    }
  };

  const rows = hours?.workers ?? [];
  const withRate = rows.filter((w) => w.breakdown);
  const totalCost = withRate.reduce((sum, w) => sum + (w.breakdown?.totalCost ?? 0), 0);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader title={t("payroll.title")} description={t("payroll.description")} />

      <Tabs defaultValue="period">
        <TabsList>
          <TabsTrigger value="period">{t("payroll.tabPeriod")}</TabsTrigger>
          <TabsTrigger value="issued">{t("payroll.tabIssued")}</TabsTrigger>
          <TabsTrigger value="remittance">{t("payroll.tabRemittance")}</TabsTrigger>
          <TabsTrigger value="rules">{t("payroll.tabRules")}</TabsTrigger>
        </TabsList>

        <TabsContent value="period" className="mt-4 space-y-4">
          <Card className="p-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">{t("payroll.from")}</Label>
              <Input
                type="date"
                value={period.from}
                onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">{t("payroll.to")}</Label>
              <Input
                type="date"
                value={period.to}
                onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
              />
            </div>
            <Button variant="outline" onClick={() => setReloadToken((n) => n + 1)}>
              {t("payroll.recalculate")}
            </Button>
          </Card>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" /> {t("common.loading")}
            </div>
          )}
          {error && <p className="text-sm text-status-error-fg">{error}</p>}

          {!loading && rows.length === 0 && (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("payroll.noApprovedHours")}</p>
            </Card>
          )}

          {rows.map((worker) => (
            <Card key={worker.workerId} className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{worker.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("payroll.hoursApproved", { hours: worker.hours })}
                    {worker.hourlyRate ? ` · ${formatCurrency(worker.hourlyRate)}/h` : ""}
                  </p>
                </div>
                {worker.breakdown && (
                  <Button size="sm" variant="outline" onClick={() => record(worker)} disabled={busyId === worker.workerId}>
                    {busyId === worker.workerId ? <Spinner className="size-4" /> : <FileText size={14} />}
                    {t("payroll.record")}
                  </Button>
                )}
              </div>

              {/* No rate is not an error state — it is the default. It just says
                  where to set one, for the people who want to. */}
              {!worker.breakdown ? (
                <p className="text-xs text-muted-foreground">{t("payroll.noRateSet")}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Figure label={t("payroll.gross")} value={worker.breakdown.gross} />
                    <Figure label={t("payroll.employeeSide")} value={-worker.breakdown.employeeDeductions} />
                    <Figure label={t("payroll.net")} value={worker.breakdown.net} strong />
                    <Figure label={t("payroll.totalCost")} value={worker.breakdown.totalCost} strong />
                  </div>
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {worker.breakdown.lines.map((line) => (
                      <div key={line.code} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className="text-xs text-muted-foreground min-w-0">
                          {line.label} · {line.ratePercent}%
                          {line.cappedByMaximum ? ` · ${t("payroll.cappedShort")}` : ""}
                        </span>
                        <span
                          className={
                            line.paidBy === "empleado"
                              ? "text-xs text-foreground flex-shrink-0"
                              : "text-xs text-muted-foreground flex-shrink-0"
                          }
                        >
                          {line.paidBy === "empleado" ? "−" : "+"}
                          {formatCurrency(line.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          ))}

          {withRate.length > 0 && (
            <p className="text-xs text-muted-foreground">{t("payroll.ytdNote")}</p>
          )}
          {withRate.length > 0 && (
            <Card className="p-4 flex-row items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("payroll.periodTotalCost")}</span>
              <span className="text-lg font-semibold text-foreground">{formatCurrency(totalCost)}</span>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="issued" className="mt-4 space-y-3">
          {(runs ?? []).length === 0 && (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">{t("payroll.noRuns")}</p>
            </Card>
          )}
          {(runs ?? []).map((run) => (
            <Card key={run.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{run.workerName}</p>
                <p className="text-xs text-muted-foreground">
                  {run.periodStart} → {run.periodEnd} · {t("payroll.hoursApproved", { hours: run.hours })}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(run.net)}</p>
                  <p className="text-xs text-muted-foreground">{t("payroll.costShort", { amount: formatCurrency(run.totalCost) })}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    downloadFile(
                      `/api/payroll/runs/${run.id}/pdf?lang=${i18n.language.slice(0, 2)}`,
                      `${t("payroll.filePrefix")}-${run.workerName.replace(/\s+/g, "-")}.pdf`
                    )
                  }
                >
                  <Download size={14} /> PDF
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="remittance" className="mt-4">
          <RemittanceSummary from={period.from} to={period.to} />
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <DeductionEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * What has to be remitted for the period, and to whom.
 *
 * Built from issued sheets rather than from hours: a remittance is owed on what
 * was actually withheld, and a preview nobody committed to is not a liability.
 */
function RemittanceSummary({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const { data, loading } = useApi<Remittance>(`/api/payroll/remittance?from=${from}&to=${to}`);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }
  if (!data || data.runCount === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{t("payroll.remittanceEmpty")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-1">
        <p className="text-sm text-muted-foreground">{t("payroll.remittanceNote")}</p>
        <p className="text-xs text-muted-foreground">
          {t("payroll.remittanceRuns", { count: data.runCount, gross: formatCurrency(data.grossTotal) })}
        </p>
      </Card>

      {data.destinations.map((group) => (
        <Card key={group.destination} className="p-5 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t(`payroll.destinations.${group.destination}`, { defaultValue: group.destination })}
            </h3>
            <span className="text-lg font-semibold text-foreground">{formatCurrency(group.total)}</span>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {group.lines.map((line) => (
              <div key={line.code} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-xs text-muted-foreground min-w-0">{line.label}</span>
                <span className="text-xs text-foreground flex-shrink-0">{formatCurrency(line.amount)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t("payroll.remitEmployeeShare")}: {formatCurrency(group.employee)}
            </span>
            <span>
              {t("payroll.remitEmployerShare")}: {formatCurrency(group.employer)}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={strong ? "text-base font-semibold text-foreground" : "text-base text-foreground"}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

/**
 * The deduction lines, editable.
 *
 * Rows rather than code because Quebec's rates change every January, Ontario's
 * list is different, and CNESST and the health services fund depend on the
 * industry and payroll size of this specific company. Each line carries where
 * its number came from, so the next person can check it instead of trusting it.
 */
function DeductionEditor() {
  const { t } = useTranslation();
  const { data, loading } = useApi<Deduction[]>("/api/payroll/deductions");
  const [rows, setRows] = useState<Deduction[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (data && rows === null) setRows(data);

  const update = (index: number, patch: Partial<Deduction>) => {
    setSaved(false);
    setRows((current) => (current ?? []).map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/payroll/deductions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deductions: rows }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !rows) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">{t("payroll.rulesNote")}</p>
      </Card>

      {rows.map((row, index) => (
        <Card key={index} className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <Label className="text-xs">{t("payroll.lineName")}</Label>
              <Input value={row.label} onChange={(e) => update(index, { label: e.target.value })} />
            </div>
            <div className="w-full sm:w-44 space-y-1.5">
              <Label className="text-xs">{t("payroll.paidBy")}</Label>
              <Select
                value={row.paidBy}
                onValueChange={(v) => update(index, { paidBy: v as Deduction["paidBy"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empleado">{t("payroll.payerEmployee")}</SelectItem>
                  <SelectItem value="empleador">{t("payroll.payerEmployer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-52 space-y-1.5">
              <Label className="text-xs">{t("payroll.remitTo")}</Label>
              <Select value={row.remitTo} onValueChange={(v) => update(index, { remitTo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["revenu_quebec", "cra", "cnesst", "otro"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(`payroll.destinations.${d}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-muted-foreground hover:text-status-error-fg"
              onClick={() => {
                setSaved(false);
                setRows((current) => (current ?? []).filter((_, i) => i !== index));
              }}
              aria-label={t("common.delete")}
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("payroll.ratePercent")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.001"
                value={row.ratePercent}
                onChange={(e) => update(index, { ratePercent: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("payroll.annualExemption")}</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={row.annualExemption}
                onChange={(e) => update(index, { annualExemption: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("payroll.annualMaximum")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.annualMaximum ?? ""}
                placeholder={t("payroll.noCeiling")}
                onChange={(e) =>
                  update(index, { annualMaximum: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </div>
          </div>
          {row.sourceNote && <p className="text-xs text-muted-foreground">{row.sourceNote}</p>}
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setSaved(false);
            setRows((current) => [
              ...(current ?? []),
              {
                code: `linea_${(current?.length ?? 0) + 1}`,
                label: "",
                paidBy: "empleado",
                ratePercent: 0,
                annualExemption: 0,
                annualMaximum: null,
                enabled: true,
                sourceNote: null,
                remitTo: "otro",
              },
            ]);
          }}
        >
          <Plus size={14} /> {t("payroll.addLine")}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner className="size-4" /> : null}
          {t("common.save")}
        </Button>
        {saved && <span className="text-xs text-muted-foreground">{t("paymentPlan.saved")}</span>}
      </div>
    </div>
  );
}
