import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileSignature, Download, Send, Trash2, Plus, Pencil } from "lucide-react";
import { useApi, apiFetch, readJson, downloadFile, serverMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/mockData";

/**
 * Los acuerdos de una persona: empleado o subcontratista.
 *
 * Vive en un diálogo y no en la fila porque la lista de personas ya es densa,
 * y porque así el mismo componente sirve a las dos pantallas y a sus dos
 * diseños —la tabla del escritorio y las fichas del móvil— sin repetir nada.
 */

const TONO: Record<string, StatusTone> = {
  borrador: "neutral",
  enviado: "info",
  firmado: "success",
  rechazado: "error",
  terminado: "neutral",
};

const FORMAS_DE_PAGO = ["por_hora", "fijo", "por_obra"] as const;
const FRECUENCIAS = ["semanal", "quincenal", "mensual", "al_terminar"] as const;

interface Acuerdo {
  id: string;
  number: string;
  kind: "empleo" | "subcontrato";
  title: string | null;
  startDate: string;
  endDate: string | null;
  payKind: (typeof FORMAS_DE_PAGO)[number];
  payAmount: number;
  payFrequency: (typeof FRECUENCIAS)[number];
  hoursPerWeek: number | null;
  vacationPercent: number;
  terms: string | null;
  notes: string | null;
  status: keyof typeof TONO;
  signedAt: string | null;
  signatureName: string | null;
}

type Borrador = {
  kind: "empleo" | "subcontrato";
  title: string;
  startDate: string;
  endDate: string;
  payKind: (typeof FORMAS_DE_PAGO)[number];
  payAmount: string;
  payFrequency: (typeof FRECUENCIAS)[number];
  hoursPerWeek: string;
  vacationPercent: string;
  terms: string;
  notes: string;
};

const vacio = (kind: "empleo" | "subcontrato"): Borrador => ({
  kind,
  title: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  payKind: kind === "subcontrato" ? "por_obra" : "por_hora",
  payAmount: "",
  payFrequency: kind === "subcontrato" ? "al_terminar" : "quincenal",
  hoursPerWeek: "",
  // Quebec: 4 % hasta los tres años de servicio, 6 % a partir de ahí.
  vacationPercent: "4",
  terms: "",
  notes: "",
});

const desdeAcuerdo = (a: Acuerdo): Borrador => ({
  kind: a.kind,
  title: a.title ?? "",
  startDate: a.startDate,
  endDate: a.endDate ?? "",
  payKind: a.payKind,
  payAmount: String(a.payAmount),
  payFrequency: a.payFrequency,
  hoursPerWeek: a.hoursPerWeek == null ? "" : String(a.hoursPerWeek),
  vacationPercent: String(a.vacationPercent),
  terms: a.terms ?? "",
  notes: a.notes ?? "",
});

export function AcuerdosDeTrabajo({
  kind,
  workerId,
  workerName,
  onClose,
}: {
  kind: "employee" | "subcontractor";
  workerId: string;
  workerName: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [recarga, setRecarga] = useState(0);
  const query = kind === "employee" ? `employeeId=${workerId}` : `subcontractorId=${workerId}`;
  const { data: acuerdos, loading } = useApi<Acuerdo[]>(`/api/agreements?${query}&_r=${recarga}`);

  const [editando, setEditando] = useState<Acuerdo | "nuevo" | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(() => vacio(kind === "employee" ? "empleo" : "subcontrato"));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);

  const recargar = () => setRecarga((n) => n + 1);

  const abrirNuevo = () => {
    setBorrador(vacio(kind === "employee" ? "empleo" : "subcontrato"));
    setEditando("nuevo");
    setError(null);
  };
  const abrirEdicion = (a: Acuerdo) => {
    setBorrador(desdeAcuerdo(a));
    setEditando(a);
    setError(null);
  };

  const guardar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const cuerpo = {
        ...(kind === "employee" ? { employeeId: workerId } : { subcontractorId: workerId }),
        ...borrador,
        payAmount: Number(borrador.payAmount || 0),
        hoursPerWeek: borrador.hoursPerWeek === "" ? null : Number(borrador.hoursPerWeek),
        vacationPercent: Number(borrador.vacationPercent || 0),
        endDate: borrador.endDate || null,
      };
      const nuevo = editando === "nuevo";
      const res = await apiFetch(nuevo ? "/api/agreements" : `/api/agreements/${(editando as Acuerdo).id}`, {
        method: nuevo ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("common.genericError")));
      setEditando(null);
      recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setOcupado(false);
    }
  };

  const descargar = (a: Acuerdo) =>
    downloadFile(`/api/agreements/${a.id}/pdf?download=1&lang=${i18n.language.slice(0, 2)}`, `${a.number}.pdf`);

  const mandar = async (a: Acuerdo) => {
    setOcupado(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/agreements/${a.id}/send`, { method: "POST" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(serverMessage(body, t, t("common.genericError")));
      setEnviado(a.id);
      setTimeout(() => setEnviado(null), 2500);
      recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async (a: Acuerdo) => {
    if (!window.confirm(t("agreements.deleteConfirm", { number: a.number }))) return;
    setError(null);
    const res = await apiFetch(`/api/agreements/${a.id}`, { method: "DELETE" });
    if (res.ok) recargar();
    else setError(serverMessage(await readJson(res), t, t("common.genericError")));
  };

  const resumenDePago = (a: Acuerdo) =>
    [
      `${formatCurrency(a.payAmount)} · ${t(`agreements.payKind.${a.payKind}`)}`,
      t(`agreements.payFrequency.${a.payFrequency}`),
    ].join(" · ");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("agreements.title", { name: workerName })}</DialogTitle>
          <DialogDescription>{t("agreements.description")}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-status-error-fg">{error}</p>}

        {editando ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-titulo">{t("agreements.agreementTitle")} ({t("common.optional")})</Label>
                <Input
                  id="ac-titulo"
                  value={borrador.title}
                  onChange={(e) => setBorrador({ ...borrador, title: e.target.value })}
                  placeholder={t("agreements.agreementTitlePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-desde">{t("agreements.startDate")}</Label>
                <Input
                  id="ac-desde"
                  type="date"
                  value={borrador.startDate}
                  onChange={(e) => setBorrador({ ...borrador, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-hasta">{t("agreements.endDate")}</Label>
                <Input
                  id="ac-hasta"
                  type="date"
                  value={borrador.endDate}
                  onChange={(e) => setBorrador({ ...borrador, endDate: e.target.value })}
                />
                {/* Sin esto, una casilla de fecha vacía parece un campo sin
                    rellenar en vez de lo que es: un acuerdo sin fin. */}
                <p className="text-xs text-muted-foreground">{t("agreements.endDateHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("agreements.payKindLabel")}</Label>
                <Select
                  value={borrador.payKind}
                  onValueChange={(v) => setBorrador({ ...borrador, payKind: v as Borrador["payKind"] })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_DE_PAGO.map((f) => (
                      <SelectItem key={f} value={f}>{t(`agreements.payKind.${f}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-importe">{t("agreements.payAmount")}</Label>
                <Input
                  id="ac-importe"
                  type="number"
                  min={0}
                  step="0.01"
                  value={borrador.payAmount}
                  onChange={(e) => setBorrador({ ...borrador, payAmount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("agreements.payFrequencyLabel")}</Label>
                <Select
                  value={borrador.payFrequency}
                  onValueChange={(v) => setBorrador({ ...borrador, payFrequency: v as Borrador["payFrequency"] })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FRECUENCIAS.map((f) => (
                      <SelectItem key={f} value={f}>{t(`agreements.payFrequency.${f}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-horas">{t("agreements.hoursPerWeek")} ({t("common.optional")})</Label>
                <Input
                  id="ac-horas"
                  type="number"
                  min={0}
                  step="0.5"
                  value={borrador.hoursPerWeek}
                  onChange={(e) => setBorrador({ ...borrador, hoursPerWeek: e.target.value })}
                />
              </div>
              {/* Un subcontratista factura: no cobra vacaciones, así que el
                  campo no existe para él en vez de existir puesto a cero. */}
              {borrador.kind === "empleo" && (
                <div className="space-y-1.5">
                  <Label htmlFor="ac-vac">{t("agreements.vacationPercent")}</Label>
                  <Input
                    id="ac-vac"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={borrador.vacationPercent}
                    onChange={(e) => setBorrador({ ...borrador, vacationPercent: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{t("agreements.vacationHint")}</p>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-cond">{t("agreements.terms")} ({t("common.optional")})</Label>
                <Textarea
                  id="ac-cond"
                  rows={4}
                  value={borrador.terms}
                  onChange={(e) => setBorrador({ ...borrador, terms: e.target.value })}
                  placeholder={t("agreements.termsPlaceholder")}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-notas">{t("agreements.notes")} ({t("common.optional")})</Label>
                <Textarea
                  id="ac-notas"
                  rows={2}
                  value={borrador.notes}
                  onChange={(e) => setBorrador({ ...borrador, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditando(null)} disabled={ocupado}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1" onClick={guardar} disabled={ocupado || !borrador.startDate}>
                {ocupado ? <Spinner className="size-4" /> : t("common.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner className="size-4" /> {t("common.loading")}
              </div>
            )}

            {!loading && acuerdos?.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">{t("agreements.none")}</p>
            )}

            {acuerdos?.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {a.title || t(`agreements.kind.${a.kind}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.number}</p>
                  </div>
                  <StatusBadge tone={TONO[a.status] ?? "info"}>{t(`agreements.status.${a.status}`)}</StatusBadge>
                </div>

                <p className="text-xs text-muted-foreground">
                  {a.startDate} → {a.endDate || t("agreements.openEnded")}
                </p>
                <p className="text-xs text-muted-foreground">{resumenDePago(a)}</p>
                {a.signedAt && a.signatureName && (
                  <p className="text-xs text-status-success-fg">
                    {t("agreements.signedBy", { name: a.signatureName, date: a.signedAt.slice(0, 10) })}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => descargar(a)}>
                    <Download size={13} /> {t("agreements.downloadPdf")}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => mandar(a)} disabled={ocupado}>
                    <Send size={13} /> {enviado === a.id ? t("agreements.sent") : t("agreements.send")}
                  </Button>
                  {/* Firmado no se toca: si cambian las condiciones se hace
                      otro acuerdo. Poder editarlo por detrás convertiría la
                      firma en un adorno. */}
                  {a.status !== "firmado" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => abrirEdicion(a)} aria-label={t("common.edit")}>
                        <Pencil size={13} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-status-error-fg"
                        onClick={() => borrar(a)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}

            <Button className="w-full gap-2" onClick={abrirNuevo}>
              <Plus size={14} /> {t("agreements.new")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** El botón que lo abre, para ponerlo en la fila de cada persona. */
export function BotonDeAcuerdos({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" aria-label={label} title={label} onClick={onClick}>
      <FileSignature size={14} />
    </Button>
  );
}
