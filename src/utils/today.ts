import { isActiveAbsence } from "@/core/absence";
import {
  availableFrom,
  departmentCoverage,
  resolveDeputy,
  type ICoverage,
} from "@/core/availability";
import {
  type CalendarIndex,
  eachISODate,
  getDay,
  isWorkingDay,
  shiftISODate,
} from "@/core/calendar";
import { groupConsecutiveDays, routeDeadlines } from "@/core/deadline";
import { containsDate } from "@/core/period";
import { ABSENCE_META } from "@/constants/absence";
import type { IAbsence } from "@/types/absence.types";
import type { IPersonStatus } from "@/types/availability.types";
import type { ISODate } from "@/types/common.types";
import type { IDocument } from "@/types/document.types";
import type { IDepartment, IEmployee, Role } from "@/types/employee.types";
import { shortName } from "./availability";
import { formatDay, formatPeriod, plural } from "./date";
import { unresolvedOverlaps } from "./sickLeave";

type StatusOf = (employeeId: string, date: ISODate) => IPersonStatus;

export interface IAbsentRow {
  employee: IEmployee;
  status: IPersonStatus;
  absence: IAbsence;
  /** Первый рабочий день на месте; null — неизвестно (открытый больничный) */
  returnsOn: ISODate | null;
  noDeputy: boolean;
}

const isNoDeputy = (status: IPersonStatus) =>
  status.deputy.status === "no_deputy" || status.deputy.status === "cycle";

/**
 * Кто отсутствует на дату. «Нет замещающего» — сверху (это риск), дальше — кто раньше
 * выйдет; открытые больничные (дата выхода неизвестна) — в конце своей группы.
 */
