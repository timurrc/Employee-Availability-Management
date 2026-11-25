import { useId, type ComponentProps } from "react";
import { cn } from "@/utils/cn";

interface TextareaProps extends ComponentProps<"textarea"> {
  label?: string;
  error?: string;
  hint?: string;
}

/** Многострочное поле в стиле Input: комментарий к заявке, причина отказа */
const Textarea = ({ label, error, hint, id, className, rows = 3, ...props }: TextareaProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const noteId = `${fieldId}-note`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-[var(--color-text-muted)]">
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? noteId : undefined}
        className={cn(
          "resize-y rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 transition-colors outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-focus)]",
          error && "border-[var(--color-danger)]",
          className,
        )}
        {...props}
      />
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

export default Textarea;
