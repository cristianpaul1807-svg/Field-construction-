import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, UserRound, LogIn, HardHat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Landing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end p-3">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 mx-auto border border-border rounded-xl flex items-center justify-center text-foreground">
              <HardHat size={22} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-bold text-foreground">{t("landing.hubName")}</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t("landing.intro")}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 pt-1">
            <Link href="/iniciar-sesion">
              <Button className="gap-2" size="lg">
                <LogIn size={16} /> {t("landing.haveAccount")}
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/negocio/acceso">
              <Card className="p-6 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <Briefcase className="text-foreground mb-3" size={28} strokeWidth={1.5} />
                <h2 className="font-semibold text-foreground mb-1">{t("landing.businessAccess")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("landing.businessCardDesc")}
                </p>
              </Card>
            </Link>

            <Link href="/cliente/acceso">
              <Card className="p-6 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <UserRound className="text-foreground mb-3" size={28} strokeWidth={1.5} />
                <h2 className="font-semibold text-foreground mb-1">{t("landing.clientAccess")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("landing.clientCardDesc")}
                </p>
              </Card>
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-border py-6 text-center bg-secondary/40">
        <Link href="/campo">
          <Button variant="outline" size="lg" className="gap-2">
            <HardHat size={18} /> {t("landing.fieldWorkerAccess")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
