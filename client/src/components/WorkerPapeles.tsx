import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FileText, Download, ChevronDown } from "lucide-react";
import { readJson } from "@/lib/api";
import { workerApiFetch } from "@/lib/workerSession";

/**
 * Sus papeles, en su móvil.
 *
 * El T4 se manda cada febrero por correo, se pierde, y en abril la persona se
 * lo vuelve a pedir a la oficina — que lo vuelve a buscar. Teniéndolo aquí,
 * junto a sus horas, eso deja de pasar.
 *
 * **Plegado por defecto y sólo si hay algo.** La aplicación de campo tiene tres
 * pestañas que son toda su navegación; un bloque abierto con papeles de hace
 * dos años le cobraría sitio todos los días a algo que se mira dos veces al
 * año. Y si no le han subido nada, no aparece: un cajón vacío no informa.
 */

interface Papel {
  id: string;
  kind: string;
  name: string;
  year: number | null;
  uploadedAt: string;
}

export function WorkerPapeles() {
  const { t } = useTranslation();
  const [papeles, setPapeles] = useState<Papel[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    workerApiFetch("/api/worker/documents")
      .then((res) => (res.ok ? readJson<Papel[]>(res) : []))
      .then((lista) => {
        if (vivo && Array.isArray(lista)) setPapeles(lista);
      })
      // Que no se puedan leer sus papeles no puede tumbarle el fichaje, que es
      // a lo que viene.
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, []);

  const abrir = async (papel: Papel) => {
    setOcupado(papel.id);
    try {
      const res = await workerApiFetch(`/api/worker/documents/${papel.id}/download-url`);
      const body = await readJson<{ url?: string }>(res);
      if (res.ok && body.url) window.open(body.url, "_blank", "noopener");
    } finally {
      setOcupado(null);
    }
  };

  if (papeles.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setAbierto((x) => !x)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText size={15} strokeWidth={1.75} className="text-muted-foreground" />
          {t("workerDocs.mine", { count: papeles.length })}
        </span>
        <ChevronDown
          size={16}
          className={abierto ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      {abierto && (
        <div className="divide-y divide-border border-t border-border">
          {papeles.map((papel) => (
            <div key={papel.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {t(`workerDocs.kinds.${papel.kind}`, { defaultValue: papel.kind })}
                  {papel.year && <span className="text-muted-foreground"> · {papel.year}</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{papel.name}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 min-h-11 flex-shrink-0"
                onClick={() => abrir(papel)}
                disabled={ocupado !== null}
              >
                {ocupado === papel.id ? <Spinner className="size-3.5" /> : <Download size={14} />}
                {t("workerDocs.download")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
