import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** 0–1 действие: «Сбросить фильтры», «Подать заявку» */
  action?: ReactNode;
  className?: string;
}

/** Пустой список. Если есть хорошая новость — называем её: «Все на месте». */
const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
      <Icon className="size-8 text-[var(--color-text-subtle)]" strokeWidth={1.75} aria-hidden />
      <p className="text-md font-semibold">{title}</p>
      {description && <p className="max-w-sm text-[var(--color-text-muted)]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;
