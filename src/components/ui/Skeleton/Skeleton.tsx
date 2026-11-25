import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface SkeletonProps {
  className?: string;
}

/** Плашка-заглушка, повторяет форму контента */
const Skeleton = ({ className }: SkeletonProps) => (
  <span
    className={cn(
      "block animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-2)]",
      className,
    )}
    aria-hidden
  />
);

interface DelayedProps {
  children: ReactNode;
  /** Быстрые загрузки не мигают скелетоном */
  delay?: number;
}

/** Показывает содержимое через 300 мс — чтобы короткая загрузка не мигала */
export const Delayed = ({ children, delay = 300 }: DelayedProps) => {
  const [visible, setVisible] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) return;
    const id = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  return visible ? children : null;
};

export default Skeleton;
