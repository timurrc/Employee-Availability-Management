import { addDays, addMonths, differenceInCalendarDays, differenceInMonths } from "date-fns";
import type { AbsenceStatus, IAbsence } from "@/types/absence.types";
import type { ICalendarDay } from "@/types/calendar.types";
import type { IClosedPeriod, ISODate } from "@/types/common.types";
import { type CalendarIndex, eachISODate, fromISODate, getDay, shiftISODate } from "./calendar";
import { isClosedPeriod, overlapPeriod, periodEnd, periodsOverlap } from "./period";

/** Ежегодный основной оплачиваемый отпуск, ст. 115 ТК РФ */
export const ANNUAL_VACATION_DAYS = 28;
/** Хотя бы одна часть отпуска — не меньше 14 дней, ст. 125 ТК РФ */
export const MIN_VACATION_PART = 14;

/** Отсутствие, которое действительно происходит (согласовано или зарегистрировано HR) */
const ACTIVE_STATUSES: AbsenceStatus[] = ["approved", "open", "extended", "closed"];
/** Плюс заявки на согласовании — с ними нельзя пересекаться и их нужно учитывать в балансе */
const PLANNED_STATUSES: AbsenceStatus[] = [...ACTIVE_STATUSES, "pending"];

export const isActiveAbsence = (absence: IAbsence): boolean =>
  ACTIVE_STATUSES.includes(absence.status);

export const isPlannedAbsence = (absence: IAbsence): boolean =>
  PLANNED_STATUSES.includes(absence.status);

export interface IVacationDuration {
  calendarDays: number;
  /** Нерабочие праздничные дни внутри периода — в отпуск не входят (ст. 120) */
  holidays: ICalendarDay[];
  /** Дни, которые списываются с баланса */
  chargeableDays: number;
}

/**
 * Длительность отпуска в календарных днях. Выходные входят, праздники по ст. 112 — нет.
 * Перенесённые выходные (например, 31.12.2026) праздниками не считаются и входят.
 */
export const vacationDuration = (
  calendar: CalendarIndex,
  period: IClosedPeriod,
): IVacationDuration => {
  const days = eachISODate(period.start, period.end).map((date) => getDay(calendar, date));
  const holidays = days.filter((day) => day.kind === "holiday");
  return {
    calendarDays: days.length,
    holidays,
    chargeableDays: days.length - holidays.length,
  };
};

