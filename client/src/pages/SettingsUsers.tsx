import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { appUsers, rolePermissions } from "@/lib/mockData";

const roleLabel = { admin: "Admin", oficina: "Oficina", tecnico: "Técnico", subcontratista: "Subcontratista" };

export default function SettingsUsers() {
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Users & Roles"
        description="Permisos por rol: admin, oficina, técnico, subcontratista"
        action={
          <Button className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> Invite User
          </Button>
        }
      />

      <Card className="p-6">
        <div className="space-y-3">
          {appUsers.map((user) => (
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
                <StatusBadge tone="neutral">{roleLabel[user.role]}</StatusBadge>
                <StatusBadge tone={user.status === "activo" ? "success" : "warning"}>
                  {user.status === "activo" ? "Activo" : "Invitado"}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Permisos por rol</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(rolePermissions) as (keyof typeof rolePermissions)[]).map((role) => (
            <div key={role} className="border border-border rounded-lg p-4">
              <p className="text-sm font-medium text-foreground mb-2">{roleLabel[role]}</p>
              <ul className="space-y-1">
                {rolePermissions[role].map((perm) => (
                  <li key={perm} className="text-xs text-muted-foreground">· {perm}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
