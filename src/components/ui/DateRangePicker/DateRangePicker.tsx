import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale/ru";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import Button from "@/components/ui/Button/Button";
import { cn } from "@/utils/cn";

/** YYYY-MM-DD */
type ISODate = string;

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

/** Как раскрасить день: ui не знает о производственном календаре — его передаёт вызывающий */
export interface DayInfo {
  kind: "workday" | "weekend" | "holiday";
  /** Тултип: название праздника, «Перенос с 20 февр.» */
  note?: string;
}

interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  /** Месяц, который показать первым; по умолчанию — месяц начала периода или текущий */
  initialMonth?: ISODate;
  dayInfo?: (date: ISODate) => DayInfo;
  /** Живой расчёт под календарём: «14 календарных дней, из них 1 праздник → …» */
  summary?: ReactNode;
  /** Один месяц вместо двух (узкие контейнеры); на мобильном — всегда один */
  single?: boolean;
  min?: ISODate;
  label?: string;
}

const toISO = (date: Date): ISODate => format(date, "yyyy-MM-dd");
const fromISO = (date: ISODate) => parse(date, "yyyy-MM-dd", new Date());
const INPUT_FORMAT = "dd.MM.yyyy";

const toInput = (date: ISODate | undefined) => (date ? format(fromISO(date), INPUT_FORMAT) : "");
const fromInput = (text: string): ISODate | null => {
  const parsed = parse(text, INPUT_FORMAT, new Date());
  return text.length === 10 && isValid(parsed) ? toISO(parsed) : null;
};

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const monthDays = (month: Date) =>
  eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

const defaultInfo = (date: ISODate): DayInfo => {
  const day = fromISO(date).getDay();
  return { kind: day === 0 || day === 6 ? "weekend" : "workday" };
};

/**
 * Выбор периода: два месяца рядом (на мобильном — один), дни раскрашены по календарю,
 * ввод с клавиатуры в полях ДД.ММ.ГГГГ, по сетке — стрелками.
 * Первый клик — начало, второй — конец (раньше начала — периоды меняются местами).
 */
