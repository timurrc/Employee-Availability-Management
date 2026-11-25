import { ArrowLeftRight } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { countWorkingDays, shiftISODate, workingHours, type CalendarIndex } from "@/core/calendar";
import type { ICalendarDay, ICalendarYear } from "@/types/calendar.types";
import type { ISODate } from "@/types/common.types";
import { cn } from "@/utils/cn";
import {
  dayLabel,
  formatHours,
  initialFocusDate,
  MONTH_NAMES,
  monthWeeks,
} from "@/utils/productionCalendar";

interface ProductionCalendarGridProps {
  year: ICalendarYear;
  calendar: CalendarIndex;
  today: ISODate;
  /** Клик/Enter по дню. Админ — правка, остальные — без действия (тултип) */
  onDayClick?: (day: ICalendarDay) => void;
}

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const KEY_STEP: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

const dayClass = (day: ICalendarDay) =>
  day.kind === "holiday"
    ? "bg-[var(--color-cal-holiday-bg)] text-[var(--color-cal-holiday)] font-medium"
    : day.kind === "weekend"
      ? "bg-[var(--color-cal-weekend-bg)] text-[var(--color-text-muted)]"
      : "text-[var(--color-text)]";

/**
 * Год из 12 месяцев. Одна точка табуляции на весь год (roving tabindex): стрелки — по дням,
 * Enter/пробел — действие. Раскраска — docs/design/03-foundations.md.
 */
const ProductionCalendarGrid = ({
  year,
  calendar,
  today,
  onDayClick,
}: ProductionCalendarGridProps) => {
  const [focused, setFocused] = useState(() => initialFocusDate(year.year, today));
  // Сменили год — фокус в новом году
  const active = focused.startsWith(`${year.year}-`) ? focused : initialFocusDate(year.year, today);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEP[event.key];
    if (step === undefined) return;
    const next = shiftISODate(active, step);
    if (!next.startsWith(`${year.year}-`)) return;
    event.preventDefault();
    setFocused(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus();
  };

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      onKeyDown={onKeyDown}
      data-testid="production-calendar"
    >
      {MONTH_NAMES.map((name, index) => {
        const month = index + 1;
        const start = `${year.year}-${String(month).padStart(2, "0")}-01`;
        const weeks = monthWeeks(year, month);
        const last = weeks
          .flat()
          .filter((d) => d !== null)
          .at(-1)!.date;
        const working = countWorkingDays(calendar, start, last);
        const hours = workingHours(calendar, { start, end: last });
        return (
          <section
            key={name}
            aria-label={name}
            className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-3"
          >
            <h3 className="font-medium">{name}</h3>
            <table className="w-full table-fixed border-separate border-spacing-0.5 text-center text-sm">
              <thead>
                <tr>
                  {WEEKDAYS.map((weekday) => (
                    <th
                      key={weekday}
                      scope="col"
                      className="text-xs font-normal text-[var(--color-text-subtle)]"
                    >
                      {weekday}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, row) => (
                  <tr key={row}>
                    {week.map((day, col) =>
                      day ? (
                        <td key={day.date} className="p-0">
                          <button
                            type="button"
                            data-date={day.date}
                            tabIndex={day.date === active ? 0 : -1}
                            aria-label={dayLabel(day)}
                            title={dayLabel(day)}
                            onFocus={() => setFocused(day.date)}
                            onClick={() => onDayClick?.(day)}
                            className={cn(
                              "relative flex h-8 w-full items-center justify-center rounded-[var(--radius-sm)] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
                              dayClass(day),
                              onDayClick
                                ? "cursor-pointer hover:ring-1 hover:ring-[var(--color-border-strong)]"
                                : "cursor-default",
                              day.date === today &&
                                "ring-2 ring-[var(--color-cal-today)] ring-inset",
                            )}
                          >
                            {Number(day.date.slice(8))}
                            {/* Пометка — псевдоэлементом: в aria-label уже есть «сокращённый» (WCAG 2.5.3) */}
                            {day.isShortened && (
                              <span
                                className="absolute top-0 right-0.5 text-[10px] leading-none text-[var(--color-warning)] before:content-['−1']"
                                aria-hidden
                              />
                            )}
                            {day.isTransfer && (
                              <ArrowLeftRight
                                className="absolute bottom-0.5 left-0.5 size-2.5 opacity-70"
                                aria-hidden
                              />
                            )}
                          </button>
                        </td>
                      ) : (
                        <td key={`empty-${row}-${col}`} />
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-[var(--color-text-muted)]">
              {working} раб. дн. · {formatHours(hours)}
            </p>
          </section>
        );
      })}
    </div>
  );
};

export default ProductionCalendarGrid;
