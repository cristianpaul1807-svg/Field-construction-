/**
 * La política de privacidad y las condiciones de uso.
 *
 * Una sola pantalla para las dos porque son el mismo objeto: una cabecera y
 * una lista de secciones que viven en los archivos de idioma bajo `legal.`.
 * Escribir dos componentes casi iguales garantiza que dentro de un año uno
 * tenga el enlace de volver arreglado y el otro no.
 *
 * Es pública a propósito: Intuit, Stripe y la Ley 25 exigen que estas dos
 * direcciones se abran sin sesión, desde fuera, en una ventana de incógnito.
 * Por eso se declara en `Router()` y no dentro del panel.
 */
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";

interface SeccionLegal {
  id: string;
  title: string;
  body: string[];
}

/**
 * Las negritas y el `código` de los textos legales.
 *
 * Los párrafos llevan `**así**` lo que hay que leer sí o sí —quién responde,
 * dónde están los datos, qué no es este programa— porque un muro de texto
 * gris se lee entero o no se lee, y esto se va a leer en diagonal. No es un
 * renderizador de Markdown y no debe serlo: sólo estas dos marcas, sin HTML
 * por medio.
 */
function conFormato(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((trozo, i) => {
    if (trozo.startsWith("**") && trozo.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {trozo.slice(2, -2)}
        </strong>
      );
    }
    if (trozo.startsWith("`") && trozo.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {trozo.slice(1, -1)}
        </code>
      );
    }
    return trozo;
  });
}

export default function PaginaLegal({ cual }: { cual: "privacy" | "terms" }) {
  const { t } = useTranslation();
  const secciones = t(`legal.${cual}`, { returnObjects: true }) as unknown as SeccionLegal[];

  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between py-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            {t("legal.back")}
          </Link>
          <LanguageSwitcher />
        </div>

        <header className="space-y-2 border-b border-border pb-6 pt-4">
          <Logo size={40} className="shadow-sm" />
          <h1 className="pt-2 text-2xl font-bold tracking-tight text-foreground">
            {t(cual === "privacy" ? "legal.privacyTitle" : "legal.termsTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(cual === "privacy" ? "legal.privacyLead" : "legal.termsLead")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("legal.updated", { date: t("legal.updatedOn") })}
          </p>
        </header>

        <div className="space-y-8 pt-8">
          {(Array.isArray(secciones) ? secciones : []).map((seccion, indice) => (
            <section key={seccion.id} className="space-y-2.5">
              <h2 className="text-base font-semibold text-foreground">
                {indice + 1}. {seccion.title}
              </h2>
              {seccion.body.map((parrafo, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {conFormato(parrafo)}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-12 space-y-1 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>{t("legal.holder")}</p>
          <p>{t("legal.address")}</p>
          <p>
            <a href={`mailto:${t("legal.email")}`} className="hover:text-foreground">
              {t("legal.email")}
            </a>
          </p>
          <p className="pt-3">
            <Link
              href={cual === "privacy" ? "/terms" : "/privacy"}
              className="font-medium hover:text-foreground"
            >
              {t(cual === "privacy" ? "legal.termsTitle" : "legal.privacyTitle")} →
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
