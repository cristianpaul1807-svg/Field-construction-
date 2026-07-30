import { useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/iniciar-sesion`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/iniciar-sesion" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft size={13} /> Volver a iniciar sesión
        </Link>

        <div className="text-center space-y-2">
          <KeyRound className="mx-auto text-primary" size={28} />
          <h1 className="text-xl font-semibold text-foreground">Recuperar contraseña</h1>
          <p className="text-sm text-muted-foreground">Te mandamos un enlace para crear una contraseña nueva.</p>
        </div>

        <Card className="p-6 space-y-4">
          {sent ? (
            <p className="text-sm text-status-success-fg text-center">
              Si <strong>{email}</strong> tiene una cuenta, te llegará un correo con el enlace.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-status-error-fg">{error}</p>}
              <Button className="w-full" onClick={submit} disabled={!email || busy}>
                Enviar enlace
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