export const absentRows = (
  employees: IEmployee[],
  statusOf: StatusOf,
  calendar: CalendarIndex,
  absences: IAbsence[],
  date: ISODate,
): IAbsentRow[] =>
  employees
    .flatMap((employee) => {
      const status = statusOf(employee.id, date);
      const { absence } = status.availability;
      if (!absence) return [];
      return [
        {
          employee,
          status,
          absence,
          returnsOn: availableFrom(calendar, employee.id, date, absences),
          noDeputy: isNoDeputy(status),
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.noDeputy) - Number(a.noDeputy) ||
        (a.returnsOn ?? "9999").localeCompare(b.returnsOn ?? "9999") ||
        a.employee.fullName.localeCompare(b.employee.fullName, "ru"),
    );

export interface ISoonRow {
  employee: IEmployee;
  absence: IAbsence;
}

/** Ближайшее действующее отсутствие, которое начнётся после даты */
const firstAfter = (absences: IAbsence[], date: ISODate, until?: ISODate) =>
  absences
    .filter(
      (a) => isActiveAbsence(a) && a.period.start > date && (!until || a.period.start <= until),
    )
    .sort((a, b) => a.period.start.localeCompare(b.period.start))[0];

/** Кто уйдёт в ближайшие `days` дней (сегодня он на месте) — по дате начала */
export const soonRows = (
  employees: IEmployee[],
  absences: IAbsence[],
  date: ISODate,
  days = 7,
): ISoonRow[] => {
  const until = shiftISODate(date, days);
  return employees
    .flatMap((employee) => {
      const own = absences.filter((a) => a.employeeId === employee.id);
      if (own.some((a) => isActiveAbsence(a) && containsDate(a.period, date))) return [];
      const absence = firstAfter(own, date, until);
      return absence ? [{ employee, absence }] : [];
    })
    .sort((a, b) => a.absence.period.start.localeCompare(b.absence.period.start));
};

/** Ближайшее отсутствие среди людей — для пустого состояния «Все на месте» */
export const nextAbsence = (absences: IAbsence[], employeeIds: Set<string>, date: ISODate) =>
  firstAfter(
    absences.filter((a) => employeeIds.has(a.employeeId)),
    date,
  ) ?? null;

export interface ICoverageRow {
  department: IDepartment;
  coverage: ICoverage;
}

/** Покрытие подразделений на дату: ниже порога и ближе к нему — сверху */
export const coverageRows = (
  departments: IDepartment[],
  employees: IEmployee[],
  absences: IAbsence[],
  date: ISODate,
): ICoverageRow[] =>
  departments
    .map((department) => ({
      department,
      coverage: departmentCoverage(department, employees, absences, date),
    }))
    .sort(
      (a, b) =>
        a.coverage.percent - a.coverage.threshold - (b.coverage.percent - b.coverage.threshold) ||
        a.department.name.localeCompare(b.department.name, "ru"),
    );

/** Дни, когда покрытие подразделения ниже порога, — в ближайшие `days` дней */
export const coverageRiskDays = (
  calendar: CalendarIndex,
  department: IDepartment,
  employees: IEmployee[],
  absences: IAbsence[],
  date: ISODate,
  days = 14,
): ISODate[] =>
  eachISODate(date, shiftISODate(date, days - 1)).filter(
    (day) =>
      isWorkingDay(calendar, day) &&
      departmentCoverage(department, employees, absences, day).isBelowThreshold,
  );

export type UpcomingEventKind = "deadline" | "absence" | "holiday" | "shortened";

export interface IUpcomingEvent {
  id: string;
  date: ISODate;
  kind: UpcomingEventKind;
  title: string;
  /** Отсутствие — для иконки и цвета типа */
  absence?: IAbsence;
  documentId?: string;
}

interface IEventsContext {
  userId: string;
  calendar: CalendarIndex;
  employees: IEmployee[];
  absences: IAbsence[];
  documents: IDocument[];
  today: ISODate;
  days?: number;
}

/**
 * Мои ближайшие события: сроки моих этапов согласования, мои отсутствия
 * (согласованные и на согласовании), нерабочие и сокращённые дни.
 */
export const upcomingEvents = ({
  userId,
  calendar,
  employees,
  absences,
  documents,
  today,
  days = 30,
}: IEventsContext): IUpcomingEvent[] => {
  const window = { start: today, end: shiftISODate(today, days) };
  const events: IUpcomingEvent[] = [];

  for (const document of documents) {
    const deadlines = routeDeadlines(calendar, document, { employees, absences });
    document.steps.forEach((step, index) => {
      const deadline = deadlines[index];
      const mine = (step.delegatedToId ?? step.approverId) === userId;
      const open = step.status === "waiting" || step.status === "in_progress";
      if (!deadline || !mine || !open || !containsDate(window, deadline.due)) return;
      events.push({
        id: `deadline-${document.id}-${step.id}`,
        date: deadline.due,
        kind: "deadline",
        title: `Этап «${document.title}» — ваш срок`,
        documentId: document.id,
      });
    });
  }

  absences
    .filter(
      (a) =>
        a.employeeId === userId &&
        (isActiveAbsence(a) || a.status === "pending") &&
        a.period.start > today &&
        containsDate(window, a.period.start),
    )
    .forEach((absence) =>
      events.push({
        id: `absence-${absence.id}`,
        date: absence.period.start,
        kind: "absence",
        title: `${ABSENCE_META[absence.type].label} · ${formatPeriod(absence.period, today)}${absence.status === "pending" ? " (на согласовании)" : ""}`,
        absence,
      }),
    );

  const special = eachISODate(shiftISODate(today, 1), window.end).map((date) =>
    getDay(calendar, date),
  );
  groupConsecutiveDays(
    special.filter((day) => day.kind === "holiday" || (day.kind === "weekend" && day.isTransfer)),
  ).forEach((range) =>
    events.push({
      id: `holiday-${range.start}`,
      date: range.start,
      kind: "holiday",
      title:
        range.days.length > 1
          ? `Нерабочие дни, до ${formatDay(range.end, today)} включительно`
          : `Нерабочий день${range.days[0]?.note ? ` — ${range.days[0].note}` : ""}`,
    }),
  );
  special
    .filter((day) => day.isShortened)
    .forEach((day) =>
      events.push({
        id: `short-${day.date}`,
        date: day.date,
        kind: "shortened",
        title: "Сокращённый день, −1 ч",
      }),
    );

  return events.sort((a, b) => a.date.localeCompare(b.date));
};

export type PendingActionKind =
  "vacation_queue" | "coverage_risk" | "stuck_document" | "sick_overlap" | "sick_no_deputy";

export interface IPendingAction {
  id: string;
  kind: PendingActionKind;
  text: string;
  actionLabel: string;
  /** Куда ведёт действие */
  target:
    | { page: "vacations" }
    | { page: "sick-leaves" }
    | { page: "team"; departmentId: string }
    | { page: "document"; id: string };
}

interface IActionsContext {
  userId: string;
  role: Role;
  calendar: CalendarIndex;
  employees: IEmployee[];
  departments: IDepartment[];
  absences: IAbsence[];
  documents: IDocument[];
  today: ISODate;
}

const nameOf = (employees: IEmployee[], id: string) => {
  const employee = employees.find((e) => e.id === id);
  return employee ? shortName(employee.fullName) : "сотрудник";
};

/**
 * Что ждёт действия пользователя. У каждой строки — одно действие.
 * Все: мои документы, где текущий этап стоит на отсутствующем. Руководитель: заявки
 * подчинённых и дни ниже порога. HR: больничные в отпуске и без замещающего.
 */
export const pendingActions = ({
  userId,
  role,
  calendar,
  employees,
  departments,
  absences,
  documents,
  today,
}: IActionsContext): IPendingAction[] => {
  const actions: IPendingAction[] = [];

  if (role === "manager") {
    const team = new Set(employees.filter((e) => e.managerId === userId).map((e) => e.id));
    const queue = absences.filter((a) => a.status === "pending" && team.has(a.employeeId));
    if (queue.length > 0) {
      actions.push({
        id: "vacation-queue",
        kind: "vacation_queue",
        text: `${queue.length} ${plural(queue.length, ["заявка", "заявки", "заявок"])} на отпуск ${plural(queue.length, ["ждёт", "ждут", "ждут"])} решения`,
        actionLabel: "Разобрать",
        target: { page: "vacations" },
      });
    }

    departments
      .filter((d) => d.headId === userId)
      .forEach((department) => {
        const risk = coverageRiskDays(calendar, department, employees, absences, today);
        const first = risk[0];
        if (!first) return;
        actions.push({
          id: `coverage-${department.id}`,
          kind: "coverage_risk",
          text: `${department.name}: покрытие ниже порога ${risk.length} ${plural(risk.length, ["день", "дня", "дней"])}, с ${formatDay(first, today)}`,
          actionLabel: "Календарь",
          target: { page: "team", departmentId: department.id },
        });
      });
  }

  for (const document of documents) {
    if (document.authorId !== userId) continue;
    const index = document.steps.findIndex((s) => s.status === "in_progress");
    const step = document.steps[index];
    const deadline = routeDeadlines(calendar, document, { employees, absences })[index];
    if (!step || !deadline || step.delegatedToId) continue;
    if (deadline.risk !== "delegated" && deadline.risk !== "no_deputy") continue;
    const who = nameOf(employees, step.approverId);
    actions.push({
      id: `document-${document.id}`,
      kind: "stuck_document",
      text:
        deadline.risk === "no_deputy"
          ? `${document.number}: ${who} отсутствует, замещать некому`
          : `${document.number}: ${who} отсутствует, этап стоит`,
      actionLabel: deadline.risk === "no_deputy" ? "Открыть" : "Передать заместителю",
      target: { page: "document", id: document.id },
    });
  }

  if (role === "hr") {
    const sick = absences.filter((a) => a.type === "sick" && isActiveAbsence(a));
    for (const leave of sick) {
      if (unresolvedOverlaps(calendar, leave, absences, today).length === 0) continue;
      actions.push({
        id: `sick-overlap-${leave.id}`,
        kind: "sick_overlap",
        text: `Больничный ${nameOf(employees, leave.employeeId)} пересекается с отпуском`,
        actionLabel: "Решить",
        target: { page: "sick-leaves" },
      });
    }
    for (const leave of sick) {
      if (leave.status === "closed" || !containsDate(leave.period, today)) continue;
      const deputy = resolveDeputy(leave.employeeId, today, { employees, absences });
      if (deputy.status !== "no_deputy" && deputy.status !== "cycle") continue;
      actions.push({
        id: `sick-no-deputy-${leave.id}`,
        kind: "sick_no_deputy",
        text: `Больничный ${nameOf(employees, leave.employeeId)}: нет замещающего`,
        actionLabel: "Назначить",
        target: { page: "sick-leaves" },
      });
    }
  }

  return actions;
};

/** Ближайший праздник или перенесённый выходной после даты — для строки контекста дня */
export const nextDayOff = (calendar: CalendarIndex, date: ISODate, scanDays = 180) =>
  eachISODate(shiftISODate(date, 1), shiftISODate(date, scanDays))
    .map((day) => getDay(calendar, day))
    .find((day) => day.kind === "holiday" || (day.kind === "weekend" && day.isTransfer)) ?? null;
