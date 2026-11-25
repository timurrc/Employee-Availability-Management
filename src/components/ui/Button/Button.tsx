import type { ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/utils/cn";

const VARIANTS = {
  /** Одна на экран/модалку — главное действие */
  primary:
    "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]",
  secondary:
    "border border-[var(--color-border-strong)] bg-[var(--color-elevated)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
  ghost: "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
  /** Только удаление; «Отклонить» — secondary */
  danger: "bg-[var(--color-danger)] text-[var(--color-bg)] hover:opacity-90",
} as const;

const SIZES = {
  sm: "h-7 gap-1.5 px-2.5 text-sm",
  md: "h-9 gap-2 px-3.5",
  icon: "size-9",
} as const;

interface ButtonProps extends ComponentProps<"button"> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  isLoading?: boolean;
}

/** Во время загрузки спиннер встаёт на место иконки — ширина кнопки не меняется */
const Button = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) => {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        isLoading && "[&>svg:not(.spinner)]:hidden",
        className,
      )}
      {...props}
    >
      {isLoading && <LoaderCircle className="spinner animate-spin" aria-hidden />}
      {children}
    </button>
  );
};

export default Button;
