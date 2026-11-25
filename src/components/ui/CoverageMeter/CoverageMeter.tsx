import { cn } from "@/utils/cn";
import { coverageZone } from "@/utils/coverage";

interface CoverageMeterProps {
  available: number;
  total: number;
  /** Порог, % */
  threshold: number;
  /** Подпись для скринридера: «Покрытие ИТ-отдела» */
  label: string;
  className?: string;
}

const ZONE = {
  ok: { bar: "bg-[var(--color-text-muted)]", text: "text-[var(--color-text-muted)]", note: "" },
  near: { bar: "bg-[var(--color-warning)]", text: "text-[var(--color-warning)]", note: "у порога" },
  below: {
    bar: "bg-[var(--color-danger)]",
    text: "text-[var(--color-danger)]",
    note: "ниже порога",
  },
} as const;

/** Полоса 6 px: заполнение — доля доступных, риска — порог. «4 из 6 · 67%» */
const CoverageMeter = ({ available, total, threshold, label, className }: CoverageMeterProps) => {
  const percent = total === 0 ? 100 : Math.round((available / total) * 100);
  const zone = coverageZone(percent, threshold);
  const { bar, text, note } = ZONE[zone];
  const title = `Порог ${threshold}%`;

  return (
    <div className={cn("flex flex-col gap-1", className)} title={title}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={available}
        aria-valuetext={`${available} из ${total}, ${percent}%. ${title}${note ? `, ${note}` : ""}`}
        className="relative h-1.5 overflow-visible rounded-full bg-[var(--color-surface-2)]"
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", bar)}
          style={{ width: `${percent}%` }}
        />
        <span
          className="absolute -top-1 -bottom-1 w-0.5 bg-[var(--color-text)]"
          style={{ left: `${threshold}%` }}
          aria-hidden
        />
      </div>
      <p className={cn("text-sm tabular-nums", text)}>
        {available} из {total} · {percent}%{note && ` · ${note}`}
      </p>
    </div>
  );
};

export default CoverageMeter;