/** Дата окончания отпуска на N дней: праздники внутри продлевают его (ст. 120) */
export const vacationEndFor = (calendar: CalendarIndex, start: ISODate, days: number): ISODate => {
  if (days < 1) throw new Error("Отпуск — минимум 1 день");
  let date = shiftISODate(start, -1);
  let left = days;
  while (left > 0) {
    date = shiftISODate(date, 1);
    if (getDay(calendar, date).kind !== "holiday") left -= 1;
  }
  return date;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Начисленный отпуск: 28/12 ≈ 2,33 дня за каждый отработанный месяц.
 * Остаток меньше половины месяца отбрасывается, половина и больше — до полного месяца
 * (п. 35 Правил об очередных и дополнительных отпусках).
 */
export const accruedVacationDays = (
  workStart: ISODate,
  onDate: ISODate,
  annual = ANNUAL_VACATION_DAYS,
): number => {
  if (onDate < workStart) return 0;
  const start = fromISODate(workStart);
  const endExclusive = addDays(fromISODate(onDate), 1);
  const fullMonths = differenceInMonths(endExclusive, start);
  const restDays = differenceInCalendarDays(endExclusive, addMonths(start, fullMonths));
  const months = fullMonths + (restDays >= 15 ? 1 : 0);
  return round2((months * annual) / 12);
};

const isCountedVacation = (absence: IAbsence) =>
  absence.type === "vacation" && (absence.status === "approved" || absence.status === "pending");

/** Списанные дни ежегодного отпуска: согласованные и на согласовании */
export const usedVacationDays = (
  calendar: CalendarIndex,
  absences: IAbsence[],
  employeeId: string,
  excludeId?: string,
): number =>
  absences
    .filter((a) => a.employeeId === employeeId && a.id !== excludeId && isCountedVacation(a))
    .filter((a) => isClosedPeriod(a.period))
    .reduce(
      (sum, a) => sum + vacationDuration(calendar, a.period as IClosedPeriod).chargeableDays,
      0,
    );

export interface IVacationBalance {
  accrued: number;
  used: number;
  available: number;
}

export const vacationBalance = (
  calendar: CalendarIndex,
  params: {
    employeeId: string;
    workStart: ISODate;
    onDate: ISODate;
    absences: IAbsence[];
    annual?: number;
    excludeId?: string;
  },
): IVacationBalance => {
  const accrued = accruedVacationDays(params.workStart, params.onDate, params.annual);
  const used = usedVacationDays(calendar, params.absences, params.employeeId, params.excludeId);
  return { accrued, used, available: round2(accrued - used) };
};

export type VacationIssueCode =
  "invalid_period" | "in_past" | "overlap" | "insufficient_balance" | "no_long_part";

export interface IVacationIssue {
  code: VacationIssueCode;
  level: "error" | "warning";
  message: string;
  /** Пересекающееся отсутствие — для кода overlap */
  absenceId?: string;
}

export interface IVacationValidation {
  duration: IVacationDuration | null;
  issues: IVacationIssue[];
  /** Можно отправлять: нет ошибок (предупреждения не мешают) */
  isValid: boolean;
}

/**
 * Проверка заявки на ежегодный отпуск. Ошибки блокируют отправку,
 * предупреждения — только показываются (часть ≥ 14 дней, нехватка баланса).
 */
export const validateVacationRequest = (
  calendar: CalendarIndex,
  request: { id?: string; employeeId: string; period: IClosedPeriod },
  context: { today: ISODate; absences: IAbsence[]; availableDays: number },
): IVacationValidation => {
  const { period } = request;
  if (period.end < period.start) {
    return {
      duration: null,
      issues: [
        {
          code: "invalid_period",
          level: "error",
          message: "Дата окончания раньше даты начала",
        },
      ],
      isValid: false,
    };
  }

  const issues: IVacationIssue[] = [];
  const duration = vacationDuration(calendar, period);
  const own = context.absences.filter(
    (a) => a.employeeId === request.employeeId && a.id !== request.id,
  );

  if (period.start < context.today) {
    issues.push({
      code: "in_past",
      level: "error",
      message: "Отпуск не может начинаться в прошлом",
    });
  }

  for (const absence of own) {
    if (isPlannedAbsence(absence) && periodsOverlap(absence.period, period)) {
      issues.push({
        code: "overlap",
        level: "error",
        message: "Пересекается с другим отсутствием",
        absenceId: absence.id,
      });
    }
  }

  if (duration.chargeableDays > context.availableDays) {
    issues.push({
      code: "insufficient_balance",
      level: "warning",
      message: `Доступно ${context.availableDays} дн., запрошено ${duration.chargeableDays}`,
    });
  }

  const year = period.start.slice(0, 4);
  const hasLongPart = own.some(
    (a) =>
      isCountedVacation(a) &&
      a.period.start.startsWith(year) &&
      isClosedPeriod(a.period) &&
      vacationDuration(calendar, a.period).chargeableDays >= MIN_VACATION_PART,
  );
  const leftAfter = context.availableDays - duration.chargeableDays;
  if (
    duration.chargeableDays < MIN_VACATION_PART &&
    !hasLongPart &&
    leftAfter < MIN_VACATION_PART
  ) {
    issues.push({
      code: "no_long_part",
      level: "warning",
      message: `Одна из частей отпуска должна быть не меньше ${MIN_VACATION_PART} дней (ст. 125 ТК РФ)`,
    });
  }

  return { duration, issues, isValid: issues.every((issue) => issue.level !== "error") };
};

export interface ISickVacationOverlap {
  vacation: IAbsence;
  /** Общий отрезок больничного и отпуска */
  overlap: IClosedPeriod;
  /** Дней отпуска, которые нужно продлить или перенести (без праздников) */
  daysToMove: number;
  /** Больничный ещё открыт — число дней может вырасти */
  isOpen: boolean;
}

/**
 * Больничный во время отпуска продлевает или переносит отпуск (ст. 124 ТК РФ) —
 * подсказка для HR: какие отпуска затронуты и на сколько дней.
 */
export const sickLeaveVacationOverlaps = (
  calendar: CalendarIndex,
  sick: IAbsence,
  absences: IAbsence[],
): ISickVacationOverlap[] =>
  absences
    .filter(
      (a) =>
        a.employeeId === sick.employeeId &&
        a.type === "vacation" &&
        a.status === "approved" &&
        isClosedPeriod(a.period),
    )
    .flatMap((vacation) => {
      const common = overlapPeriod(sick.period, vacation.period);
      if (!common) return [];
      const overlap = { start: common.start, end: periodEnd(common) };
      return [
        {
          vacation,
          overlap,
          daysToMove: vacationDuration(calendar, overlap).chargeableDays,
          isOpen: sick.period.end === null,
        },
      ];
    });
