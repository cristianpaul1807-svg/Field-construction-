import { FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";

export function SelectProjectPrompt() {
  const { t } = useTranslation();
  return (
    <Card className="p-12 flex flex-col items-center justify-center text-center gap-2">
      <FolderKanban size={28} className="text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{t("common.selectProject")}</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        {t("common.selectProjectHint")}
      </p>
    </Card>
  );
}
