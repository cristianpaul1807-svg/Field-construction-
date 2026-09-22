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
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useApi, apiFetch, serverMessage, readJson } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";
import { DobleFactor } from "@/components/DobleFactor";
import { Checkbox } from "@/components/ui/checkbox";
import { AREAS, type Area } from "@shared/permisos";

interface AppUser {
  id: string;
  name: string;
  email: string;
  status: "activo" | "invitado";
  role: string | null;
  roleId?: string | null;
  phone?: string | null;
  /** Las áreas que ve, o `null` si las ve todas. */
  areas: Area[] | null;
  /** Si tiene una conexión activa por MCP. */
  mcpActive?: boolean;
}

interface SettingsUsersData {
  users: AppUser[];
  roles: { id?: string; name: string; permissions: string[] }[];
}

type Draft = {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  /** `null` es administrador general: lo ve todo. */
  areas: Area[] | null;
};

const EMPTY: Draft = { id: null, name: "", email: "", phone: "", areas: null };

export default function SettingsUsers() {
  const { t } = useTranslation();
  const { data, loading, error, reload, detalle } = useApi<SettingsUsersData>("/api/settings/users");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [cambiandoClave, setCambiandoClave] = useState<string | null>(null);

  const nuevaClave = async (user: { id: string; name: string }) => {
    if (!window.confirm(t("settings.nuevaClaveConfirmar", { nombre: user.name }))) return;
    setCambiandoClave(user.id);
    setSaveError(null);
    try {
      const respuesta = await apiFetch(`/api/settings/users/${user.id}/password`, { method: "POST" });
      const cuerpo = await readJson<{ email?: string; password?: string; error?: string; code?: string }>(respuesta);
      if (!respuesta.ok) throw new Error(serverMessage(cuerpo, t, t("errores.generico")));
      // El mismo cartel que al crear el acceso: sale una vez y no vuelve.
      setCredenciales({ email: cuerpo.email ?? "", password: cuerpo.password ?? "" });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("errores.generico"));
    } finally {
      setCambiandoClave(null);
    }
  };

  const quitar = async (user: { id: string; name: string }) => {
    if (!window.confirm(t("settings.quitarUsuarioConfirmar", { nombre: user.name }))) return;
    setQuitando(user.id);
    setSaveError(null);
    try {
      const respuesta = await apiFetch(`/api/settings/users/${user.id}`, { method: "DELETE" });
      if (!respuesta.ok) throw new Error(serverMessage(await readJson(respuesta), t, t("errores.generico")));
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("errores.generico"));
    } finally {
      setQuitando(null);
    }
  };
  // La contraseña recién creada. Se enseña una vez y no vuelve: no se guarda
  // en ninguna tabla nuestra ni se manda por correo.
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);
  // Estado para la confirmación de administrador
  const [confirmAdmin, setConfirmAdmin] = useState(false);

  /** Qué ve esta persona, dicho como lo entendería quien la invitó. */
  const queVe = (areas: Area[] | null) =>
    areas === null
      ? t("settings.seesAll")
      : areas.map((a) => t(`settings.area.${a}`)).join(" · ");

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
          areas: draft.areas,
        }),
      });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(serverMessage(cuerpo, t, t("common.genericError")));
      if (cuerpo?.password) setCredenciales({ email: cuerpo.email, password: cuerpo.password });
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
        <AvisoDeFallo
          mensaje={t("common.loadError", { message: error })}
          detalle={detalle}
          onReintentar={reload}
        />
      )}

      {!loading && !error && data && (
        <>
          <DobleFactor />

          <Card className="p-6">
            <div className="space-y-3">
              {data.users.map((user) => (
                /* Apilada en el móvil y en una línea a partir de `sm`.
                   Estaba siempre en una línea con el grupo de la derecha en
                   `flex-shrink-0`: tres distintivos y tres botones que a 390 px
                   ya son más anchos que la pantalla, así que aplastaban el
                   nombre y el correo hasta hacerlos desaparecer y el botón de
                   borrar se salía por el borde. */
                <div key={user.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                    {/* Que envuelva en vez de empujar: en un móvil los
                        distintivos se van a la línea de abajo y los botones se
                        quedan donde el pulgar los busca. */}
                    <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end pl-11 sm:pl-0">
                      {user.mcpActive !== undefined && (
                        <StatusBadge tone={user.mcpActive ? "success" : "error"}>
                          MCP
                        </StatusBadge>
                      )}
                      <StatusBadge tone="neutral">{queVe(user.areas)}</StatusBadge>
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
                          areas: user.areas,
                        });
                      }}
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                    {/* Quitar no existía: se podía dar de alta a alguien con
                        su rol y no había forma de sacarlo nunca. El del
                        negocio y uno mismo los rechaza el servidor, y el
                        aviso lo explica en vez de dar un error seco. */}
                    <button
                      aria-label={t("settings.nuevaClave")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                      disabled={cambiandoClave === user.id}
                      onClick={() => void nuevaClave(user)}
                    >
                      {cambiandoClave === user.id ? <Spinner className="size-3.5" /> : <KeyRound size={14} strokeWidth={1.75} />}
                    </button>
                    <button
                      aria-label={t("settings.quitarUsuario")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors disabled:opacity-50"
                      disabled={quitando === user.id}
                      onClick={() => void quitar(user)}
                    >
                      {quitando === user.id ? <Spinner className="size-3.5" /> : <Trash2 size={14} strokeWidth={1.75} />}
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
            <h2 className="text-base font-semibold text-foreground mb-1">{t("settings.areasTitle")}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t("settings.areasHint")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {AREAS.map((area) => (
                <div key={area} className="border border-border rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-1">{t(`settings.area.${area}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`settings.areaHint.${area}`)}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* La contraseña, una sola vez.
          No se guarda en ninguna tabla nuestra y no se manda por correo: un
          correo con una contraseña dentro se queda en la bandeja para siempre.
          Se pasa por donde ya hablen, como el código de un trabajador. */}
      <Dialog open={credenciales !== null} onOpenChange={(open) => !open && setCredenciales(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.credentialsTitle")}</DialogTitle>
            <DialogDescription>{t("settings.credentialsHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">{t("common.email")}</p>
                <p className="text-sm text-foreground select-all break-all">{credenciales?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("auth.password")}</p>
                <p className="text-base font-mono text-foreground select-all break-all">{credenciales?.password}</p>
              </div>
            </div>
            <p className="text-xs text-status-warning-fg">{t("settings.credentialsOnce")}</p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                navigator.clipboard
                  ?.writeText(`${credenciales?.email}\n${credenciales?.password}`)
                  .catch(() => null);
              }}
              variant="outline"
            >
              {t("common.copy")}
            </Button>
            <Button onClick={() => setCredenciales(null)}>{t("common.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="space-y-2">
              <Label>{t("settings.whatTheySee")}</Label>
              {/* Dos opciones y no una lista de roles: quien invita piensa en
                  «lo ve todo» o «sólo esto», no en el nombre de un papel. El
                  rol de debajo lo arma el servidor. */}
              <div className="grid gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-border p-3">
                  <input
                    type="radio"
                    className="mt-0.5"
                    checked={draft?.areas === null}
                    onChange={() => {
                      if (draft?.areas !== null) {
                        setConfirmAdmin(true);
                      }
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{t("settings.seesAll")}</span>
                    <span className="block text-xs text-muted-foreground">{t("settings.seesAllHint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-border p-3">
                  <input
                    type="radio"
                    className="mt-0.5"
                    checked={draft?.areas !== null}
                    onChange={() => setDraft((d) => (d ? { ...d, areas: ["campo"] } : d))}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{t("settings.seesSome")}</span>
                    <span className="block text-xs text-muted-foreground">{t("settings.seesSomeHint")}</span>
                  </span>
                </label>
              </div>

              {draft?.areas !== null && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {AREAS.map((area) => (
                    <label key={area} className="flex items-start gap-2.5 cursor-pointer">
                      <Checkbox
                        checked={(draft?.areas ?? []).includes(area)}
                        onCheckedChange={(v: boolean | "indeterminate") =>
                          setDraft((d) => {
                            if (!d) return d;
                            const puestas = new Set(d.areas ?? []);
                            if (v === true) puestas.add(area);
                            else puestas.delete(area);
                            return { ...d, areas: AREAS.filter((a) => puestas.has(a)) };
                          })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-foreground">{t(`settings.area.${area}`)}</span>
                        <span className="block text-xs text-muted-foreground">{t(`settings.areaHint.${area}`)}</span>
                      </span>
                    </label>
                  ))}
                  {(draft?.areas ?? []).length === 0 && (
                    <p className="text-xs text-status-warning-fg">{t("settings.pickAtLeastOne")}</p>
                  )}
                </div>
              )}
            </div>

            {saveError && <p className="text-sm text-status-error-fg">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={save}
              disabled={saving || !draft?.name.trim() || (draft?.areas !== null && draft?.areas.length === 0)}
            >
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmAdmin} onOpenChange={setConfirmAdmin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Acceso Total</DialogTitle>
            <DialogDescription>
              Este rol tendrá acceso a <b>TODO</b> y es el único rol que comparte la misma amplitud de gestión que el jefe. Además, los roles personalizados o reducidos no tendrán acceso a las herramientas del Asistente Inteligente (MCP), siendo exclusivo de los roles predefinidos del sistema con permisos suficientes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAdmin(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                setDraft((d) => (d ? { ...d, areas: null } : d));
                setConfirmAdmin(false);
              }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
