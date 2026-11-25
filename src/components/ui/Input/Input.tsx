import { useId, type ComponentProps } from "react";
import { cn } from "@/utils/cn";

// ComponentProps<"input"> включает ref — в React 19 он передаётся как обычный проп,
// поэтому {...register("email")} из react-hook-form работает без forwardRef.
interface InputProps extends ComponentProps<"input"> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = ({ label, error, hint, id, className, ...props }: InputProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-text-muted)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          "h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 transition-colors outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-focus)]",
          error && "border-[var(--color-danger)]",
          className,
        )}
        {...props}
      />
      {error ? (
        <span id={errorId} className="text-sm text-[var(--color-danger)]">
          {error}
        </span>
      ) : (
        hint && (
          <span id={hintId} className="text-sm text-[var(--color-text-muted)]">
            {hint}
          </span>
        )
      )}
    </div>
  );
};

export default Input;
