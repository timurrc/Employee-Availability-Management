import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/utils/cn";

interface CardProps extends Omit<ComponentProps<"section">, "title"> {
  title?: ReactNode;
  /** Справа от заголовка: переключатель, счётчик, ссылка */
  aside?: ReactNode;
  /** Без внутренних отступов у тела — для списков во всю ширину */
  flush?: boolean;
}

/** Карточка-секция: заголовок 16/600 + тело с отступом 16 */
const Card = ({ title, aside, flush = false, className, children, ...props }: CardProps) => {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)]",
        className,
      )}
      {...props}
    >
      {(title || aside) && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 pb-3">
          {title && <h2 className="text-md font-semibold">{title}</h2>}
          {aside}
        </header>
      )}
      <div className={cn(!flush && "px-4 pb-4", !title && !aside && !flush && "pt-4")}>
        {children}
      </div>
    </section>
  );
};

export default Card;
