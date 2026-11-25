import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfQuarter,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale/ru";
import { isActiveAbsence } from "@/core/absence";
import { departmentCoverage } from "@/core/availability";
import {
  type CalendarIndex,
  eachISODate,
  fromISODate,
  getDay,
  shiftISODate,
  toISODate,
} from "@/core/calendar";
import { overlapPeriod, periodEnd } from "@/core/period";
import type { IAbsence } from "@/types/absence.types";
import type { ICalendarDay } from "@/types/calendar.types";
import type { IClosedPeriod, ISODate } from "@/types/common.types";
import type { IDepartment, IEmployee } from "@/types/employee.types";
import { formatPeriod } from "./date";

export type TimelineScale = "2w" | "month" | "quarter";

export const TIMELINE_SCALES: Record<TimelineScale, { label: string; columnPx: number }> = {
  "2w": { label: "2 нед", columnPx: 56 },
  month: { label: "Месяц", columnPx: 32 },
  quarter: { label: "Квартал", columnPx: 12 },
};

export const isTimelineScale = (value: string | null): value is TimelineScale =>
  value !== null && value in TIMELINE_SCALES;

/** Открытый больничный рисуем до «сегодня + 3 дня» и растворяем — дату выхода не выдумываем */
export const OPEN_SICK_TAIL_DAYS = 3;

/** Период сетки, в который попадает дата: неделя с понедельника ×2, месяц или квартал */
export const timelinePeriod = (scale: TimelineScale, anchor: ISODate): IClosedPeriod => {
  const date = fromISODate(anchor);
  if (scale === "2w") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return { start: toISODate(start), end: shiftISODate(toISODate(start), 13) };
  }
  if (scale === "month") {
    return { start: toISODate(startOfMonth(date)), end: toISODate(endOfMonth(date)) };
  }
  return { start: toISODate(startOfQuarter(date)), end: toISODate(endOfQuarter(date)) };
};

/** Начало соседнего периода: ‹ и › */
export const shiftTimeline = (scale: TimelineScale, start: ISODate, step: 1 | -1): ISODate => {
  const date = fromISODate(start);
  if (scale === "2w") return toISODate(addWeeks(date, 2 * step));
  return toISODate(addMonths(date, (scale === "month" ? 1 : 3) * step));
};

const ROMAN = ["I", "II", "III", "IV"];

/** «Декабрь 2026», «7–20 дек.», «IV кв. 2026» */
export const timelineTitle = (scale: TimelineScale, period: IClosedPeriod, today: ISODate) => {
  const start = fromISODate(period.start);
  if (scale === "month") {
    const month = format(start, "LLLL yyyy", { locale: ru });
    return month[0]!.toUpperCase() + month.slice(1);
  }
  if (scale === "quarter") {
    return `${ROMAN[Math.floor(start.getMonth() / 3)]} кв. ${start.getFullYear()}`;
  }
  return formatPeriod(period, today);
};

export interface ITimelineColumn {
  day: ICalendarDay;
  /** Дня нет в загруженном производственном календаре — раскраска по сб/вс */
  isGuess: boolean;
}

export const timelineColumns = (calendar: CalendarIndex, period: IClosedPeriod) =>
  eachISODate(period.start, period.end).map<ITimelineColumn>((date) => ({
    day: getDay(calendar, date),
    isGuess: !calendar.has(date),
  }));

/** Видно в сетке: действующие и на согласовании; черновики — только автору. Отклонённые — нет. */
export const isVisibleOnTimeline = (absence: IAbsence, viewerId?: string) =>
  isActiveAbsence(absence) ||
  absence.status === "pending" ||
  (absence.status === "draft" && absence.employeeId === viewerId);

export interface ITimelineBar {
  absence: IAbsence;
  /** Первая колонка (с 0) и число колонок */
  column: number;
  span: number;
  /** Отсутствие началось раньше / кончается позже видимого периода */
  cutStart: boolean;
  cutEnd: boolean;
  /** Открытый больничный: хвост растворяется, на конце «?» */
  isOpen: boolean;
  isPending: boolean;
}

