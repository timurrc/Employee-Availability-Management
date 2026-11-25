import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { TONE_CLASSES, type Tone } from "@/constants/tones";
import { cn } from "@/utils/cn";

interface BadgeProps extends ComponentProps<"span"> {
  tone?: Tone;
  icon?: LucideIcon;
}

/** Статус: иконка + текст на подложке тона — цвет никогда не единственный сигнал */
const Badge = ({ tone = "neutral", icon: Icon, className, children, ...props }: BadgeProps) => {
  const { fg, bg } = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-full items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-sm font-medium whitespace-nowrap",
        fg,
        bg,
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
};

export default Badge;
