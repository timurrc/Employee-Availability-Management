import { TONE_CLASSES, type Tone } from "@/constants/tones";
import { cn } from "@/utils/cn";
import { initials } from "@/utils/text";

const SIZES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-14 text-lg",
} as const;

interface AvatarProps {
  /** «Фамилия Имя Отчество» — инициалы из первых двух слов */
  name: string;
  size?: keyof typeof SIZES;
  /** Кольцо цвета отсутствия — человек сегодня отсутствует */
  ring?: Tone;
  /** Точка warning — отсутствие начнётся в ближайшие дни */
  soon?: boolean;
  className?: string;
}

/**
 * Инициалы в круге. Кольцо и точка — дополнительные сигналы: рядом всегда есть текст статуса,
 * поэтому аватар скрыт от скринридеров.
 */
const Avatar = ({ name, size = "md", ring, soon, className }: AvatarProps) => {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-[var(--color-surface-2)] font-medium text-[var(--color-text-muted)]",
          SIZES[size],
          ring && ["border-2", TONE_CLASSES[ring].border],
        )}
      >
        {initials(name)}
      </span>
      {soon && (
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--color-elevated)] bg-[var(--color-warning)]" />
      )}
    </span>
  );
};

export default Avatar;