/** Полосы отсутствий сотрудника, обрезанные по периоду */
export const timelineBars = (
  absences: IAbsence[],
  period: IClosedPeriod,
  today: ISODate,
): ITimelineBar[] =>
  absences.flatMap((absence) => {
    const isOpen = absence.period.end === null;
    const end = isOpen
      ? [absence.period.start, shiftISODate(today, OPEN_SICK_TAIL_DAYS)].sort().at(-1)!
      : periodEnd(absence.period);
    const visible = overlapPeriod({ start: absence.period.start, end }, period);
    if (!visible) return [];
    const visibleEnd = periodEnd(visible);
    const column = eachISODate(period.start, visible.start).length - 1;
    return [
      {
        absence,
        column,
        span: eachISODate(visible.start, visibleEnd).length,
        cutStart: absence.period.start < period.start,
        cutEnd: end > period.end,
        isOpen,
        isPending: absence.status === "pending" || absence.status === "draft",
      },
    ];
  });

export interface IDayCoverage {
  date: ISODate;
  available: number;
  total: number;
  percent: number;
  threshold: number;
  isBelow: boolean;
}

/** Покрытие подразделения по рабочим дням периода; в нерабочие — null (столбика нет) */
export const timelineCoverage = (
  columns: ITimelineColumn[],
  department: IDepartment,
  employees: IEmployee[],
  absences: IAbsence[],
): (IDayCoverage | null)[] =>
  columns.map(({ day }) => {
    if (day.kind !== "workday") return null;
    const coverage = departmentCoverage(department, employees, absences, day.date);
    return {
      date: day.date,
      available: coverage.available,
      total: coverage.total,
      percent: coverage.percent,
      threshold: coverage.threshold,
      isBelow: coverage.isBelowThreshold,
    };
  });

/** Склеивает даты ниже порога в отрезки подряд идущих рабочих дней: «21–23 дек.» */
export const belowThresholdRanges = (coverage: (IDayCoverage | null)[]): IClosedPeriod[] => {
  const ranges: IClosedPeriod[] = [];
  let current: IClosedPeriod | null = null;
  for (const day of coverage) {
    if (day === null) continue; // выходные не разрывают отрезок
    if (day.isBelow) {
      if (current) current.end = day.date;
      else current = { start: day.date, end: day.date };
    } else if (current) {
      ranges.push(current);
      current = null;
    }
  }
  if (current) ranges.push(current);
  return ranges;
};

export interface ITimelineGroup {
  department: IDepartment;
  employees: IEmployee[];
}

/** Группы по подразделениям: руководитель отдела первым, дальше по алфавиту */
export const timelineGroups = (
  departments: IDepartment[],
  employees: IEmployee[],
): ITimelineGroup[] =>
  departments
    .map((department) => ({
      department,
      employees: employees
        .filter((e) => e.departmentId === department.id)
        .sort(
          (a, b) =>
            Number(b.id === department.headId) - Number(a.id === department.headId) ||
            a.fullName.localeCompare(b.fullName, "ru"),
        ),
    }))
    .filter((group) => group.employees.length > 0);

const MONTHS_IN = [
  "январе",
  "феврале",
  "марте",
  "апреле",
  "мае",
  "июне",
  "июле",
  "августе",
  "сентябре",
  "октябре",
  "ноябре",
  "декабре",
];

/** «В декабре», «В IV кв. 2026», «7–20 дек.» — для «… никто не отсутствует» */
export const periodPhrase = (scale: TimelineScale, period: IClosedPeriod, today: ISODate) => {
  const start = fromISODate(period.start);
  if (scale === "month") {
    const year =
      start.getFullYear() === fromISODate(today).getFullYear() ? "" : ` ${start.getFullYear()}`;
    return `В ${MONTHS_IN[start.getMonth()]}${year}`;
  }
  if (scale === "quarter") return `В ${timelineTitle(scale, period, today)}`;
  return formatPeriod(period, today);
};
