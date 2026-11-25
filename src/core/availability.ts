import type { AbsenceType, IAbsence, IDelegation } from "@/types/absence.types";
import type { ICalendarDay } from "@/types/calendar.types";
import type { IClosedPeriod, ISODate } from "@/types/common.types";
import type { IDepartment, IEmployee } from "@/types/employee.types";
import { isActiveAbsence, isPlannedAbsence } from "./absence";
import {
  type CalendarIndex,
  eachISODate,
  getDay,
  isWorkingDay,
  nextWorkingDay,
  shiftISODate,
} from "./calendar";
import { containsDate } from "./period";

/** Если отсутствия пересекаются, показываем самое «сильное»: больничный важнее командировки */
const TYPE_PRIORITY: Record<AbsenceType, number> = {
  sick: 0,
  trip: 1,
  vacation: 2,
  study: 3,
  unpaid: 4,
  dayoff: 5,
};

const byPriority = (a: IAbsence, b: IAbsence) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];

/** Действующее отсутствие сотрудника на дату (согласованное или больничный) */
export const absenceOn = (
  absences: IAbsence[],
  employeeId: string,
  date: ISODate,
  isCounted: (absence: IAbsence) => boolean = isActiveAbsence,
): IAbsence | null =>
  absences
    .filter((a) => a.employeeId === employeeId && isCounted(a) && containsDate(a.period, date))
    .sort(byPriority)[0] ?? null;

export type AvailabilityStatus = "available" | "absent" | "day_off";

export interface IAvailability {
  status: AvailabilityStatus;
  absence: IAbsence | null;
  day: ICalendarDay;
  /** До какого числа отсутствует (включительно); null — неизвестно или не отсутствует */
  until: ISODate | null;
}

/** Статус сотрудника на дату. Отсутствие важнее выходного: в субботу отпуска — «в отпуске». */
export const statusOn = (
  calendar: CalendarIndex,
  employeeId: string,
  date: ISODate,
  absences: IAbsence[],
): IAvailability => {
  const day = getDay(calendar, date);
  const absence = absenceOn(absences, employeeId, date);
  if (absence) return { status: "absent", absence, day, until: absence.period.end };
  return {
    status: day.kind === "workday" ? "available" : "day_off",
    absence: null,
    day,
    until: null,
  };
};

/**
 * Первый рабочий день начиная с даты, когда сотрудник на месте. Учитывает отсутствия
 * встык (отпуск → командировка). null — больничный открыт, дата выхода неизвестна.
 */
export const availableFrom = (
  calendar: CalendarIndex,
  employeeId: string,
  date: ISODate,
  absences: IAbsence[],
): ISODate | null => {
  let day = nextWorkingDay(calendar, date);
  let absence = absenceOn(absences, employeeId, day);
  // Каждый шаг уходит за конец очередного отсутствия — цикл конечен
  while (absence) {
    if (absence.period.end === null) return null;
    day = nextWorkingDay(calendar, shiftISODate(absence.period.end, 1));
    absence = absenceOn(absences, employeeId, day);
  }
  return day;
};

export interface IDeputyContext {
  employees: IEmployee[];
  absences: IAbsence[];
  delegations?: IDelegation[];
  /** Тип документа — ручное замещение может действовать только на некоторые типы */
  documentType?: string;
}

export type DeputyResolutionStatus = "self" | "deputy" | "no_deputy" | "cycle";

export interface IDeputyResolution {
  status: DeputyResolutionStatus;
  /** Кто фактически действует; null — некому */
  actorId: string | null;
  /** Путь от исходного сотрудника: [A, B, C]. Для цикла — с повтором: [A, B, A] */
  chain: string[];
}

const activeDelegation = (
  delegations: IDelegation[],
  fromId: string,
  date: ISODate,
  documentType?: string,
) =>
  delegations.find(
    (d) =>
      d.fromId === fromId &&
      containsDate(d.period, date) &&
      (d.documentTypes.length === 0 ||
        documentType === undefined ||
        d.documentTypes.includes(documentType)),
  );

/**
 * Кто действует за сотрудника на дату. Сотрудник «передаёт» полномочия, если отсутствует
 * или у него действует ручное замещение. Заместитель: ручное замещение → заместитель
 * из отсутствия → постоянный заместитель. Если заместитель тоже недоступен — идём дальше
 * по цепочке (A → B → C). Цикл и «нет замещающего» — явные состояния.
 */
