import { readJson } from "@/lib/api";
import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { setClientSession, type ClientSession } from "@/lib/clientSession";

// A client never self-registers and never needs an inbox: the business hands
// them an access code (Client Portal → "Generar código"), they type it here,
// and they're in. Deliberately the same shape as the worker's /campo entry —
// no email delivery, no password reset link, nothing external to wait on.
export default function AuthClient() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { session, signOut } = useAuth();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body?.error || t("worker.invalidCode"));
      const clientSession: ClientSession = {
        token: token.trim(),
        id: body.id,
        name: body.name,
        businessId: body.businessId,
      };
      setClientSession(clientSession);
      setLocation("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("worker.invalidCode"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end p-3">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <button
            onClick={async () => {
              if (session) await signOut();
              setLocation("/");
            }}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={13} /> {t("common.back")}
          </button>

          <div className="text-center space-y-2">
            <UserRound className="mx-auto text-foreground" size={28} strokeWidth={1.5} />
            <h1 className="text-xl font-semibold text-foreground">{t("auth.signInClient")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.clientAccessDescription")}</p>
          </div>

          <Card className="p-6">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="client-token">{t("worker.accessCode")}</Label>
                <Input
                  id="client-token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoFocus
                  className="font-mono"
                />
              </div>

              {error && <p className="text-sm text-status-error-fg">{error}</p>}

              <Button type="submit" className="w-full" disabled={!token.trim() || busy}>
                {t("worker.enter")}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