const DateRangePicker = ({
  value,
  onChange,
  initialMonth,
  dayInfo = defaultInfo,
  summary,
  single = false,
  min,
  label = "Период",
}: DateRangePickerProps) => {
  const [month, setMonth] = useState(() =>
    startOfMonth(fromISO(initialMonth ?? value?.start ?? toISO(new Date()))),
  );
  /** Выбрано только начало — ждём второй клик */
  const [anchor, setAnchor] = useState<ISODate | null>(null);
  const [hover, setHover] = useState<ISODate | null>(null);
  const [focused, setFocused] = useState<ISODate | null>(null);
  const [inputs, setInputs] = useState({ start: toInput(value?.start), end: toInput(value?.end) });

  const commit = (range: DateRange | null) => {
    onChange(range);
    setInputs({ start: toInput(range?.start), end: toInput(range?.end) });
  };

  const pick = (date: ISODate) => {
    if (!anchor) {
      setAnchor(date);
      onChange(null);
      setInputs({ start: toInput(date), end: "" });
      return;
    }
    const [start, end] = anchor <= date ? [anchor, date] : [date, anchor];
    setAnchor(null);
    setHover(null);
    commit({ start, end });
  };

  const onInput = (field: "start" | "end", text: string) => {
    const next = { ...inputs, [field]: text };
    setInputs(next);
    const start = fromInput(next.start);
    const end = fromInput(next.end);
    if (start && end && start <= end) {
      setAnchor(null);
      onChange({ start, end });
      setMonth(startOfMonth(fromISO(start)));
    }
  };

  const preview: DateRange | null = anchor
    ? hover
      ? anchor <= hover
        ? { start: anchor, end: hover }
        : { start: hover, end: anchor }
      : { start: anchor, end: anchor }
    : value;

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, date: ISODate) => {
    const shift = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (shift === undefined) return;
    event.preventDefault();
    const next = toISO(addDays(fromISO(date), shift));
    const nextMonth = startOfMonth(fromISO(next));
    const visibleEnd = addMonths(month, single ? 0 : 1);
    if (nextMonth < month) setMonth(nextMonth);
    else if (nextMonth > visibleEnd) setMonth(addMonths(nextMonth, single ? 0 : -1));
    setFocused(next);
    if (anchor) setHover(next);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus(),
    );
  };

  const renderMonth = (current: Date, extraClass?: string) => {
    const days = monthDays(current);
    const tabbable =
      focused && isSameMonth(fromISO(focused), current)
        ? focused
        : (value?.start && isSameMonth(fromISO(value.start), current) && value.start) ||
          toISO(startOfMonth(current));

    return (
      <div className={cn("flex flex-col gap-2", extraClass)}>
        <p className="text-center font-medium capitalize">
          {format(current, "LLLL yyyy", { locale: ru })}
        </p>
        <div role="grid" aria-label={format(current, "LLLL yyyy", { locale: ru })}>
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                role="columnheader"
                className="py-1 text-center text-xs text-[var(--color-text-subtle)]"
              >
                {day}
              </span>
            ))}
          </div>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <div role="row" key={week} className="grid grid-cols-7">
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const iso = toISO(day);
                if (!isSameMonth(day, current)) return <span key={iso} role="gridcell" />;
                const info = dayInfo(iso);
                const disabled = Boolean(min && iso < min);
                const inRange = preview && iso >= preview.start && iso <= preview.end;
                const isEdge = preview && (iso === preview.start || iso === preview.end);
                return (
                  <span key={iso} role="gridcell" aria-selected={Boolean(inRange)}>
                    <button
                      type="button"
                      data-date={iso}
                      tabIndex={iso === tabbable ? 0 : -1}
                      disabled={disabled}
                      title={info.note}
                      aria-label={`${format(day, "d MMMM yyyy, EEEE", { locale: ru })}${
                        info.kind === "holiday"
                          ? `, праздник${info.note ? `: ${info.note}` : ""}`
                          : ""
                      }`}
                      onClick={() => pick(iso)}
                      onMouseEnter={() => anchor && setHover(iso)}
                      onKeyDown={(event) => moveFocus(event, iso)}
                      className={cn(
                        "flex h-9 w-full cursor-pointer items-center justify-center text-base tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        info.kind === "weekend" &&
                          "bg-[var(--color-cal-weekend-bg)] text-[var(--color-text-muted)]",
                        info.kind === "holiday" &&
                          "bg-[var(--color-cal-holiday-bg)] font-medium text-[var(--color-cal-holiday)]",
                        inRange && "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
                        isEdge &&
                          "rounded-[var(--radius-md)] bg-[var(--color-primary)] font-medium text-[var(--color-on-primary)]",
                        !inRange && "hover:bg-[var(--color-surface-2)]",
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <DateInput label="С" value={inputs.start} onChange={(text) => onInput("start", text)} />
        <span className="pb-2 text-[var(--color-text-subtle)]" aria-hidden>
          –
        </span>
        <DateInput label="По" value={inputs.end} onChange={(text) => onInput("end", text)} />
        {value && (
          <Button variant="ghost" size="sm" className="mb-1" onClick={() => commit(null)}>
            Очистить
          </Button>
        )}
      </div>

      <div className="relative">
        <div className="absolute top-0 flex w-full justify-between">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Предыдущий месяц"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Следующий месяц"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="grid gap-6 pt-2 md:grid-cols-2" onMouseLeave={() => setHover(null)}>
          {renderMonth(month, single ? "md:col-span-2" : undefined)}
          {!single && renderMonth(addMonths(month, 1), "hidden md:flex")}
        </div>
      </div>

      {anchor && (
        <p className="text-sm text-[var(--color-text-muted)]" aria-live="polite">
          Выберите дату окончания
        </p>
      )}
      {summary && <div aria-live="polite">{summary}</div>}
    </fieldset>
  );
};

interface DateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const DateInput = ({ label, value, onChange }: DateInputProps) => (
  <label className="flex flex-col gap-1 text-sm text-[var(--color-text-muted)]">
    {label}
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="ДД.ММ.ГГГГ"
      inputMode="numeric"
      maxLength={10}
      className="h-9 w-32 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-base text-[var(--color-text)] tabular-nums outline-none focus:border-[var(--color-focus)]"
    />
  </label>
);

export default DateRangePicker;
