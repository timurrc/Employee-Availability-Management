import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TONE_CLASSES } from "@/constants/tones";
import { cn } from "@/utils/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const ICONS: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

interface AlertProps {
  tone: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Кнопки под текстом: «Сократить до 12», «Повторить» */
  actions?: ReactNode;
  className?: string;
}

/**
 * Плашка-предупреждение в форме или карточке: иконка + текст на подложке тона.
 * danger объявляется скринридеру сразу (role="alert"), остальные — вежливо.
 */
const Alert = ({ tone, title, children, actions, className }: AlertProps) => {
  const Icon = ICONS[tone];
  const { fg, bg } = TONE_CLASSES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5", bg, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", fg)} strokeWidth={1.75} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {title && <p className="font-medium text-[var(--color-text)]">{title}</p>}
        {children && <div className="text-[var(--color-text)]">{children}</div>}
        {actions && <div className="flex flex-wrap gap-2 pt-0.5">{actions}</div>}
      </div>
    </div>
  );
};

export default Alert;
