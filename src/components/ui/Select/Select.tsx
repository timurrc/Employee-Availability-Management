import { ChevronDown } from "lucide-react";
import { useId, type ComponentProps } from "react";
import { cn } from "@/utils/cn";

interface SelectProps extends ComponentProps<"select"> {
  label?: string;
  error?: string;
  hint?: string;
}

/** Нативный select в стиле Input: подпись, подсказка, ошибка. Работает с {...register()} */
const Select = ({ label, error, hint, id, className, children, ...props }: SelectProps) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const noteId = `${selectId}-note`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-[var(--color-text-muted)]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? noteId : undefined}
          className={cn(
            "h-9 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] pr-9 pl-3 transition-colors outline-none focus:border-[var(--color-focus)]",
            error && "border-[var(--color-danger)]",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden
        />
      </div>
      {(error || hint) && (
        <span
          id={noteId}
          className={cn(
            "text-sm",
            error ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]",
          )}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  );
};

export default Select;
