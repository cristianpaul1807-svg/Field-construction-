import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface AppUser {
  id: string;
  name: string;
  email: string;
  status: "activo" | "invitado";
  role: string | null;
  roleId?: string | null;
  phone?: string | null;
}

interface SettingsUsersData {
  users: AppUser[];
  roles: { id?: string; name: string; permissions: string[] }[];
}

type Draft = { id: string | null; name: string; email: string; phone: string; roleId: string };

const EMPTY: Draft = { id: null, name: "", email: "", phone: "", roleId: "" };

export default function SettingsUsers() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi<SettingsUsersData>("/api/settings/users");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const roleLabel = (role: string | null) =>
    role ? t(`settings.roles.${role}`, { defaultValue: role }) : "—";

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch(draft.id ? `/api/settings/users/${draft.id}` : "/api/settings/users", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          roleId: draft.roleId || null,
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

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("settings.usersTitle")}
        description={t("settings.usersDescriptionFull")}
        action={
          <Button
            className="gap-2 w-full sm:w-auto"
            onClick={() => {
              setSaveError(null);
              setDraft({ ...EMPTY });
            }}
          >
            <Plus size={16} strokeWidth={1.75} /> {t("settings.inviteUser")}
          </Button>
        }
      />

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

      {!loading && !error && data && (
        <>
          <Card className="p-6">
            <div className="space-y-3">
              {data.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge tone="neutral">{roleLabel(user.role)}</StatusBadge>
                    <StatusBadge tone={user.status === "activo" ? "success" : "warning"}>
                      {user.status === "activo" ? t("settings.userActive") : t("settings.userInvited")}
                    </StatusBadge>
                    <button
                      aria-label={t("common.edit")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      onClick={() => {
                        setSaveError(null);
                        setDraft({
                          id: user.id,
                          name: user.name,
                          email: user.email ?? "",
                          phone: user.phone ?? "",
                          roleId: user.roleId ?? "",
                        });
                      }}
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))}
              {data.users.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("settings.noUsers")}</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">{t("settings.permissionsByRole")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.roles.map((role) => (
                <div key={role.name} className="border border-border rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-2">{roleLabel(role.name)}</p>
                  <ul className="space-y-1">
                    {role.permissions.map((perm) => (
                      <li key={perm} className="text-xs text-muted-foreground">· {perm}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("settings.editUser") : t("settings.inviteUser")}</DialogTitle>
            {/* No invitation email is sent — the teammate signs up with this
                same address and the account links itself. Saying so up front
                stops anyone waiting on a message that will never arrive. */}
            <DialogDescription>{t("settings.inviteUserHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-name">{t("common.name")}</Label>
              <Input
                id="user-name"
                value={draft?.name ?? ""}
                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email">{t("common.email")}</Label>
              <Input
                id="user-email"
                type="email"
                value={draft?.email ?? ""}
                onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : d))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-phone">{t("common.phone")}</Label>
              <Input
                id="user-phone"
                value={draft?.phone ?? ""}
                onChange={(e) => setDraft((d) => (d ? { ...d, phone: e.target.value } : d))}
              />
            </div>
            {(data?.roles ?? []).some((r) => r.id) && (
              <div className="space-y-1.5">
                <Label>{t("settings.role")}</Label>
                <Select
                  value={draft?.roleId || undefined}
                  onValueChange={(v) => setDraft((d) => (d ? { ...d, roleId: v } : d))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("common.none")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.roles ?? [])
                      .filter((r) => r.id)
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id!}>{roleLabel(r.name)}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {saveError && <p className="text-sm text-status-error-fg">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
            <Button onClick={save} disabled={saving || !draft?.name.trim()}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
