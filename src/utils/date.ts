import { differenceInCalendarDays, format, isSameMonth, isSameYear } from "date-fns";
import { ru } from "date-fns/locale/ru";
import { fromISODate, toISODate } from "@/core/calendar";
import type { IPeriod, ISODate } from "@/types/common.types";

/** Тонкий пробел вокруг тире в периодах между разными месяцами: «28 дек. – 13 янв.» */
const THIN = " ";

/** Склонение: plural(5, ["день", "дня", "дней"]) → «дней» */
export const plural = (count: number, [one, few, many]: [string, string, string]) => {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};

/**
 * «9 дек.», а если год не текущий — «9 дек. 2027».
 * Сокращения месяцев date-fns: «дек.», «мая», «июн.» — их и показываем.
 */
export const formatDay = (date: ISODate, today: ISODate = todayISO()) => {
  const value = fromISODate(date);
  const pattern = isSameYear(value, fromISODate(today)) ? "d MMM" : "d MMM yyyy";
  return format(value, pattern, { locale: ru });
};

/** «9 декабря 2026» — для подписей ячеек сетки и aria-label */
export const formatDayLong = (date: ISODate) =>
  format(fromISODate(date), "d MMMM yyyy", { locale: ru });

/**
 * «1–14 дек.», «28 дек. – 13 янв.», один день — «9 дек.».
 * end = null — «с 3 дек.» (открытый больничный: дату окончания не выдумываем).
 */
export const formatPeriod = ({ start, end }: IPeriod, today: ISODate = todayISO()) => {
  if (end === null) return `с ${formatDay(start, today)}`;
  if (start === end) return formatDay(start, today);

  const from = fromISODate(start);
  const to = fromISODate(end);
  const now = fromISODate(today);
  const yearSuffix = isSameYear(to, now) && isSameYear(from, now) ? "" : ` ${format(to, "yyyy")}`;

  if (isSameMonth(from, to)) {
    return `${format(from, "d")}–${format(to, "d MMM", { locale: ru })}${yearSuffix}`;
  }
  if (isSameYear(from, to)) {
    return `${format(from, "d MMM", { locale: ru })}${THIN}–${THIN}${format(to, "d MMM", { locale: ru })}${yearSuffix}`;
  }
  return `${formatDay(start, today)}${THIN}–${THIN}${formatDay(end, today)}`;
};

/** «сегодня», «завтра», «через 3 дня» — только для ближайших 7 дней; дальше — дата */
export const formatRelative = (date: ISODate, today: ISODate = todayISO()) => {
  const diff = differenceInCalendarDays(fromISODate(date), fromISODate(today));
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчера";
  if (diff > 1 && diff <= 7) return `через ${diff} ${plural(diff, ["день", "дня", "дней"])}`;
  return formatDay(date, today);
};

/** «14 дн.» для таблиц; long — «14 календарных дней» для форм */
export const formatDays = (count: number, kind: "calendar" | "working", long = false) => {
  if (!long) return `${count} ${kind === "working" ? "раб." : "календ."} дн.`;
  const adjective =
    kind === "working"
      ? plural(count, ["рабочий", "рабочих", "рабочих"])
      : plural(count, ["календарный", "календарных", "календарных"]);
  return `${count} ${adjective} ${plural(count, ["день", "дня", "дней"])}`;
};

/** Сегодня в локальном времени как YYYY-MM-DD */
export const todayISO = (): ISODate => toISODate(new Date());
