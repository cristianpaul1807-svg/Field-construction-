import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, UserRound, LogIn, HardHat } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 mx-auto bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-semibold text-lg">
              R
            </div>
            <h1 className="text-3xl font-bold text-foreground">FSM &amp; Construction Hub</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              El centro de operaciones para tu negocio de construcción — presupuestos, proyectos, equipo y clientes
              en un solo lugar.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 pt-1">
            <Link href="/iniciar-sesion">
              <Button className="gap-2" size="lg">
                <LogIn size={16} /> Ya tengo cuenta — Iniciar sesión
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/negocio/acceso">
              <Card className="p-6 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <Briefcase className="text-primary mb-3" size={28} />
                <h2 className="font-semibold text-foreground mb-1">Soy un negocio</h2>
                <p className="text-sm text-muted-foreground">
                  Gestiona tus proyectos, presupuestos, equipo y clientes.
                </p>
              </Card>
            </Link>

            <Link href="/cliente/acceso">
              <Card className="p-6 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <UserRound className="text-primary mb-3" size={28} />
                <h2 className="font-semibold text-foreground mb-1">Soy cliente</h2>
                <p className="text-sm text-muted-foreground">
                  Revisa el avance de tu proyecto, tu presupuesto y tus fotos.
                </p>
              </Card>
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-border py-6 text-center bg-secondary/40">
        <Link href="/campo">
          <Button variant="outline" size="lg" className="gap-2">
            <HardHat size={18} /> Acceso de trabajador de campo
          </Button>
        </Link>
      </div>
    </div>
  );
}
