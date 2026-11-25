import {
  addWorkingDays,
  type CalendarIndex,
  eachISODate,
  getDay,
  isWorkingDay,
} from "@/core/calendar";
import { monthNorm } from "@/core/calendar";
import { stepDeadline, type IStepDeadline } from "@/core/deadline";
import type { IDeputyContext } from "@/core/availability";
import type { ICalendarDay } from "@/types/calendar.types";
import type { ISODate } from "@/types/common.types";
import { MONTH_NAMES } from "./productionCalendar";

export const MAX_CALC_DAYS = 365;

export type CalcMode = "add" | "between";

export const CALC_MODES: { value: CalcMode; label: string }[] = [
  { value: "add", label: "Дата + N рабочих дней" },
  { value: "between", label: "Рабочих дней между датами" },
];

export const isCalcMode = (value: string | null): value is CalcMode =>
  CALC_MODES.some((mode) => mode.value === value);

/** Ошибка поля N или null: целое, не 0, по модулю не больше 365 */
export const daysError = (raw: string) => {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isInteger(value)) return "Целое число рабочих дней";
  if (value === 0) return "Не может быть 0";
  if (Math.abs(value) > MAX_CALC_DAYS) return `Не больше ${MAX_CALC_DAYS}`;
  return null;
};

export type BreakdownItem =
  | { kind: "work"; date: ISODate; number: number; isShortened: boolean }
  | { kind: "off"; start: ISODate; end: ISODate; reason: string };

/** Почему день нерабочий: название праздника, перенос или просто выходные */
const offReason = (days: ICalendarDay[]) => {
  const notes = [...new Set(days.map((d) => d.note).filter(Boolean))] as string[];
  if (notes.length > 0) return notes.join(", ");
  return "выходные";
};

export interface IAddResult {
  result: ISODate;
  /** Сколько календарных дней от «От» до результата */
  calendarDays: number;
  items: BreakdownItem[];
  /** В интервале есть праздники или переносы (иначе разбор можно свернуть) */
  hasSpecial: boolean;
}

/**
 * Дата + N рабочих дней с разбором по дням: рабочие пронумерованы, подряд идущие
 * нерабочие склеены в интервал с причиной. Отсчёт — со следующего дня после «От».
 */
export const addWithBreakdown = (
  calendar: CalendarIndex,
  from: ISODate,
  days: number,
): IAddResult => {
  const result = addWorkingDays(calendar, from, days);
  const forward = days > 0;
  const dates = forward
    ? eachISODate(from, result).slice(1)
    : eachISODate(result, from).slice(0, -1);
  const items: BreakdownItem[] = [];
  let number = forward ? 0 : Math.abs(days) + 1;
  let off: ICalendarDay[] = [];
  const flush = () => {
    if (off.length === 0) return;
    items.push({ kind: "off", start: off[0]!.date, end: off.at(-1)!.date, reason: offReason(off) });
    off = [];
  };
  for (const date of dates) {
    const day = getDay(calendar, date);
    if (isWorkingDay(calendar, date)) {
      flush();
      number += forward ? 1 : -1;
      items.push({ kind: "work", date, number, isShortened: day.isShortened });
    } else {
      off.push(day);
    }
  }
  flush();
  return {
    result,
    calendarDays: dates.length,
    items,
    hasSpecial: dates.some((date) => {
      const day = getDay(calendar, date);
      return day.kind === "holiday" || day.isTransfer;
    }),
  };
};

export interface IFromNote {
  isWorking: boolean;
  /** Первый рабочий день отсчёта, если «От» — нерабочий */
  firstWorking: ISODate;
  note?: string;
}

export const fromNote = (calendar: CalendarIndex, from: ISODate): IFromNote => {
  const day = getDay(calendar, from);
  return {
    isWorking: day.kind === "workday",
    firstWorking: addWorkingDays(calendar, from, 1),
    note: day.note,
  };
};

export interface IBetweenResult {
  workingDays: number;
  hours: number;
  shortened: ISODate[];
  byMonth: { label: string; workingDays: number; hours: number }[];
}

/** Рабочие дни и часы между датами включительно; разбор по месяцам */
export const betweenDates = (
  calendar: CalendarIndex,
  from: ISODate,
  to: ISODate,
  hoursPerDay = 8,
): IBetweenResult => {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const dates = eachISODate(start, end);
  const working = dates.filter((date) => isWorkingDay(calendar, date));
  const shortened = working.filter((date) => getDay(calendar, date).isShortened);
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  return {
    workingDays: working.length,
    hours: working.length * hoursPerDay - shortened.length,
    shortened,
    byMonth: months.map((key) => {
      const inMonth = working.filter((d) => d.startsWith(key));
      const short = inMonth.filter((d) => getDay(calendar, d).isShortened).length;
      const [year, month] = key.split("-").map(Number) as [number, number];
      const whole = monthNorm(calendar, year, month, hoursPerDay);
      const label = `${MONTH_NAMES[month - 1]} ${year}`;
      return {
        label,
        workingDays: inMonth.length,
        hours:
          inMonth.length === whole.workingDays ? whole.hours : inMonth.length * hoursPerDay - short,
      };
    }),
  };
};

/** Каких лет нет в календаре среди дат интервала — «праздники не учтены» */
export const missingYears = (calendar: CalendarIndex, from: ISODate, to: ISODate) => {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const years = new Set<number>();
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) {
    if (!calendar.has(`${year}-01-01`)) years.add(year);
  }
  return [...years];
};

/**
 * Срок с учётом отсутствия исполнителя: обычный срок, срок «если ждать выхода»
 * и заместитель, которому можно передать (тогда — обычный срок).
 */
export interface IWithAbsence {
  plain: IStepDeadline;
  waiting: IStepDeadline | null;
}

export const deadlineWithAbsence = (
  calendar: CalendarIndex,
  employeeId: string,
  from: ISODate,
  days: number,
  context: IDeputyContext,
): IWithAbsence => {
  const step = { approverId: employeeId, durationDays: days, start: from };
  const plain = stepDeadline(calendar, step, context);
  const waiting =
    plain.risk === "delegated" || plain.risk === "no_deputy"
      ? stepDeadline(calendar, { ...step, waitForReturn: true }, context)
      : null;
  return { plain, waiting };
};
