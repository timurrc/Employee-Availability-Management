import { differenceInCalendarDays } from "date-fns";
import { isPlannedAbsence, sickLeaveVacationOverlaps, vacationDuration } from "@/core/absence";
import type { ISickVacationOverlap } from "@/core/absence";
import { resolveDeputy, type IDeputyResolution } from "@/core/availability";
import { type CalendarIndex, fromISODate, shiftISODate } from "@/core/calendar";
import { vacationEndFor } from "@/core/absence";
import { overlapPeriod, periodEnd, periodsOverlap } from "@/core/period";
import type { IAbsence, IDelegation } from "@/types/absence.types";
import type { IClosedPeriod, IPeriod, ISODate } from "@/types/common.types";
import type { IApprovalStep, IDocument } from "@/types/document.types";
import type { IDepartment, IEmployee } from "@/types/employee.types";
import { matchesQuery } from "./text";

/** Насколько вперёд смотреть на отпуска, когда больничный открыт без даты окончания */
export const SICK_LOOKAHEAD_DAYS = 14;
/** Больничный можно открыть заранее максимум на столько дней (дальше — скорее ошибка ввода) */
export const SICK_MAX_FUTURE_DAYS = 3;
/** «Закрытые за 30 дн.» */
export const SICK_CLOSED_WINDOW_DAYS = 30;

export type SickTab = "open" | "closed" | "all";

export const SICK_TABS: { value: SickTab; label: string }[] = [
  { value: "open", label: "Открытые" },
  { value: "closed", label: `Закрытые за ${SICK_CLOSED_WINDOW_DAYS} дн.` },
  { value: "all", label: "Все" },
];

export const isSickTab = (value: string | null): value is SickTab =>
  SICK_TABS.some((tab) => tab.value === value);

/** «910123456789» → «9101 2345 6789» */
export const formatEln = (number: string) => number.replace(/(\d{4})(?=\d)/g, "$1 ");

/** Календарных дней в закрытом периоде включительно */
export const calendarDays = ({ start, end }: IClosedPeriod) =>
  differenceInCalendarDays(fromISODate(end), fromISODate(start)) + 1;

export interface ISickOverlapView extends ISickVacationOverlap {
  /** Сколько дней пересечения уже точно есть (для открытого — по сегодня) */
  minDays: number;
  /** Дней, на которые отпуск уже продлён из-за этого больничного */
  alreadyExtended: number;
  /** Сколько ещё продлить: daysToMove − alreadyExtended */
  remaining: number;
  /** Новое окончание отпуска, если продлить на remaining (только для закрытого периода) */
  extendedEnd: ISODate | null;
}

/** Отпуск продлевается на N дней со дня после окончания; праздники внутри продлевают ещё (ст. 120) */
export const extendedVacationEnd = (calendar: CalendarIndex, vacation: IAbsence, days: number) =>
  vacationEndFor(calendar, shiftISODate(periodEnd(vacation.period), 1), days);

/**
 * Пересечения больничного с отпусками в виде для HR. Отпуск, уже продлённый из-за этого
 * больничного (IAbsence.extension), продлевается только на недостающие дни.
 */
const overlapViews = (
  calendar: CalendarIndex,
  sick: IAbsence,
  absences: IAbsence[],
  today: ISODate,
): ISickOverlapView[] =>
  sickLeaveVacationOverlaps(calendar, sick, absences).map((item) => {
    const known = item.isOpen
      ? overlapPeriod({ start: sick.period.start, end: today }, item.vacation.period)
      : item.overlap;
    const minDays = known
      ? vacationDuration(calendar, { start: known.start, end: periodEnd(known) }).chargeableDays
      : 0;
    const extension = item.vacation.extension;
    const alreadyExtended = extension?.sickLeaveId === sick.id ? extension.days : 0;
    const remaining = Math.max(0, item.daysToMove - alreadyExtended);
    return {
      ...item,
      minDays,
      alreadyExtended,
      remaining,
      extendedEnd:
        item.isOpen || remaining < 1
          ? null
          : extendedVacationEnd(calendar, item.vacation, remaining),
    };
  });

/** Пересечения, по которым HR ещё не принял решение (отпуск не продлён на все дни) */
export const unresolvedOverlaps = (
  calendar: CalendarIndex,
  sick: IAbsence,
  absences: IAbsence[],
  today: ISODate,
): ISickOverlapView[] =>
  overlapViews(calendar, sick, absences, today).filter((item) => item.isOpen || item.remaining > 0);

export interface ISickRow {
  leave: IAbsence;
  employee: IEmployee;
  department?: IDepartment;
  /** «6-й день» — для открытых и продлённых, считая день начала */
  dayNumber: number | null;
  overlaps: ISickOverlapView[];
  deputy: IDeputyResolution;
  /** Некому передать документы — danger в строке */
  noDeputy: boolean;
}

interface ISickContext {
  calendar: CalendarIndex;
  employees: IEmployee[];
  departments: IDepartment[];
  absences: IAbsence[];
  delegations?: IDelegation[];
  today: ISODate;
}

const isOpenLeave = (leave: IAbsence) => leave.status !== "closed";

/**
 * Строки списка больничных. Сортировка по дизайну: нерешённые пересечения →
 * без замещающего → открытые давнее сверху → закрытые свежие сверху.
 */
