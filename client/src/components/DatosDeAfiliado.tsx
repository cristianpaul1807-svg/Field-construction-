/**
 * Lo que se pide para entrar en el programa de afiliados, además de la
 * cuenta: cómo se llama, dónde lo va a compartir, dónde vive, y **la firma
 * del contrato**.
 *
 * El enlace se da después de firmar, no antes. Por eso el contrato está aquí
 * mismo, resumido en lo que importa (cuánto, cuándo, qué no), con el texto
 * entero a un clic, y se firma escribiendo el nombre —y con el dedo si quiere—,
 * igual que un cliente firma una soumission. Una casilla sola es un clic; un
 * nombre escrito delante del contrato es un acto.
 *
 * Aparte porque se pide en dos sitios: en el alta nueva, junto al correo y la
 * contraseña, y a quien ya tiene cuenta (un contratista cliente) y quiere
 * además recomendar.
 */
import { useRef, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Eraser, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectorDePais } from "@/components/SelectorDePais";

export interface Datos {
  nombre: string;
  dondeComparte: string;
  pais: string;
  firmaNombre: string;
  firmaImagen: string | null;
  acepta: boolean;
}

export const datosCompletos = (d: Datos) =>
  d.nombre.trim().length >= 2 && d.dondeComparte.trim().length >= 3 && d.firmaNombre.trim().length >= 3 && d.acepta;

/** El trazo de la firma. Opcional: la firma es el nombre escrito. */
function Trazo({ onCambio }: { onCambio: (imagen: string | null) => void }) {
  const { t } = useTranslation();
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const dibujando = useRef(false);
  const [hay, setHay] = useState(false);

  // El lienzo se pinta en sus propios píxeles y se enseña en los de la
  // pantalla: sin esta cuenta la línea sale lejos del dedo.
  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = lienzo.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t("afiliados.firmaTrazo")}</Label>
        {hay && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => {
              const c = lienzo.current;
              c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
              setHay(false);
              onCambio(null);
            }}
          >
            <Eraser size={12} /> {t("afiliados.borrarTrazo")}
          </Button>
        )}
      </div>
      <canvas
        ref={lienzo}
        width={600}
        height={160}
        // Sin touch-none el móvil desplaza la página mientras se firma.
        className="h-24 w-full touch-none rounded-lg border border-border bg-card"
        onPointerDown={(e) => {
          const c = lienzo.current;
          if (!c) return;
          c.setPointerCapture(e.pointerId);
          dibujando.current = true;
          const ctx = c.getContext("2d")!;
          const { x, y } = punto(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!dibujando.current) return;
          const ctx = lienzo.current!.getContext("2d")!;
          const { x, y } = punto(e);
          ctx.lineTo(x, y);
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#111111";
          ctx.stroke();
          setHay(true);
        }}
        onPointerUp={() => {
          if (!dibujando.current) return;
          dibujando.current = false;
          onCambio(lienzo.current?.toDataURL("image/png") ?? null);
        }}
        onPointerLeave={() => {
          if (!dibujando.current) return;
          dibujando.current = false;
          onCambio(lienzo.current?.toDataURL("image/png") ?? null);
        }}
      />
    </div>
  );
}

export function DatosDeAfiliado({ datos, onCambio }: { datos: Datos; onCambio: (d: Datos) => void }) {
  const { t } = useTranslation();
  const poner = (cambio: Partial<Datos>) => onCambio({ ...datos, ...cambio });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="afiliado-nombre">{t("afiliados.nombre")}</Label>
        <Input id="afiliado-nombre" autoComplete="name" value={datos.nombre} onChange={(e) => poner({ nombre: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="afiliado-donde">{t("afiliados.dondeComparte")}</Label>
        <Textarea
          id="afiliado-donde"
          rows={2}
          value={datos.dondeComparte}
          onChange={(e) => poner({ dondeComparte: e.target.value })}
          placeholder={t("afiliados.dondeCompartePista")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="afiliado-pais">{t("afiliados.pais")}</Label>
        <SelectorDePais id="afiliado-pais" valor={datos.pais} onCambio={(pais) => poner({ pais })} />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileSignature size={16} /> {t("afiliados.contratoTitulo")}
        </h3>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          {(["r1", "r2", "r3", "r4", "r5"] as const).map((r) => (
            <li key={r}>{t(`afiliados.contrato.${r}`)}</li>
          ))}
        </ul>
        <Link href="/afiliados/condiciones" className="inline-block text-xs font-medium text-primary underline underline-offset-2">
          {t("afiliados.leerContrato")}
        </Link>

        <div className="space-y-1.5">
          <Label htmlFor="afiliado-firma">{t("afiliados.firmaNombre")}</Label>
          <Input
            id="afiliado-firma"
            autoComplete="name"
            value={datos.firmaNombre}
            onChange={(e) => poner({ firmaNombre: e.target.value })}
            className="font-medium italic"
          />
        </div>
        <Trazo onCambio={(firmaImagen) => poner({ firmaImagen })} />

        {/* Una casilla de verdad, sin marcar de antemano: un sí que viene
            puesto no es un sí. */}
        <div className="flex items-start gap-2.5">
          <input
            id="afiliado-acepta"
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={datos.acepta}
            onChange={(e) => poner({ acepta: e.target.checked })}
          />
          <label htmlFor="afiliado-acepta" className="text-sm leading-snug text-foreground">
            {t("afiliados.acepto")}
          </label>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("afiliados.firmaAviso")}</p>
      </div>
    </div>
  );
}
