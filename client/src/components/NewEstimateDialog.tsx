import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, apiFetch, readJson } from "@/lib/api";

interface Client {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface NewEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function NewEstimateDialog({ open, onOpenChange, onCreated }: NewEstimateDialogProps) {
  const { t } = useTranslation();
  const { data: clients } = useApi<Client[]>(open ? "/api/clients" : null);
  const { data: projects } = useApi<ProjectOption[]>(open ? "/api/projects" : null);
  const { data: categories } = useApi<Category[]>(open ? "/api/budget-categories" : null);

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setClientId("");
    setProjectId("");
    setCategoryId("");
  };

  const create = async () => {
    if (!clientId) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          projectId: projectId || undefined,
          categoryId: categoryId || undefined,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body?.error || t("budgets.createEstimateError"));
      reset();
      onOpenChange(false);
      onCreated(body.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("budgets.newEstimate")}</DialogTitle>
          <DialogDescription>{t("budgets.newEstimateHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("common.client")}</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("common.project")} ({t("common.optional")})</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("budgets.noProject")} />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("common.category")} ({t("common.optional")})</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("budgets.noCategory")} />
              </SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={create} disabled={!clientId || busy}>{t("budgets.createEstimate")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
