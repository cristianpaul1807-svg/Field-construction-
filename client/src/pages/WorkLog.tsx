import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, workOrderStatusTone } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Clock, Users, CalendarClock, MapPin, AlertCircle } from "lucide-react";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Commessa } from "@/components/Commessa";
import { useTiposDeTrabajo, nombreDeSlug } from "@/lib/tiposDeTrabajo";
import { enlaceDeMapa } from "@/lib/mapaExterno";
import { duracionDeTurno } from "@/lib/duracion";

interface Linea {
  id: string;
  kind: "orden" | "cita";
  commessa: string;
  title: string;
  projectName: string | null;
  projectCode: string | null;
  serviceType: string | null;
  serviceLetter: string | null;
  status: string | null;
  priority: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  assignedTo: string | null;
  horas: number;
  fichajes: number;
  personas: number;
  primerFichaje: string | null;
  ultimoCierre: string | null;
  horasSinAprobar: number;
}

interface Entrada {
  id: string;
  workerName: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  checkInLocation: string | null;
  checkOutLocation: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  approved: boolean;
  serviceType: string | null;
  horas: number;
}

interface Detalle {
  commessa: string;
  kind: "orden" | "cita";
  title: string;
  notes: string | null;
  projectName: string | null;
  projectCode: string | null;
  serviceType: string | null;
  status: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  assignedTo: string | null;
  horas: number;
  entradas: Entrada[];
}

/** Las horas como las diría una persona: "7 h 30", no "7.5". */
function enHoras(h: number, t: ReturnType<typeof useTranslation>["t"]) {
  if (h <= 0) return t("workLog.noHours");
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  return horas === 0 ? `${minutos} min` : `${horas} h ${String(minutos).padStart(2, "0")}`;
}

function DetalleDialog({ commessa, onClose }: { commessa: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { data: tipos } = useTiposDeTrabajo();
  const { data, loading } = useApi<Detalle>(commessa ? `/api/work-log/${encodeURIComponent(commessa)}` : null);

  const hora = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(i18n.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <Dialog open={Boolean(commessa)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Commessa code={commessa} />
            <span className="text-base font-medium">{data?.title}</span>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t("common.loading")}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-secondary/40 p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">{t("workLog.totalHours")}</p>
                <p className="text-lg font-bold text-foreground">{enHoras(data.horas, t)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("workLog.entries")}</p>
                <p className="text-lg font-bold text-foreground">{data.entradas.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("common.project")}</p>
                <p className="text-sm font-medium text-foreground truncate" title={data.projectName ?? undefined}>{data.projectName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("worker.serviceType")}</p>
                <p className="text-sm font-medium text-foreground">{nombreDeSlug(data.serviceType, tipos, t)}</p>
              </div>
            </div>

            {data.notes && <p className="text-sm text-muted-foreground">{data.notes}</p>}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("workLog.whoWorked")}
              </p>
              {data.entradas.length === 0 && (
                /* Un trabajo programado del que todavía nadie fichó no es un
                   error, es un trabajo que no ha empezado. Se dice así. */
                <p className="text-sm text-muted-foreground py-4 text-center">{t("workLog.noEntriesYet")}</p>
              )}
              {data.entradas.map((e) => (
                <div key={e.id} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{e.workerName}</span>
                    <span className="text-sm font-semibold text-foreground">
                      {e.checkOutTime ? duracionDeTurno(e.checkInTime, e.checkOutTime, t) : t("checkIn.inProgress")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hora(e.checkInTime)} → {hora(e.checkOutTime) ?? t("checkIn.stillOnSite")}
                  </p>
                  {/* Dónde estaba al fichar, no dónde estaba la obra: es la
                      única prueba de que la hora se trabajó donde se dice. */}
                  {e.checkInLat !== null && e.checkInLng !== null && (
                    <a
                      href={enlaceDeMapa(e.checkInLat, e.checkInLng, data.projectName ?? undefined)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline hover:text-foreground flex w-fit items-center gap-1"
                    >
                      <MapPin size={11} /> {e.checkInLocation}
                    </a>
                  )}
                  {e.checkOutTime && !e.approved && (
                    <p className="text-xs text-status-warning-fg flex items-center gap-1">
                      <AlertCircle size={11} /> {t("workLog.notApproved")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * El registro de trabajo, por número de obra.
 *
 * El trabajo vivía repartido: la orden en su lista, la cita en el calendario,
 * las horas en fichajes. Para saber qué llevaba encima un trabajo había que
 * cruzar tres pantallas y fiarse de la memoria. Aquí cada línea es un número
 * de obra con lo que de verdad pasó en ella — quién, cuándo y cuántas horas —
 * que es como se pregunta en una obra: por el número, no por el nombre.
 */
export default function WorkLog() {
  const { t, i18n } = useTranslation();
  const { data: lineas, loading, error } = useApi<Linea[]>("/api/work-log");
  const { data: tipos } = useTiposDeTrabajo();
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  // Sin acentos: media plantilla de Quebec se llama Gagné y quien busca
  // escribe "gagne" con el teclado que tenga a mano.
  const sinAcentos = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const aguja = sinAcentos(busqueda.trim());
  const visibles = (lineas ?? []).filter(
    (l) =>
      !aguja ||
      sinAcentos([l.commessa, l.title, l.projectName, l.assignedTo].filter(Boolean).join(" ")).includes(aguja)
  );

  const cuando = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "2-digit" }) : null;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title={t("workLog.title")} description={t("workLog.description")} />

      {(lineas?.length ?? 0) > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("workLog.searchPlaceholder")}
            className="pl-9"
            aria-label={t("workLog.searchPlaceholder")}
          />
        </div>
      )}

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
        <div className="space-y-2">
          {visibles.map((l) => (
            <Card
              key={`${l.kind}-${l.id}`}
              role="button"
              tabIndex={0}
              onClick={() => setAbierta(l.commessa)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAbierta(l.commessa);
                }
              }}
              className="p-4 cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Commessa code={l.commessa} />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t(`workLog.kind.${l.kind}`)}
                    </span>
                    {l.status && (
                      <StatusBadge tone={workOrderStatusTone[l.status as keyof typeof workOrderStatusTone]}>
                        {t(`workOrders.statuses.${l.status}`)}
                      </StatusBadge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.projectName} · {nombreDeSlug(l.serviceType, tipos, t)}
                    {l.assignedTo ? ` · ${l.assignedTo}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock size={11} className="flex-shrink-0" />
                    {cuando(l.scheduledStart) ?? <span className="italic">{t("workOrders.notScheduled")}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground flex items-center justify-end gap-1">
                      <Clock size={12} strokeWidth={1.75} /> {enHoras(l.horas, t)}
                    </p>
                    {l.personas > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <Users size={11} /> {t("workLog.peopleCount", { count: l.personas })}
                      </p>
                    )}
                    {/* Lo que le falta al jefe por hacer con este trabajo. */}
                    {l.horasSinAprobar > 0 && (
                      <p className="text-xs text-status-warning-fg">
                        {t("workLog.pendingApproval", { count: l.horasSinAprobar })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {aguja && visibles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("workLog.noMatches", { query: busqueda.trim() })}
            </p>
          )}
          {!aguja && lineas?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("workLog.empty")}</p>
          )}
        </div>
      )}

      <DetalleDialog commessa={abierta} onClose={() => setAbierta(null)} />
    </div>
  );
}
