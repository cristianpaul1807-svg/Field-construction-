import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";

const roleLabel: Record<string, string> = {
  admin: "Admin",
  oficina: "Oficina",
  tecnico: "Técnico",
  subcontratista: "Subcontratista",
};

interface AppUser {
  id: string;
  name: string;
  email: string;
  status: "activo" | "invitado";
  role: string | null;
}

interface SettingsUsersData {
  users: AppUser[];
  roles: { name: string; permissions: string[] }[];
}

export default function SettingsUsers() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<SettingsUsersData>("/api/settings/users");

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("settings.usersTitle")}
        description={t("settings.usersDescriptionFull")}
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> Invite User
          </Button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando usuarios...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-border bg-status-error-bg/40 p-4 text-sm text-status-error-fg">
          No se pudo cargar desde Supabase: {error}
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
                    <StatusBadge tone="neutral">{user.role ? roleLabel[user.role] : "—"}</StatusBadge>
                    <StatusBadge tone={user.status === "activo" ? "success" : "warning"}>
                      {user.status === "activo" ? "Activo" : "Invitado"}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">{t("settings.permissionsByRole")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.roles.map((role) => (
                <div key={role.name} className="border border-border rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-2">{roleLabel[role.name] ?? role.name}</p>
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
    </div>
  );
}
