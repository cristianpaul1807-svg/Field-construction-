import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eraser, FileSignature } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { apiFetch, readJson } from "@/lib/api";
import { useTranslation } from "react-i18next";

/**
 * The customer signing their estimate.
 *
 * The typed name is the signature. A drawn mark is offered because on a phone
 * that is what people expect signing to look like and it makes the moment feel
 * like one, but it identifies nobody on its own — the name they chose to type
 * with the consent sentence in front of them is what carries the weight.
 *
 * The amount is shown one more time immediately above the button, because the
 * one thing a signature has to pin down is which figure was agreed.
 */
export function SignEstimateDialog({
  open,
  onOpenChange,
  estimateId,
  total,
  defaultName,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: string;
  total: number;
  defaultName: string;
  onSigned: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // The canvas is laid out in CSS pixels but drawn in its own coordinate
    // space; without this the line lands away from the finger.
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = pointFrom(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointFrom(event);
    ctx.lineTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111111";
    ctx.stroke();
    setHasDrawn(true);
  };

  const stop = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const sign = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/client-portal/estimates/${estimateId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedName: name.trim(),
          signatureImage: hasDrawn ? canvasRef.current?.toDataURL("image/png") : null,
        }),
      });
      if (!res.ok) {
        const body = await readJson<{ error?: string; code?: string }>(res);
        throw new Error(
          body?.code === "signature_required" ? t("sign.nameRequired") : body?.error || t("common.genericError")
        );
      }
      onOpenChange(false);
      onSigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sign.title")}</DialogTitle>
          <DialogDescription>{t("sign.intro")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-xs text-muted-foreground">{t("sign.amountLabel")}</p>
            <p className="text-2xl font-semibold text-foreground">{formatCurrency(total)}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signed-name" className="text-xs">
              {t("sign.nameLabel")}
            </Label>
            <Input
              id="signed-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("sign.namePlaceholder")}
              autoComplete="name"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("sign.drawLabel")}</Label>
              {hasDrawn && (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={clear}>
                  <Eraser size={12} /> {t("sign.clear")}
                </Button>
              )}
            </div>
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              // touch-none stops the browser scrolling the sheet while a
              // finger is drawing on it, which otherwise makes signing on a
              // phone almost impossible.
              className="w-full h-28 rounded-lg border border-border bg-card touch-none"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={stop}
              onPointerLeave={stop}
            />
          </div>

          <p className="text-xs text-muted-foreground">{t("sign.consent")}</p>
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={sign} disabled={saving || name.trim().length < 2}>
            {saving ? <Spinner className="size-4" /> : <FileSignature size={16} />}
            {t("sign.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
