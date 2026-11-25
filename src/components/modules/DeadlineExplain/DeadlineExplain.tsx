import { differenceInCalendarDays } from "date-fns";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { fromISODate } from "@/core/calendar";
import type { IDayRange } from "@/core/deadline";
import type { ISODate } from "@/types/common.types";
import { cn } from "@/utils/cn";
import { formatDay, formatPeriod, plural } from "@/utils/date";

interface DeadlineExplainProps {
  /** День старта — сам не считается: срок идёт со следующего рабочего дня */
  start: ISODate;
  due: ISODate;
  durationDays: number;
  /** Праздники и перенесённые выходные внутри срока */
  extraDaysOff: IDayRange[];
  /** Риск / подсказка под датой */
  children?: ReactNode;
  className?: string;
}

const days = (count: number) => plural(count, ["день", "дня", "дней"]);

/**
 * Срок датой + разбор: «+3 календ. дня: 4 нояб. — День народного единства; 2 выходных».
 * Выходные считаются как разница: календарные дни − рабочие − праздники.
 */
const DeadlineExplain = ({
  start,
  due,
  durationDays,
  extraDaysOff,
  children,
  className,
}: DeadlineExplainProps) => {
  const calendarDays = differenceInCalendarDays(fromISODate(due), fromISODate(start));
  const extra = calendarDays - durationDays;
  const special = extraDaysOff.reduce((sum, range) => sum + range.days.length, 0);
  const weekends = extra - special;

  const reasons = [
    ...extraDaysOff.map((range) => {
      const note = range.days.find((d) => d.note)?.note;
      const kind = range.days.every((d) => d.kind === "holiday") ? "праздник" : "перенос выходного";
      return `${formatPeriod({ start: range.start, end: range.end })} — ${note ?? kind}`;
    }),
    ...(weekends > 0
      ? [`${weekends} ${plural(weekends, ["выходной", "выходных", "выходных"])}`]
      : []),
  ];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-lg font-semibold tabular-nums">до {formatDay(due)}</p>
      <p className="text-[var(--color-text-muted)]">
        {durationDays} раб. {days(durationDays)} с {formatDay(start)}
      </p>
      {extra > 0 && (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-[var(--color-primary)] [&::-webkit-details-marker]:hidden">
            +{extra} календ. {days(extra)} — почему
            <ChevronDown
              className="size-3.5 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-[var(--color-text-muted)]">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      )}
      {children}
    </div>
  );
};

export default DeadlineExplain;
