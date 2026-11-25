import { eachDayOfInterval, format, isWeekend, parseISO } from "date-fns";
import type { ICalendarDay, ICalendarYear, ICalendarYearSource } from "@/types/calendar.types";
import type { ISODate } from "@/types/common.types";

/** Date → "YYYY-MM-DD" в локальном времени, без сдвига часового пояса */
export const toISODate = (date: Date): ISODate => format(date, "yyyy-MM-dd");

/** "YYYY-MM-DD" → Date на локальную полночь */
export const fromISODate = (date: ISODate): Date => parseISO(date);

/**
 * Собирает все дни года из исходных данных: выходные по умолчанию — суббота и воскресенье,
 * поверх — праздники, переносы и сокращённые дни.
 * Остальная логика календаря (рабочие дни, сроки, нормы часов) — этап 1.
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
