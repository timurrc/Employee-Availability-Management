import { addDays, eachDayOfInterval, format, isWeekend, parseISO } from "date-fns";
import type { ICalendarDay, ICalendarYear, ICalendarYearSource } from "@/types/calendar.types";
import type { IClosedPeriod, ISODate } from "@/types/common.types";

/** Date → "YYYY-MM-DD" в локальном времени, без сдвига часового пояса */
export const toISODate = (date: Date): ISODate => format(date, "yyyy-MM-dd");

/** "YYYY-MM-DD" → Date на локальную полночь */
export const fromISODate = (date: ISODate): Date => parseISO(date);

/** Сдвиг ISO-даты на N календарных дней */
export const shiftISODate = (date: ISODate, days: number): ISODate =>
  toISODate(addDays(fromISODate(date), days));

/** Все даты периода включительно; для закрытого периода */
export const eachISODate = (start: ISODate, end: ISODate): ISODate[] =>
  start > end
    ? []
    : eachDayOfInterval({ start: fromISODate(start), end: fromISODate(end) }).map(toISODate);

/**
 * Собирает все дни года из исходных данных: выходные по умолчанию — суббота и воскресенье,
 * поверх — праздники, переносы и сокращённые дни.
 */
export const buildCalendarYear = (source: ICalendarYearSource): ICalendarYear => {
  const holidays = new Map(source.holidays.map((day) => [day.date, day.note]));
  const daysOff = new Map(source.extraDaysOff.map((day) => [day.date, day.note]));
  const workingWeekends = new Map(source.workingWeekends.map((day) => [day.date, day.note]));
  const shortened = new Set(source.shortened);

  const days = eachDayOfInterval({
    start: new Date(source.year, 0, 1),
    end: new Date(source.year, 11, 31),
  }).map((date): ICalendarDay => {
    const iso = toISODate(date);
    const isShortened = shortened.has(iso);

    if (holidays.has(iso)) {
      return {
        date: iso,
        kind: "holiday",
        isShortened,
        isTransfer: false,
        note: holidays.get(iso),
      };
    }
    if (daysOff.has(iso)) {
      return { date: iso, kind: "weekend", isShortened, isTransfer: true, note: daysOff.get(iso) };
    }
    if (workingWeekends.has(iso)) {
      return {
        date: iso,
        kind: "workday",
        isShortened,
        isTransfer: true,
        note: workingWeekends.get(iso),
      };
    }
    return {
      date: iso,
      kind: isWeekend(date) ? "weekend" : "workday",
      isShortened,
      isTransfer: false,
    };
  });

  return { year: source.year, source: source.source, days };
};

/** Производственный календарь, готовый к быстрым запросам по дате */
export type CalendarIndex = ReadonlyMap<ISODate, ICalendarDay>;

export const indexCalendar = (years: ICalendarYear[]): CalendarIndex =>
  new Map(years.flatMap((year) => year.days.map((day) => [day.date, day] as const)));

/** Защита от бесконечного поиска рабочего дня в некорректном календаре */
const MAX_SCAN_DAYS = 366 * 3;

/**
 * День календаря. Для года, которого нет в календаре, — обычная пятидневка
 * (сб/вс — выходные), чтобы расчёты не падали за пределами 2026–2027.
 */
export const getDay = (calendar: CalendarIndex, date: ISODate): ICalendarDay =>
  calendar.get(date) ?? {
    date,
    kind: isWeekend(fromISODate(date)) ? "weekend" : "workday",
    isShortened: false,
    isTransfer: false,
  };

export const isWorkingDay = (calendar: CalendarIndex, date: ISODate): boolean =>
  getDay(calendar, date).kind === "workday";

/**
 * Дата + N рабочих дней. Сама дата `from` не считается: «3 рабочих дня от пятницы» —
 * среда. N = 0 — сама дата. Отрицательное N — назад.
 */
export const addWorkingDays = (calendar: CalendarIndex, from: ISODate, amount: number): ISODate => {
  const step = amount < 0 ? -1 : 1;
  let left = Math.abs(amount);
  let date = from;
  let scanned = 0;
  while (left > 0) {
    date = shiftISODate(date, step);
    if (isWorkingDay(calendar, date)) left -= 1;
    if (++scanned > MAX_SCAN_DAYS) throw new Error("В календаре не найдено рабочих дней");
  }
  return date;
};

/** Ближайший рабочий день начиная с самой даты */
export const nextWorkingDay = (calendar: CalendarIndex, date: ISODate): ISODate =>
  isWorkingDay(calendar, date) ? date : addWorkingDays(calendar, date, 1);

/** Рабочие дни периода включительно */
export const countWorkingDays = (calendar: CalendarIndex, start: ISODate, end: ISODate): number =>
  eachISODate(start, end).filter((date) => isWorkingDay(calendar, date)).length;

/** Норма часов за период: рабочие дни × часы в день, минус час за каждый предпраздничный */
export const workingHours = (
  calendar: CalendarIndex,
  period: IClosedPeriod,
  hoursPerDay = 8,
): number =>
  eachISODate(period.start, period.end).reduce((sum, date) => {
    const day = getDay(calendar, date);
    if (day.kind !== "workday") return sum;
    return sum + hoursPerDay - (day.isShortened ? 1 : 0);
  }, 0);

/**
 * Нерабочие дни строго после `start` и до `end` включительно, кроме обычных сб/вс —
 * праздники и перенесённые выходные. Нужны для объяснения сроков: «+2 дня: 4–5 нояб.».
 */
export const specialDaysOffBetween = (
  calendar: CalendarIndex,
  start: ISODate,
  end: ISODate,
): ICalendarDay[] =>
  eachISODate(shiftISODate(start, 1), end)
    .map((date) => getDay(calendar, date))
    .filter((day) => day.kind === "holiday" || (day.kind === "weekend" && day.isTransfer));

export interface INorm {
  /** Календарных дней */
  calendarDays: number;
  workingDays: number;
  /** Выходные и праздничные */
  daysOff: number;
  hours: number;
}

const norm = (calendar: CalendarIndex, period: IClosedPeriod, hoursPerDay: number): INorm => {
  const calendarDays = eachISODate(period.start, period.end).length;
  const workingDays = countWorkingDays(calendar, period.start, period.end);
  return {
    calendarDays,
    workingDays,
    daysOff: calendarDays - workingDays,
    hours: workingHours(calendar, period, hoursPerDay),
  };
};

const monthPeriod = (year: number, firstMonth: number, lastMonth: number) => ({
  start: toISODate(new Date(year, firstMonth - 1, 1)),
  end: toISODate(new Date(year, lastMonth, 0)),
});

/** Норма за месяц; month — 1…12 */
export const monthNorm = (
  calendar: CalendarIndex,
  year: number,
  month: number,
  hoursPerDay = 8,
): INorm => norm(calendar, monthPeriod(year, month, month), hoursPerDay);

/** Норма за квартал; quarter — 1…4 */
export const quarterNorm = (
  calendar: CalendarIndex,
  year: number,
  quarter: number,
  hoursPerDay = 8,
): INorm => norm(calendar, monthPeriod(year, quarter * 3 - 2, quarter * 3), hoursPerDay);

export const yearNorm = (calendar: CalendarIndex, year: number, hoursPerDay = 8): INorm =>
  norm(calendar, monthPeriod(year, 1, 12), hoursPerDay);
