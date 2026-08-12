import { useMemo, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, leadStatusTone } from "@/components/StatusBadge";
import { Plus, Search } from "lucide-react";
import { leadStatusLabel, type LeadStatus } from "@/lib/mockData";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface Client {
  id: string;
  name: string;
  phone: string;
  leadStatus: LeadStatus;
  source: string;
  lastActivity: string;
}

const statuses: LeadStatus[] = ["nuevo", "cotizado", "negociando", "ganado", "perdido"];

export default function Crm() {
  const { t } = useTranslation();
  const { data: clients, loading, error } = useApi<Client[]>("/api/clients");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");

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
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> New Lead
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`text-left rounded-xl border p-4 transition-colors ${filter === "all" ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary"}`}
        >
          <p className="text-xs text-muted-foreground">Todos</p>
          <p className="text-xl font-semibold text-foreground mt-1">{countFor("all")}</p>
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`text-left rounded-xl border p-4 transition-colors ${filter === status ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary"}`}
          >
            <p className="text-xs text-muted-foreground">{leadStatusLabel[status]}</p>
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
            <Spinner className="size-4" /> Cargando clientes...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
            No se pudo cargar desde Supabase: {error}
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
                        {leadStatusLabel[client.leadStatus]}
                      </StatusBadge>
                    </td>
                    <td className="py-3 text-muted-foreground">{client.source}</td>
                    <td className="py-3 text-muted-foreground">{client.lastActivity?.slice(0, 10)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No se encontraron clientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
