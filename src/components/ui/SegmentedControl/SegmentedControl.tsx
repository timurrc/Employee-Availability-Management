import { cn } from "@/utils/cn";

interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Подпись группы для скринридера: «Масштаб» */
  label: string;
  className?: string;
}

/** Переключатель из 2–4 вариантов: «Мой отдел | Все», «2 нед | Месяц | Квартал» */
const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) => {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 cursor-pointer rounded-[calc(var(--radius-md)-2px)] px-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
