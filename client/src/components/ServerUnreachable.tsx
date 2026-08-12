import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

// Shown when we know the user is signed in but the server couldn't tell us
// what kind of account they have. Previously this state silently redirected
// to the signup screen, which read as "your account doesn't exist" to
// somebody whose account was fine — so it says what actually happened and
// offers a retry instead.
export function ServerUnreachable({ message }: { message: string }) {
  const { t } = useTranslation();
  const { refreshPersona, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await refreshPersona();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <AlertTriangle className="mx-auto text-status-warning-fg" size={28} strokeWidth={1.5} />
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">{t("auth.serverUnreachable")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.serverUnreachableHint")}</p>
        </div>
        <p className="text-xs text-muted-foreground font-mono bg-secondary rounded-md px-3 py-2 break-words">
          {message}
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={retry} disabled={retrying} className="gap-2">
            {retrying ? <Spinner className="size-4" /> : <RefreshCw size={15} strokeWidth={1.75} />}
            {t("auth.retry")}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground">
            <LogOut size={14} strokeWidth={1.75} /> {t("common.logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
