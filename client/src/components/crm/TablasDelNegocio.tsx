import { useTranslation } from "react-i18next";
import { useApi } from "@/lib/api";
import { TablaDatos, type Columna } from "@/components/TablaDatos";
import { StatusBadge, invoiceStatusTone, workOrderStatusTone, projectStatusTone } from "@/components/StatusBadge";
import { useTiposDeTrabajo, nombreDeSlug } from "@/lib/tiposDeTrabajo";
import { useFiltroDeObra } from "@/lib/filtroDeObra";

/**
 * Las tablas del negocio.
 *
 * Lo que pidió el jefe es mirar el negocio como se mira una hoja de cálculo:
 * todo en filas y columnas, ordenable, y con la posibilidad de sacarlo fuera.
 * No son pantallas nuevas de datos nuevos — leen lo mismo que las pantallas de
 * trabajo, sólo que sin la forma de tarjeta. La de trabajo es para hacer; esta
 * es para mirar y contar.
 */

interface Obra {
  id: string;
  code: string | null;
  name: string;
  clientName: string | null;
  status: string;
  progressPercent: number;
  startDate: string | null;
  endDate: string | null;
  budgetTotal: number;
  budgetUsed: number;
  team: string[];
}

interface Commessa {
  id: string;
  projectId: string | null;
  kind: "orden" | "cita";
  commessa: string;
  title: string;
  projectName: string | null;
  clientName: string | null;
  serviceType: string | null;
  status: string | null;
  scheduledStart: string | null;
  assignedTo: string | null;
  horas: number;
  personas: number;
  horasSinAprobar: number;
}

interface Factura {
  id: string;
  projectId: string | null;
  number: string | null;
  type: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  holdbackAmount: number;
  amount: number;
  createdAt: string;
  dueDate: string | null;
  paidAt: string | null;
  projectName: string | null;
  clientName: string | null;
}

interface Fichaje {
  id: string;
  projectId: string | null;
  workerName: string | null;
  projectName: string | null;
  jobTitle: string | null;
  commessa: string | null;
  serviceType: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  approved: boolean;
}

/** Horas decimales de un turno. Uno abierto todavía no ha dado ninguna. */
function horasDe(entrada: string, salida: string | null) {
  if (!salida) return 0;
  const ms = new Date(salida).getTime() - new Date(entrada).getTime();
  return ms > 0 ? Math.round((ms / 3_600_000) * 100) / 100 : 0;
}

export function TablaObras() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<Obra[]>("/api/projects");
  // La obra elegida arriba filtra aquí también, aunque aquí deje una sola
  // fila: si esta tabla ignorara el selector, sería la única que lo hace.
  const { filtrar } = useFiltroDeObra();
  const filas = filtrar(data, (o) => o.id);

  const columnas: Columna<Obra>[] = [
    { id: "code", cabecera: t("tabla.col.letra"), tipo: "codigo", valor: (o) => o.code },
    { id: "name", cabecera: t("tabla.col.obra"), valor: (o) => o.name },
    { id: "client", cabecera: t("common.client"), valor: (o) => o.clientName },
    {
      id: "status",
      cabecera: t("common.status"),
      // El valor va en crudo para que el CSV lleve texto y no un componente.
      valor: (o) => t(`projects.statuses.${o.status}`, { defaultValue: o.status }),
      pintar: (o) => (
        <StatusBadge tone={projectStatusTone[o.status as keyof typeof projectStatusTone] ?? "info"}>
          {t(`projects.statuses.${o.status}`, { defaultValue: o.status })}
        </StatusBadge>
      ),
    },
    { id: "progress", cabecera: t("tabla.col.avance"), tipo: "numero", valor: (o) => o.progressPercent, pintar: (o) => `${o.progressPercent} %` },
    { id: "start", cabecera: t("tabla.col.inicio"), tipo: "fecha", valor: (o) => o.startDate },
    { id: "end", cabecera: t("tabla.col.fin"), tipo: "fecha", valor: (o) => o.endDate, ocultaAlInicio: true },
    { id: "budget", cabecera: t("tabla.col.presupuesto"), tipo: "dinero", sumable: true, valor: (o) => o.budgetTotal },
    { id: "used", cabecera: t("tabla.col.gastado"), tipo: "dinero", sumable: true, valor: (o) => o.budgetUsed },
    { id: "team", cabecera: t("tabla.col.equipo"), valor: (o) => o.team.join(", ") || null, ocultaAlInicio: true },
  ];

  return (
    <TablaDatos
      filas={filas}
      columnas={columnas}
      cargando={loading}
      error={error}
      clave={(o) => o.id}
      nombreExport="obras"
      vacio={t("tabla.vacia")}
    />
  );
}

