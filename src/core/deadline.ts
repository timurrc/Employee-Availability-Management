import type { IAbsence } from "@/types/absence.types";
import type { ICalendarDay } from "@/types/calendar.types";
import type { ISODate } from "@/types/common.types";
import type { IDocument } from "@/types/document.types";
import { isActiveAbsence } from "./absence";
import {
  type IDeputyContext,
  type IDeputyResolution,
  absenceOn,
  availableFrom,
  resolveDeputy,
} from "./availability";
import {
  type CalendarIndex,
  addWorkingDays,
  shiftISODate,
  specialDaysOffBetween,
} from "./calendar";
import { periodsOverlap } from "./period";

export interface IDayRange {
  start: ISODate;
  end: ISODate;
  days: ICalendarDay[];
}

/** Склеивает идущие подряд дни в диапазоны: 4, 5, 9 нояб. → [4–5], [9] */
export const groupConsecutiveDays = (days: ICalendarDay[]): IDayRange[] =>
  days.reduce<IDayRange[]>((ranges, day) => {
    const last = ranges.at(-1);
    if (last && shiftISODate(last.end, 1) === day.date) {
      last.end = day.date;
      last.days.push(day);
    } else {
      ranges.push({ start: day.date, end: day.date, days: [day] });
    }
    return ranges;
  }, []);

/**
 * none — согласующий на месте весь срок;
 * delegated — согласующий отсутствует, этап ведёт заместитель;
 * absent_in_window — на старте на месте, но уйдёт до окончания срока;
 * no_deputy — отсутствует и замещать некому (или цикл замещений);
 * waiting — отсутствует, но инициатор решил ждать его выхода («Оставить»).
 */
export type DeadlineRisk = "none" | "delegated" | "absent_in_window" | "no_deputy" | "waiting";

export interface IStepDeadline {
  start: ISODate;
  due: ISODate;
  durationDays: number;
  /** Праздники и перенесённые выходные внутри срока — объяснение «+N дней» */
  extraDaysOff: IDayRange[];
  approverId: string;
  /** Кто фактически согласует на дату старта */
  resolution: IDeputyResolution;
  risk: DeadlineRisk;
  /** Отсутствие согласующего, из-за которого есть риск */
  absence: IAbsence | null;
  /**
   * Для no_deputy: срок, если ждать возвращения согласующего (день выхода — первый день
   * срока). null — дата выхода неизвестна (открытый больничный) или риска нет.
   */
  dueIfWaiting: ISODate | null;
}

/**
 * Срок этапа согласования в рабочих днях по производственному календарю.
 * День старта не считается: этап на 3 дня, начатый в пятницу, — до среды.
 */
export const stepDeadline = (
  calendar: CalendarIndex,
  step: { approverId: string; durationDays: number; start: ISODate; waitForReturn?: boolean },
  context: IDeputyContext,
): IStepDeadline => {
  const { approverId, durationDays, start } = step;

  // «Оставить»: этап остаётся на отсутствующем, срок идёт от дня его выхода
  const awayAtStart = step.waitForReturn ? absenceOn(context.absences, approverId, start) : null;
  if (awayAtStart) {
    const returns = availableFrom(calendar, approverId, start, context.absences);
    const waitingDue =
      returns === null ? null : addWorkingDays(calendar, returns, Math.max(durationDays - 1, 0));
    const due = waitingDue ?? addWorkingDays(calendar, start, durationDays);
    return {
      start,
      due,
      durationDays,
      extraDaysOff: groupConsecutiveDays(specialDaysOffBetween(calendar, start, due)),
      approverId,
      resolution: { status: "self", actorId: approverId, chain: [approverId] },
      risk: "waiting",
      absence: awayAtStart,
      dueIfWaiting: waitingDue,
    };
  }

  const due = addWorkingDays(calendar, start, durationDays);
  const resolution = resolveDeputy(approverId, start, context);
  const base = {
    start,
    due,
    durationDays,
    extraDaysOff: groupConsecutiveDays(specialDaysOffBetween(calendar, start, due)),
    approverId,
    resolution,
  };

  if (resolution.status === "deputy") {
    return {
      ...base,
      risk: "delegated",
      absence: absenceOn(context.absences, approverId, start),
      dueIfWaiting: null,
    };
  }

  if (resolution.status === "no_deputy" || resolution.status === "cycle") {
    const returns = availableFrom(calendar, approverId, start, context.absences);
    return {
      ...base,
      risk: "no_deputy",
      absence: absenceOn(context.absences, approverId, start),
      dueIfWaiting:
        returns === null ? null : addWorkingDays(calendar, returns, Math.max(durationDays - 1, 0)),
    };
  }

  const window = { start: shiftISODate(start, 1), end: due };
  const upcoming =
    context.absences.find(
      (a) => a.employeeId === approverId && isActiveAbsence(a) && periodsOverlap(a.period, window),
    ) ?? null;
  return {
    ...base,
    risk: upcoming ? "absent_in_window" : "none",
    absence: upcoming,
    dueIfWaiting: null,
  };
};

export interface IRouteStepDeadline extends IStepDeadline {
  stepId: string;
}

/**
 * Сроки всех этапов маршрута: каждый следующий этап стартует с даты решения
 * предыдущего, а если решения ещё нет — с его планового срока (или срока
 * «после возвращения», если замещать некому).
 */
export const routeDeadlines = (
  calendar: CalendarIndex,
  document: IDocument,
  context: Omit<IDeputyContext, "documentType">,
): IRouteStepDeadline[] => {
  if (!document.routeStartedAt) return [];
  const result: IRouteStepDeadline[] = [];
  let start = document.routeStartedAt;
  for (const step of document.steps) {
    const deadline = stepDeadline(
      calendar,
      {
        approverId: step.delegatedToId ?? step.approverId,
        durationDays: step.durationDays,
        start,
        waitForReturn: !step.delegatedToId && step.waitForReturn,
      },
      { ...context, documentType: document.type },
    );
    result.push({ stepId: step.id, ...deadline });
    start = step.decidedAt ?? deadline.dueIfWaiting ?? deadline.due;
  }
  return result;
};
