import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  error: "bg-status-error-bg text-status-error-fg",
  info: "bg-status-info-bg text-status-info-fg",
  neutral: "bg-secondary text-secondary-foreground",
};

interface StatusBadgeProps {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export const leadStatusTone: Record<string, StatusTone> = {
  nuevo: "info",
  cotizado: "warning",
  negociando: "warning",
  ganado: "success",
  perdido: "error",
};

export const projectStatusTone: Record<string, StatusTone> = {
  planificacion: "info",
  en_progreso: "warning",
  confirmado: "info",
  completado: "success",
  pausado: "neutral",
};

export const invoiceStatusTone: Record<string, StatusTone> = {
  pendiente: "warning",
  pagado: "success",
  vencido: "error",
};

export const workOrderStatusTone: Record<string, StatusTone> = {
  pendiente: "neutral",
  en_progreso: "warning",
  completada: "success",
};

export const priorityTone: Record<string, StatusTone> = {
  baja: "neutral",
  media: "warning",
  alta: "error",
};
