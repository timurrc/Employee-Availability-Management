import { format, getDaysInMonth } from "date-fns";
import { ru } from "date-fns/locale/ru";
import type { z } from "zod";
import {
  type CalendarIndex,
  fromISODate,
  monthNorm,
  quarterNorm,
  toISODate,
  yearNorm,
} from "@/core/calendar";
import type { calendarSourceSchema } from "@/schemas/calendar.schema";
import type { ICalendarDay, ICalendarYear } from "@/types/calendar.types";
import type { ISODate } from "@/types/common.types";

/** Норма часов для 40-, 36- и 24-часовой недели (часов в день при пятидневке) */
export const WEEK_HOURS = [40, 36, 24] as const;
export type WeekHours = (typeof WEEK_HOURS)[number];
const hoursPerDay = (week: WeekHours) => week / 5;

export const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2026, i, 1), "LLLL", { locale: ru }),
).map((name) => name[0]!.toUpperCase() + name.slice(1));

export type PeriodTab = "year" | "1" | "2" | "3" | "4";

export const PERIOD_TABS: { value: PeriodTab; label: string }[] = [
  { value: "year", label: "Год" },
  { value: "1", label: "I кв" },
  { value: "2", label: "II кв" },
  { value: "3", label: "III кв" },
  { value: "4", label: "IV кв" },
];

/** Часы с одним знаком после запятой, без «,0»: 1970 ч, 1772,4 ч */
export const formatHours = (hours: number) =>
  `${(Math.round(hours * 10) / 10).toLocaleString("ru-RU")} ч`;

export interface IYearSummary {
  workingDays: number;
  daysOff: number;
  hours: Record<WeekHours, number>;
  /** По постановлению; undefined — контрольной суммы в источнике нет */
  expected?: number;
  /** Число рабочих дней не сходится с постановлением */
  mismatch: boolean;
}

export const yearSummary = (calendar: CalendarIndex, year: ICalendarYear): IYearSummary => {
  const norm = yearNorm(calendar, year.year);
  return {
    workingDays: norm.workingDays,
    daysOff: norm.daysOff,
    hours: {
      40: norm.hours,
      36: yearNorm(calendar, year.year, hoursPerDay(36)).hours,
      24: yearNorm(calendar, year.year, hoursPerDay(24)).hours,
    },
    expected: year.expectedWorkingDays,
    mismatch:
      year.expectedWorkingDays !== undefined && year.expectedWorkingDays !== norm.workingDays,
  };
};

export interface INormRow {
  label: string;
  calendarDays: number;
  workingDays: number;
  daysOff: number;
  hours: Record<WeekHours, number>;
}

const normRow = (label: string, norm: (perDay: number) => ReturnType<typeof yearNorm>) => {
  const base = norm(8);
  return {
    label,
    calendarDays: base.calendarDays,
    workingDays: base.workingDays,
    daysOff: base.daysOff,
    hours: { 40: base.hours, 36: norm(hoursPerDay(36)).hours, 24: norm(hoursPerDay(24)).hours },
  };
};

const QUARTER_NAMES = ["I квартал", "II квартал", "III квартал", "IV квартал"];

/** Таблица под сводкой: «Год» — по кварталам, квартал — по его месяцам */
export const normRows = (calendar: CalendarIndex, year: number, tab: PeriodTab): INormRow[] =>
  tab === "year"
    ? QUARTER_NAMES.map((label, i) =>
        normRow(label, (perDay) => quarterNorm(calendar, year, i + 1, perDay)),
      )
    : [0, 1, 2].map((offset) => {
        const month = (Number(tab) - 1) * 3 + offset + 1;
        return normRow(MONTH_NAMES[month - 1]!, (perDay) =>
          monthNorm(calendar, year, month, perDay),
        );
      });

/** Сетка месяца по неделям с пн; null — пустые клетки до 1-го и после последнего числа */
export const monthWeeks = (year: ICalendarYear, month: number): (ICalendarDay | null)[][] => {
  const first = new Date(year.year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const total = getDaysInMonth(first);
  const startIndex = year.days.findIndex((d) => d.date === toISODate(first));
  const cells: (ICalendarDay | null)[] = [
    ...Array<null>(lead).fill(null),
    ...year.days.slice(startIndex, startIndex + total),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
};

const KIND_LABEL: Record<ICalendarDay["kind"], string> = {
  workday: "рабочий",
  weekend: "выходной",
  holiday: "праздник",
};

/** Подпись дня для скринридера и тултипа: «23 февраля 2027, праздник — День защитника Отечества» */
export const dayLabel = (day: ICalendarDay) => {
  const parts = [format(fromISODate(day.date), "d MMMM yyyy, EEEE", { locale: ru })];
  let kind = KIND_LABEL[day.kind];
  if (day.isTransfer) kind += day.kind === "workday" ? " (перенос)" : " (перенесённый)";
  if (day.isShortened) kind += ", сокращённый на 1 ч";
  parts.push(kind);
  return `${parts.join(", ")}${day.note ? ` — ${day.note}` : ""}`;
};

/** Ошибка импорта человеческим языком: «holidays[3]: Такой даты не существует» */
export const importErrorText = (error: z.ZodError<z.input<typeof calendarSourceSchema>>) => {
  const issue = error.issues[0];
  if (!issue) return "Файл не похож на календарь";
  const path = issue.path
    .map((part, index) =>
      typeof part === "number" ? `[${part}]` : `${index ? "." : ""}${String(part)}`,
    )
    .join("");
  return path && !issue.message.startsWith("Нет поля")
    ? `${path}: ${issue.message}`
    : issue.message;
};

/** Начальный фокус в сетке года: сегодня, если в этом году, иначе 1 января */
export const initialFocusDate = (year: number, today: ISODate) =>
  today.startsWith(`${year}-`) ? today : `${year}-01-01`;
