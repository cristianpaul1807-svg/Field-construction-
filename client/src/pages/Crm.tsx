import { useMemo, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, leadStatusTone } from "@/components/StatusBadge";
import { Plus, Search, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type LeadStatus } from "@/lib/mockData";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  leadStatus: LeadStatus;
  source: string;
  lastActivity: string;
}

interface ClientDraft {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  leadStatus: LeadStatus;
}

const statuses: LeadStatus[] = ["nuevo", "cotizado", "negociando", "ganado", "perdido"];

function NewLeadDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setName(""); setPhone(""); setEmail(""); setAddress(""); setError(null); };

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone, email, address }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || t("common.genericError"));
      setOpen(false); reset(); onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto"><Plus size={16} /> {t("crm.newLead")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("crm.newLeadTitle")}</DialogTitle>
          <DialogDescription>{t("crm.newLeadDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("common.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("crm.newLeadName")} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.phone")} ({t("common.optional")})</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.email")} ({t("common.optional")})</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.address")} ({t("common.optional")})</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
          <Button className="w-full" onClick={create} disabled={!name.trim() || saving}>
            {saving ? t("common.creating") : t("common.create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Crm() {
  const { t } = useTranslation();
  const { data: clients, loading, error, reload } = useApi<Client[]>("/api/clients");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [draft, setDraft] = useState<ClientDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveClient = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch(`/api/clients/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          phone: draft.phone,
          email: draft.email,
          address: draft.address,
          leadStatus: draft.leadStatus,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || t("common.genericError"));
      setDraft(null);
      reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => {
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = filter === "all" || c.leadStatus === filter;
      return matchesQuery && matchesFilter;
    });
  }, [clients, query, filter]);

  const countFor = (status: LeadStatus | "all") =>
    !clients ? 0 : status === "all" ? clients.length : clients.filter((c) => c.leadStatus === status).length;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("crm.title")}
        description={t("crm.descriptionFull")}
        action={<NewLeadDialog onCreated={reload} />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`text-left rounded-xl border p-4 transition-colors ${filter === "all" ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary"}`}
        >
          <p className="text-xs text-muted-foreground">{t("common.all")}</p>
          <p className="text-xl font-semibold text-foreground mt-1">{countFor("all")}</p>
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`text-left rounded-xl border p-4 transition-colors ${filter === status ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary"}`}
          >
            <p className="text-xs text-muted-foreground">{t(`crm.status.${status}`)}</p>
            <p className="text-xl font-semibold text-foreground mt-1">{countFor(status)}</p>
          </button>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search size={16} className="text-muted-foreground" />
          <Input
            placeholder={t("crm.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.client")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.phone")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("common.status")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("crm.source")}</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">{t("crm.lastActivity")}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                    <td className="py-3">
                      <Link href={`/crm/${client.id}`} className="text-foreground font-medium hover:text-primary">
                        {client.name}
                      </Link>
                    </td>
                    <td className="py-3 text-muted-foreground">{client.phone}</td>
                    <td className="py-3">
                      <StatusBadge tone={leadStatusTone[client.leadStatus]}>
                        {t(`crm.status.${client.leadStatus}`)}
                      </StatusBadge>
                    </td>
                    <td className="py-3 text-muted-foreground">{client.source}</td>
                    <td className="py-3 text-muted-foreground">{client.lastActivity?.slice(0, 10)}</td>
                    <td className="py-3 text-right">
                      <button
                        aria-label={t("common.edit")}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                        onClick={() => {
                          setSaveError(null);
                          setDraft({
                            id: client.id,
                            name: client.name,
                            phone: client.phone ?? "",
                            email: client.email ?? "",
                            address: client.address ?? "",
                            leadStatus: client.leadStatus,
                          });
                        }}
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {t("crm.noClients")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("crm.editClient")}</DialogTitle>
            <DialogDescription>{t("crm.editClientHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-name">{t("common.name")}</Label>
              <Input
                id="client-name"
                value={draft?.name ?? ""}
                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.status")}</Label>
              <Select
                value={draft?.leadStatus}
                onValueChange={(v) => setDraft((d) => (d ? { ...d, leadStatus: v as LeadStatus } : d))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>{t(`crm.status.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">{t("common.phone")}</Label>
                <Input
                  id="client-phone"
                  value={draft?.phone ?? ""}
                  onChange={(e) => setDraft((d) => (d ? { ...d, phone: e.target.value } : d))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-email">{t("common.email")}</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={draft?.email ?? ""}
                  onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-address">{t("common.address")}</Label>
              <Input
                id="client-address"
                value={draft?.address ?? ""}
                onChange={(e) => setDraft((d) => (d ? { ...d, address: e.target.value } : d))}
              />
            </div>
            {saveError && <p className="text-sm text-status-error-fg">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveClient} disabled={saving || !draft?.name.trim()}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