export const resolveDeputy = (
  employeeId: string,
  date: ISODate,
  context: IDeputyContext,
): IDeputyResolution => {
  const { employees, absences, delegations = [], documentType } = context;

  const handOver = (id: string) => {
    const delegation = activeDelegation(delegations, id, date, documentType);
    if (delegation) return { passes: true, to: delegation.toId };
    const absence = absenceOn(absences, id, date);
    if (!absence) return { passes: false, to: null };
    const fallback = employees.find((e) => e.id === id)?.deputyId ?? null;
    return { passes: true, to: absence.deputyId ?? fallback };
  };

  const chain = [employeeId];
  let step = handOver(employeeId);
  if (!step.passes) return { status: "self", actorId: employeeId, chain };

  while (step.to) {
    const next = step.to;
    if (chain.includes(next)) return { status: "cycle", actorId: null, chain: [...chain, next] };
    chain.push(next);
    step = handOver(next);
    if (!step.passes) return { status: "deputy", actorId: next, chain };
  }
  return { status: "no_deputy", actorId: null, chain };
};

/**
 * Создаст ли назначение `candidateId` постоянным заместителем `employeeId` цикл.
 * Идём от кандидата по постоянным заместителям; если вернулись к сотруднику — цикл.
 * Возвращает путь от кандидата до сотрудника ([B, C, A]) или null, если цикла нет.
 */
export const deputyCycle = (
  employees: IEmployee[],
  employeeId: string,
  candidateId: string,
): string[] | null => {
  const deputyOf = new Map(employees.map((e) => [e.id, e.deputyId]));
  const path = [candidateId];
  let current = candidateId;
  while (current !== employeeId) {
    const next = deputyOf.get(current) ?? null;
    // Цепочка оборвалась или ушла в петлю, не проходящую через сотрудника, — цикла нет
    if (next === null || path.includes(next)) return null;
    path.push(next);
    current = next;
  }
  return path;
};

export interface ICoverage {
  date: ISODate;
  total: number;
  available: number;
  /** Кто из подразделения отсутствует */
  absentIds: string[];
  /** Доля доступных, % (целое) */
  percent: number;
  threshold: number;
  isBelowThreshold: boolean;
}

const coverage = (
  department: IDepartment,
  employees: IEmployee[],
  date: ISODate,
  isAbsent: (employeeId: string) => boolean,
): ICoverage => {
  const members = employees.filter((e) => e.departmentId === department.id);
  const absentIds = members.filter((e) => isAbsent(e.id)).map((e) => e.id);
  const total = members.length;
  const available = total - absentIds.length;
  const percent = total === 0 ? 100 : Math.round((available / total) * 100);
  return {
    date,
    total,
    available,
    absentIds,
    percent,
    threshold: department.coverageThreshold,
    isBelowThreshold: percent < department.coverageThreshold,
  };
};

/** Покрытие подразделения на дату по действующим отсутствиям */
export const departmentCoverage = (
  department: IDepartment,
  employees: IEmployee[],
  absences: IAbsence[],
  date: ISODate,
): ICoverage =>
  coverage(department, employees, date, (id) => absenceOn(absences, id, date) !== null);

/**
 * Покрытие подразделения по рабочим дням заявки — как если бы её согласовали.
 * Учитываются согласованные отсутствия и чужие заявки на согласовании — руководитель
 * видит конфликт до того, как одобрит обе.
 */
export const requestCoverage = (
  calendar: CalendarIndex,
  department: IDepartment,
  employees: IEmployee[],
  absences: IAbsence[],
  request: { id?: string; employeeId: string; period: IClosedPeriod },
): ICoverage[] => {
  const others = absences.filter((a) => a.id !== request.id);
  return eachISODate(request.period.start, request.period.end)
    .filter((date) => isWorkingDay(calendar, date))
    .map((date) =>
      coverage(
        department,
        employees,
        date,
        (id) => id === request.employeeId || absenceOn(others, id, date, isPlannedAbsence) !== null,
      ),
    );
};

/** Рабочие дни, в которые покрытие подразделения упадёт ниже порога, если заявку согласуют */
export const coverageConflicts = (
  calendar: CalendarIndex,
  department: IDepartment,
  employees: IEmployee[],
  absences: IAbsence[],
  request: { id?: string; employeeId: string; period: IClosedPeriod },
): ICoverage[] =>
  requestCoverage(calendar, department, employees, absences, request).filter(
    (day) => day.isBelowThreshold,
  );
