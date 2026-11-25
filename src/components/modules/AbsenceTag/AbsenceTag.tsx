import { ABSENCE_META } from "@/constants/absence";
import { TONE_CLASSES } from "@/constants/tones";
import type { AbsenceType } from "@/types/absence.types";
import type { IPeriod } from "@/types/common.types";
import { cn } from "@/utils/cn";
import { formatPeriod } from "@/utils/date";

interface AbsenceTagProps {
  type: AbsenceType;
  period?: IPeriod;
  /** На согласовании / черновик — штриховка и пунктир */
  pending?: boolean;
  className?: string;
}

/**
 * Тип отсутствия: иконка + подпись + период. Согласованное — сплошная подложка с левой
 * границей; на согласовании — штриховка. Открытый больничный — «дата выхода неизвестна».
 */
const AbsenceTag = ({ type, period, pending = false, className }: AbsenceTagProps) => {
  const { label, icon: Icon, tone } = ABSENCE_META[type];
  const { fg, bg, border } = TONE_CLASSES[tone];
  const isOpen = period && period.end === null;

  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-full items-center gap-1 rounded-[var(--radius-sm)] border-l-[3px] pr-1.5 pl-1 text-sm font-medium whitespace-nowrap",
        fg,
        bg,
        border,
        pending && "border-dashed pattern-pending",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="truncate">
        {label}
        {period && <span className="font-normal"> · {formatPeriod(period)}</span>}
        {isOpen && <span className="font-normal">, дата выхода неизвестна</span>}
        {pending && <span className="font-normal"> (на согласовании)</span>}
      </span>
    </span>
  );
};

export default AbsenceTag;