export function TablaCommessas() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<Commessa[]>("/api/work-log");
  const { filtrar } = useFiltroDeObra();
  const filas = filtrar(data, (c) => c.projectId);
  const { data: tipos } = useTiposDeTrabajo();

  const columnas: Columna<Commessa>[] = [
    { id: "commessa", cabecera: t("tabla.col.numero"), tipo: "codigo", valor: (c) => c.commessa },
    { id: "title", cabecera: t("tabla.col.trabajo"), valor: (c) => c.title },
    { id: "client", cabecera: t("common.client"), valor: (c) => c.clientName },
    { id: "project", cabecera: t("common.project"), valor: (c) => c.projectName },
    { id: "tipo", cabecera: t("worker.serviceType"), valor: (c) => nombreDeSlug(c.serviceType, tipos, t) },
    { id: "kind", cabecera: t("tabla.col.origen"), valor: (c) => t(`workLog.kind.${c.kind}`), ocultaAlInicio: true },
    { id: "assigned", cabecera: t("tabla.col.asignado"), valor: (c) => c.assignedTo },
    {
      id: "status",
      cabecera: t("common.status"),
      valor: (c) => (c.status ? t(`workOrders.statuses.${c.status}`, { defaultValue: c.status }) : null),
      pintar: (c) =>
        c.status ? (
          <StatusBadge tone={workOrderStatusTone[c.status as keyof typeof workOrderStatusTone] ?? "info"}>
            {t(`workOrders.statuses.${c.status}`, { defaultValue: c.status })}
          </StatusBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { id: "when", cabecera: t("tabla.col.programado"), tipo: "fecha", valor: (c) => c.scheduledStart },
    { id: "horas", cabecera: t("tabla.col.horas"), tipo: "horas", sumable: true, valor: (c) => c.horas },
    { id: "personas", cabecera: t("tabla.col.personas"), tipo: "numero", valor: (c) => c.personas },
    {
      id: "sinAprobar",
      cabecera: t("tabla.col.sinAprobar"),
      tipo: "numero",
      sumable: true,
      valor: (c) => c.horasSinAprobar,
      ocultaAlInicio: true,
    },
  ];

  return (
    <TablaDatos
      filas={filas}
      columnas={columnas}
      cargando={loading}
      error={error}
      clave={(c) => `${c.kind}-${c.id}`}
      nombreExport="commessas"
      vacio={t("workLog.empty")}
    />
  );
}

export function TablaFacturas() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<Factura[]>("/api/invoices");
  const { filtrar } = useFiltroDeObra();
  const filas = filtrar(data, (f) => f.projectId);

  const columnas: Columna<Factura>[] = [
    { id: "number", cabecera: t("tabla.col.factura"), tipo: "codigo", valor: (f) => f.number },
    { id: "client", cabecera: t("common.client"), valor: (f) => f.clientName },
    { id: "project", cabecera: t("common.project"), valor: (f) => f.projectName, ocultaAlInicio: true },
    { id: "type", cabecera: t("common.type"), valor: (f) => t(`invoicing.type.${f.type}`, { defaultValue: f.type }) },
    {
      id: "status",
      cabecera: t("common.status"),
      valor: (f) => t(`invoicing.status.${f.status}`, { defaultValue: f.status }),
      pintar: (f) => (
        <StatusBadge tone={invoiceStatusTone[f.status as keyof typeof invoiceStatusTone] ?? "info"}>
          {t(`invoicing.status.${f.status}`, { defaultValue: f.status })}
        </StatusBadge>
      ),
    },
    { id: "subtotal", cabecera: t("tabla.col.subtotal"), tipo: "dinero", sumable: true, valor: (f) => f.subtotal },
    { id: "tax", cabecera: t("tabla.col.impuesto"), tipo: "dinero", sumable: true, valor: (f) => f.taxAmount },
    { id: "holdback", cabecera: t("tabla.col.retencion"), tipo: "dinero", sumable: true, valor: (f) => f.holdbackAmount, ocultaAlInicio: true },
    { id: "amount", cabecera: t("tabla.col.total"), tipo: "dinero", sumable: true, valor: (f) => f.amount },
    { id: "created", cabecera: t("tabla.col.emitida"), tipo: "fecha", valor: (f) => f.createdAt },
    { id: "due", cabecera: t("tabla.col.vence"), tipo: "fecha", valor: (f) => f.dueDate },
    { id: "paid", cabecera: t("tabla.col.pagada"), tipo: "fecha", valor: (f) => f.paidAt, ocultaAlInicio: true },
  ];

  return (
    <TablaDatos
      filas={filas}
      columnas={columnas}
      cargando={loading}
      error={error}
      clave={(f) => f.id}
      nombreExport="facturas"
      vacio={t("tabla.vacia")}
    />
  );
}

export function TablaFichajes() {
  const { t, i18n } = useTranslation();
  const { data, loading, error } = useApi<Fichaje[]>("/api/time-entries");
  const { filtrar } = useFiltroDeObra();
  const filas = filtrar(data, (f) => f.projectId);
  const { data: tipos } = useTiposDeTrabajo();

  const momento = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(i18n.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  const columnas: Columna<Fichaje>[] = [
    { id: "worker", cabecera: t("tabla.col.trabajador"), valor: (f) => f.workerName },
    { id: "commessa", cabecera: t("tabla.col.numero"), tipo: "codigo", valor: (f) => f.commessa },
    { id: "job", cabecera: t("tabla.col.trabajo"), valor: (f) => f.jobTitle, ocultaAlInicio: true },
    { id: "project", cabecera: t("common.project"), valor: (f) => f.projectName },
    { id: "tipo", cabecera: t("worker.serviceType"), valor: (f) => nombreDeSlug(f.serviceType, tipos, t) },
    { id: "in", cabecera: t("tabla.col.entrada"), valor: (f) => momento(f.checkInTime) },
    {
      id: "out",
      cabecera: t("tabla.col.salida"),
      // Un turno abierto se dice, no se deja en blanco: el hueco no distingue
      // entre "sigue trabajando" y "se olvidó de cerrar".
      valor: (f) => momento(f.checkOutTime) ?? t("checkIn.stillOnSite"),
    },
    { id: "horas", cabecera: t("tabla.col.horas"), tipo: "horas", sumable: true, valor: (f) => horasDe(f.checkInTime, f.checkOutTime) },
    {
      id: "approved",
      cabecera: t("tabla.col.aprobado"),
      valor: (f) => (f.approved ? t("common.yes") : t("common.no")),
    },
  ];

  return (
    <TablaDatos
      filas={filas}
      columnas={columnas}
      cargando={loading}
      error={error}
      clave={(f) => f.id}
      nombreExport="fichajes"
      vacio={t("checkIn.noEntries")}
    />
  );
}
