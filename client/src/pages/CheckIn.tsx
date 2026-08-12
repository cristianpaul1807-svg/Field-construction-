import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin, Check, Clock } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface TimeEntry {
  id: string;
  projectName: string | null;
  workerName: string | null;
  checkInTime: string;
  checkInLocation: string | null;
  checkOutTime: string | null;
  approved: boolean;
}

export default function CheckIn() {
  const { t, i18n } = useTranslation();
  const { data: entries, loading, error } = useApi<TimeEntry[]>("/api/time-entries");
  const [locallyApproved, setLocallyApproved] = useState<Set<string>>(new Set());

  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }) : null;

  // Approving hours is a payroll decision, so the duration has to be on
  // screen — reading it off two timestamps is the manager's job otherwise.
  const duration = (entry: TimeEntry) => {
    if (!entry.checkOutTime) return null;
    const minutes = Math.round(
      (new Date(entry.checkOutTime).getTime() - new Date(entry.checkInTime).getTime()) / 60000
    );
    if (minutes <= 0) return null;
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
  };

  const approve = async (id: string) => {
    setLocallyApproved((prev) => new Set(prev).add(id));
    try {
      const res = await apiFetch(`/api/time-entries/${id}/approve`, { method: "PATCH" });
      if (!res.ok) throw new Error();
    } catch {
      setLocallyApproved((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={t("checkIn.title")}
        description={t("checkIn.description")}
      />

      <Card className="p-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
            {t("common.loadError", { message: error })}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {entries?.map((entry) => {
              const isApproved = entry.approved || locallyApproved.has(entry.id);
              return (
                <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {entry.workerName?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{entry.workerName}</p>
                      <p className="text-xs text-muted-foreground">{entry.projectName}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin size={11} /> {entry.checkInLocation ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{t("checkIn.in")}: {time(entry.checkInTime)}</p>
                      <p>{t("checkIn.out")}: {time(entry.checkOutTime) ?? t("checkIn.inProgress")}</p>
                      {duration(entry) && (
                        <p className="flex items-center justify-end gap-1 text-foreground mt-0.5">
                          <Clock size={11} strokeWidth={1.75} /> {duration(entry)}
                        </p>
                      )}
                    </div>
                    {isApproved ? (
                      <StatusBadge tone="success">{t("checkIn.approved")}</StatusBadge>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => approve(entry.id)}>
                        <Check size={14} /> {t("checkIn.approveHours")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {entries?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("checkIn.noEntries")}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
