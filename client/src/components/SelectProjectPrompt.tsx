import { FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/card";

export function SelectProjectPrompt() {
  return (
    <Card className="p-12 flex flex-col items-center justify-center text-center gap-2">
      <FolderKanban size={28} className="text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Selecciona un proyecto</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Usa el selector "Proyectos" arriba a la derecha para elegir de qué proyecto quieres ver esta información.
      </p>
    </Card>
  );
}