export const sickRows = ({
  calendar,
  employees,
  departments,
  absences,
  delegations,
  today,
}: ISickContext): ISickRow[] => {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const rows = absences
    .filter((a) => a.type === "sick")
    .flatMap((leave): ISickRow[] => {
      const employee = byId.get(leave.employeeId);
      if (!employee) return [];
      const open = isOpenLeave(leave);
      // Замещающий — на сегодня, а если больничный ещё не начался — на его первый день
      const date = leave.period.start > today ? leave.period.start : today;
      const deputy = resolveDeputy(leave.employeeId, date, { employees, absences, delegations });
      return [
        {
          leave,
          employee,
          department: departments.find((d) => d.id === employee.departmentId),
          dayNumber:
            open && leave.period.start <= today
              ? calendarDays({ start: leave.period.start, end: today })
              : null,
          overlaps: unresolvedOverlaps(calendar, leave, absences, today),
          deputy,
          noDeputy: open && (deputy.status === "no_deputy" || deputy.status === "cycle"),
        },
      ];
    });

  const rank = (row: ISickRow) =>
    row.overlaps.length > 0 ? 0 : row.noDeputy ? 1 : isOpenLeave(row.leave) ? 2 : 3;
  return rows.sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    // Открытые — давние сверху, закрытые — свежие сверху
    return rank(a) < 3
      ? a.leave.period.start.localeCompare(b.leave.period.start)
      : periodEnd(b.leave.period).localeCompare(periodEnd(a.leave.period));
  });
};

export interface ISickFilter {
  tab: SickTab;
  query: string;
  departmentId: string;
}

export const filterSickRows = (rows: ISickRow[], filter: ISickFilter, today: ISODate) => {
  const since = shiftISODate(today, -SICK_CLOSED_WINDOW_DAYS);
  return rows.filter((row) => {
    if (filter.tab === "open" && !isOpenLeave(row.leave)) return false;
    if (filter.tab === "closed") {
      if (isOpenLeave(row.leave) || periodEnd(row.leave.period) < since) return false;
    }
    if (filter.departmentId && row.employee.departmentId !== filter.departmentId) return false;
    return matchesQuery(row.employee.fullName, filter.query);
  });
};

/** Сколько больничных с нерешёнными пересечениями — для плашки и счётчика */
export const overlapCount = (rows: ISickRow[]) => rows.filter((r) => r.overlaps.length > 0).length;

export interface IStepOnEmployee {
  document: IDocument;
  step: IApprovalStep;
}

export interface ISickImpact {
  /** Согласованные отпуска в периоде; у открытого — начинающиеся в ближайшие 14 дней */
  vacations: IAbsence[];
  /** Этапы документов, которые ждут сотрудника */
  steps: IStepOnEmployee[];
  /** Постоянный заместитель; undefined — не назначен */
  deputy?: IEmployee;
}

/** «Что это задевает» в форме открытия больничного */
export const sickImpact = (
  {
    employeeId,
    period,
  }: {
    employeeId: string;
    period: IPeriod;
  },
  {
    employees,
    absences,
    documents,
  }: { employees: IEmployee[]; absences: IAbsence[]; documents: IDocument[] },
): ISickImpact => {
  const window: IPeriod =
    period.end === null
      ? { start: period.start, end: shiftISODate(period.start, SICK_LOOKAHEAD_DAYS) }
      : period;
  const employee = employees.find((e) => e.id === employeeId);
  return {
    vacations: absences.filter(
      (a) =>
        a.employeeId === employeeId &&
        a.type === "vacation" &&
        a.status === "approved" &&
        periodsOverlap(a.period, window),
    ),
    steps: documents.flatMap((document) =>
      document.steps
        .filter(
          (step) =>
            (step.status === "waiting" || step.status === "in_progress") &&
            (step.delegatedToId ?? step.approverId) === employeeId,
        )
        .map((step) => ({ document, step })),
    ),
    deputy: employee?.deputyId ? employees.find((e) => e.id === employee.deputyId) : undefined,
  };
};

export interface ISickIssue {
  field: "start" | "end";
  message: string;
}

/**
 * Проверки формы с данными: начало слишком далеко в будущем и пересечение
 * с другим больничным того же сотрудника (его нужно продлить, а не открывать новый).
 */
export const sickLeaveIssues = (
  { employeeId, period }: { employeeId: string; period: IPeriod },
  absences: IAbsence[],
  today: ISODate,
  formatDate: (date: ISODate) => string,
): ISickIssue[] => {
  const issues: ISickIssue[] = [];
  if (period.start > shiftISODate(today, SICK_MAX_FUTURE_DAYS)) {
    issues.push({
      field: "start",
      message: `Начало позже чем через ${SICK_MAX_FUTURE_DAYS} дня — проверьте дату`,
    });
  }
  const clash = absences.find(
    (a) =>
      a.employeeId === employeeId &&
      a.type === "sick" &&
      isOpenLeave(a) &&
      isPlannedAbsence(a) &&
      periodsOverlap(a.period, period),
  );
  if (clash) {
    issues.push({
      field: "start",
      message: `Уже открыт больничный с ${formatDate(clash.period.start)} — продлите его`,
    });
  }
  return issues;
};

/**
 * Пересечения, которые появятся при закрытии больничного датой `end`: на сколько дней
 * ещё продлить каждый отпуск. Для чекбоксов в диалоге «Закрыть».
 */
export const overlapsOnClose = (
  calendar: CalendarIndex,
  leave: IAbsence,
  absences: IAbsence[],
  end: ISODate,
) =>
  overlapViews(calendar, { ...leave, period: { start: leave.period.start, end } }, absences, end)
    .filter((item) => item.remaining > 0)
    .map((item) => ({ ...item, extendedEnd: item.extendedEnd! }));
