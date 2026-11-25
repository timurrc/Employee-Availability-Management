import { RotateCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import Button from "@/components/ui/Button/Button";
import { cn } from "@/utils/cn";

interface ErrorStateProps {
  /** «Не удалось загрузить {what}» */
  what: string;
  /** Причина, если известна */
  reason?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Внутри карточки — в строку; страница — по центру */
  compact?: boolean;
  /** Дополнительное действие рядом с «Повторить» */
  extra?: ReactNode;
  className?: string;
}

const ErrorState = ({
  what,
  reason,
  onRetry,
  isRetrying,
  compact = false,
  extra,
  className,
}: ErrorStateProps) => {
  const actions = (onRetry || extra) && (
    <div className="flex gap-2">
      {onRetry && (
        <Button
          variant="secondary"
          size={compact ? "sm" : "md"}
          onClick={onRetry}
          isLoading={isRetrying}
        >
          <RotateCw aria-hidden />
          Повторить
        </Button>
      )}
      {extra}
    </div>
  );

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3 py-2",
          className,
        )}
      >
        <TriangleAlert className="size-4 shrink-0 text-[var(--color-danger)]" aria-hidden />
        <p className="flex-1 text-[var(--color-text)]">
          Не удалось загрузить {what}
          {reason && <span className="text-[var(--color-text-muted)]"> — {reason}</span>}
        </p>
        {actions}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 py-16 text-center", className)}
    >
      <TriangleAlert className="size-8 text-[var(--color-danger)]" strokeWidth={1.75} aria-hidden />
      <p className="text-md font-semibold">Не удалось загрузить {what}</p>
      {reason && <p className="max-w-md text-[var(--color-text-muted)]">{reason}</p>}
      {actions}
    </div>
  );
};

export default ErrorState;
