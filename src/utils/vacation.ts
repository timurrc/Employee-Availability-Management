import { addYears } from "date-fns";
import {
  accruedVacationDays,
  ANNUAL_VACATION_DAYS,
  isPlannedAbsence,
  MIN_VACATION_PART,
  vacationDuration,
  type IVacationDuration,
} from "@/core/absence";
import { requestCoverage, resolveDeputy, type ICoverage } from "@/core/availability";
import {
  type CalendarIndex,
  eachISODate,
  fromISODate,
  getDay,
  nextWorkingDay,
  shiftISODate,
  toISODate,
} from "@/core/calendar";
import { groupConsecutiveDays } from "@/core/deadline";
import { isClosedPeriod, periodsOverlap } from "@/core/period";
import {
  MAX_REQUEST_AHEAD_DAYS,
  OVERLAP_PHRASE,
  VACATION_TABS_BY_ROLE,
  type VacationTab,
} from "@/constants/vacation";
import type { AbsenceType, IAbsence } from "@/types/absence.types";
import type { IClosedPeriod, ISODate } from "@/types/common.types";
import type { IDepartment, IEmployee, Role } from "@/types/employee.types";
import { formatDay, formatPeriod } from "./date";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Рабочий год: от годовщины приёма, которая не позже даты, — до следующей (не включая) */
export const workingYear = (hireDate: ISODate, onDate: ISODate): IClosedPeriod => {
  const hire = fromISODate(hireDate);
  const now = fromISODate(onDate);
  let years = Math.max(0, now.getFullYear() - hire.getFullYear());
  if (addYears(hire, years) > now) years -= 1;
  const start = addYears(hire, Math.max(0, years));
  return { start: toISODate(start), end: shiftISODate(toISODate(addYears(start, 1)), -1) };
};

/** Заявка списывает дни с баланса ежегодного отпуска */
const isCharged = (absence: IAbsence) =>
  absence.type === "vacation" &&
  (absence.status === "approved" || absence.status === "pending") &&
  isClosedPeriod(absence.period);

const chargeable = (calendar: CalendarIndex, absence: IAbsence) =>
  vacationDuration(calendar, absence.period as IClosedPeriod).chargeableDays;

export interface IVacationSummary {
  year: IClosedPeriod;
  /** Начислено в рабочем году + остаток прошлых лет */
  accrued: number;
  carryover: number;
  /** Отгулено: согласованные части, которые уже начались */
  used: number;
  /** Запланировано: на согласовании и согласованные будущие */
  planned: number;
  available: number;
  annual: number;
  /** Была ли (или запланирована) часть ≥ 14 дней в рабочем году — ст. 125 */
  hasLongPart: boolean;
}

/**
 * Баланс ежегодного отпуска на дату: 28/12 ≈ 2,33 дня за месяц рабочего года плюс
 * остаток прошлых лет, минус использованное и запланированное в этом рабочем году.
 * excludeId — заявка, которую сейчас редактируют: её дни не должны списываться дважды.
 */
export const vacationSummary = (
  calendar: CalendarIndex,
  employee: Pick<IEmployee, "id" | "hireDate" | "vacationCarryover">,
  absences: IAbsence[],
  today: ISODate,
  excludeId?: string,
): IVacationSummary => {
  const year = workingYear(employee.hireDate, today);
  const parts = absences.filter(
    (a) =>
      a.employeeId === employee.id &&
      a.id !== excludeId &&
      isCharged(a) &&
      a.period.start >= year.start &&
      a.period.start <= year.end,
  );
  const sum = (list: IAbsence[]) => list.reduce((acc, a) => acc + chargeable(calendar, a), 0);
  const used = sum(parts.filter((a) => a.status === "approved" && a.period.start <= today));
  const planned = sum(parts.filter((a) => a.status === "pending" || a.period.start > today));
  const accrued = round2(accruedVacationDays(year.start, today) + employee.vacationCarryover);

  return {
    year,
    accrued,
    carryover: employee.vacationCarryover,
    used,
    planned,
    available: round2(accrued - used - planned),
    annual: ANNUAL_VACATION_DAYS,
    hasLongPart: parts.some((a) => chargeable(calendar, a) >= MIN_VACATION_PART),
  };
};

/** Баланс для подписи: целые — как есть, дробные — «12,33» */
export const formatBalance = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");

export interface IPeriodNote {
  period: IClosedPeriod;
  kind: "holiday" | "transfer";
  text: string;
}

export interface IRequestCalc {
  duration: IVacationDuration;
  /** Первый рабочий день после отпуска */
  returnDate: ISODate;
  /** Почему дата окончания такая: праздники (продлевают) и перенесённые выходные (входят) */
  notes: IPeriodNote[];
}

export const requestCalc = (calendar: CalendarIndex, period: IClosedPeriod): IRequestCalc => {
  const duration = vacationDuration(calendar, period);
  const transfers = eachISODate(period.start, period.end)
    .map((date) => getDay(calendar, date))
    .filter((day) => day.kind === "weekend" && day.isTransfer);
  const notes: IPeriodNote[] = [
    ...groupConsecutiveDays(duration.holidays).map((range) => ({
      period: { start: range.start, end: range.end },
      kind: "holiday" as const,
      text: `${range.days.length > 1 ? "праздники" : "праздник"}, в отпуск не ${
        range.days.length > 1 ? "входят и продлевают" : "входит и продлевает"
      } его (ст. 120 ТК РФ)`,
    })),
    ...groupConsecutiveDays(transfers).map((range) => ({
      period: { start: range.start, end: range.end },
      kind: "transfer" as const,
      text: `перенесённый выходной, входит в отпуск`,
    })),
  ].sort((a, b) => a.period.start.localeCompare(b.period.start));

  return {
    duration,
    returnDate: nextWorkingDay(calendar, shiftISODate(period.end, 1)),
    notes,
  };
};

export interface IRequestIssues {
  /** Блокируют отправку — показываются под полем периода */
  errors: string[];
  /** Сколько не хватает дней ежегодного отпуска; 0 — хватает */
  shortage: number;
  /** Подсказка по ст. 125: info — ещё успеете, warning — уже не успеть */
  longPart: { level: "info" | "warning"; message: string } | null;
}

/** Проверка периода заявки: ошибки ввода, нехватка баланса, правило «часть ≥ 14 дней» */
export const requestIssues = (
  request: { id?: string; employeeId: string; type: AbsenceType; period: IClosedPeriod },
  context: {
    today: ISODate;
    absences: IAbsence[];
    days: number;
    summary: IVacationSummary | null;
  },
): IRequestIssues => {
  const { period } = request;
  const { today } = context;
  const errors: string[] = [];

  if (period.end < period.start) errors.push("Дата окончания раньше даты начала");
  if (period.start < today) errors.push("Отпуск не может начинаться в прошлом");
  if (period.start > shiftISODate(today, MAX_REQUEST_AHEAD_DAYS)) {
    errors.push("Заявку можно подать не больше чем на год вперёд");
  }
  context.absences
    .filter(
      (a) =>
        a.employeeId === request.employeeId &&
        a.id !== request.id &&
        isPlannedAbsence(a) &&
        periodsOverlap(a.period, period),
    )
    .forEach((a) =>
      errors.push(`Пересекается с ${OVERLAP_PHRASE[a.type]} ${formatPeriod(a.period, today)}`),
    );

  const summary = request.type === "vacation" ? context.summary : null;
  const shortage = summary ? Math.max(0, Math.ceil(context.days - summary.available)) : 0;

  let longPart: IRequestIssues["longPart"] = null;
  if (summary && context.days < MIN_VACATION_PART && !summary.hasLongPart) {
    const left = Math.floor(summary.available - context.days);
    longPart =
      left >= MIN_VACATION_PART
        ? {
            level: "info",
            message: `Одна из частей отпуска должна быть не меньше ${MIN_VACATION_PART} дней. Останется ${left} дн. — успеете.`,
          }
        : {
            level: "warning",
            message: `Одна из частей отпуска должна быть не меньше ${MIN_VACATION_PART} дней (ст. 125 ТК РФ), а после этой заявки останется ${Math.max(0, left)} дн.`,
          };
  }

  return { errors, shortage, longPart };
};

export interface IRequestConflict {
  /** Рабочие дни ниже порога */
  days: ICoverage[];
  /** Худший день — «доступно 3 из 6 (50%)» */
  worst: ICoverage;
  ranges: IClosedPeriod[];
  /** Коллеги из отдела, которые тоже отсутствуют в эти даты (согласовано или на согласовании) */
  others: IAbsence[];
}

/** Склеивает даты подряд идущих рабочих дней в диапазоны с учётом выходных между ними */
const toRanges = (calendar: CalendarIndex, dates: ISODate[]): IClosedPeriod[] =>
  dates.reduce<IClosedPeriod[]>((ranges, date) => {
    const last = ranges.at(-1);
    if (last && nextWorkingDay(calendar, shiftISODate(last.end, 1)) === date) last.end = date;
    else ranges.push({ start: date, end: date });
    return ranges;
  }, []);

/** Конфликт покрытия по заявке: null — порог не нарушен */
export const requestConflict = (
  calendar: CalendarIndex,
  department: IDepartment,
  employees: IEmployee[],
  absences: IAbsence[],
  request: { id?: string; employeeId: string; period: IClosedPeriod },
): IRequestConflict | null => {
  const days = requestCoverage(calendar, department, employees, absences, request).filter(
    (day) => day.isBelowThreshold,
  );
  if (days.length === 0) return null;
  const worst = days.reduce((min, day) => (day.available < min.available ? day : min));
  const memberIds = new Set(
    employees.filter((e) => e.departmentId === department.id).map((e) => e.id),
  );
  const others = absences
    .filter(
      (a) =>
        a.id !== request.id &&
        a.employeeId !== request.employeeId &&
        memberIds.has(a.employeeId) &&
        isPlannedAbsence(a) &&
        periodsOverlap(a.period, request.period),
    )
    .sort((a, b) => a.period.start.localeCompare(b.period.start));
  return {
    days,
    worst,
    ranges: toRanges(
      calendar,
      days.map((d) => d.date),
    ),
    others,
  };
};

export type DeputyCheckStatus = "ok" | "absent" | "none";

export interface IDeputyCheck {
  status: DeputyCheckStatus;
  /** Отсутствие заместителя, пересекающееся с заявкой */
  absence: IAbsence | null;
  /** Кто фактически заместит по цепочке, если выбранный заместитель отсутствует */
  fallbackId: string | null;
}

/**
 * Сможет ли заместитель замещать в даты заявки. Если он сам отсутствует часть периода —
 * кто подхватит по цепочке (A → B → C) в первый день его отсутствия.
 */
export const deputyCheck = (
  deputyId: string | null,
  request: { employeeId: string; period: IClosedPeriod },
  context: { employees: IEmployee[]; absences: IAbsence[] },
): IDeputyCheck => {
  if (!deputyId) return { status: "none", absence: null, fallbackId: null };
  const absence =
    context.absences
      .filter(
        (a) =>
          a.employeeId === deputyId &&
          isPlannedAbsence(a) &&
          periodsOverlap(a.period, request.period),
      )
      .sort((a, b) => a.period.start.localeCompare(b.period.start))[0] ?? null;
  if (!absence) return { status: "ok", absence: null, fallbackId: null };

  const date =
    absence.period.start > request.period.start ? absence.period.start : request.period.start;
  // Заявка заместителя может быть ещё на согласовании — считаем её действующей для прогноза
  const absences = context.absences.map((a) =>
    a.id === absence.id ? { ...a, status: "approved" as const } : a,
  );
  const resolution = resolveDeputy(deputyId, date, { employees: context.employees, absences });
  const fallbackId =
    resolution.status === "deputy" && resolution.actorId !== request.employeeId
      ? resolution.actorId
      : null;
  return { status: "absent", absence, fallbackId };
};

/** Вкладки экрана по роли и вкладка по умолчанию — у руководителя очередь, если она не пуста */
export const vacationTabsFor = (role: Role, queueSize: number) => {
  const tabs = VACATION_TABS_BY_ROLE[role];
  const fallback: VacationTab = role === "manager" && queueSize > 0 ? "queue" : "mine";
  return { tabs, fallback };
};

/** Заявки — всё, кроме больничных и командировок (их оформляют HR и руководитель) */
export const isRequest = (absence: IAbsence) => absence.type !== "sick" && absence.type !== "trip";

/** Мои заявки: новые периоды сверху */
export const myRequests = (absences: IAbsence[], employeeId: string) =>
  absences
    .filter((a) => a.employeeId === employeeId && isRequest(a))
    .sort((a, b) => b.period.start.localeCompare(a.period.start));

/** Отменить можно заявку на согласовании или согласованную, которая ещё не началась */
export const canCancel = (absence: IAbsence, today: ISODate) =>
  absence.status === "pending" || (absence.status === "approved" && absence.period.start > today);

export interface IQueueRow {
  absence: IAbsence;
  employee: IEmployee;
  department: IDepartment | undefined;
  days: number;
  deputy: IDeputyCheck & { deputyId: string | null };
  /** Худший рабочий день по покрытию, если заявку согласовать */
  minCoverage: ICoverage | null;
  isBelow: boolean;
}

/**
 * Очередь руководителя: заявки подчинённых на согласовании. Строки ниже порога — сверху,
 * дальше по дате начала.
 */
export const approvalQueue = (
  calendar: CalendarIndex,
  context: {
    managerId: string;
    employees: IEmployee[];
    departments: IDepartment[];
    absences: IAbsence[];
  },
): IQueueRow[] => {
  const { employees, departments, absences } = context;
  const byId = new Map(employees.map((e) => [e.id, e]));
  return absences
    .filter(
      (a) =>
        a.status === "pending" &&
        isClosedPeriod(a.period) &&
        byId.get(a.employeeId)?.managerId === context.managerId,
    )
    .map((absence) => {
      const employee = byId.get(absence.employeeId)!;
      const period = absence.period as IClosedPeriod;
      const department = departments.find((d) => d.id === employee.departmentId);
      const coverage = department
        ? requestCoverage(calendar, department, employees, absences, {
            id: absence.id,
            employeeId: employee.id,
            period,
          })
        : [];
      const minCoverage =
        coverage.length > 0
          ? coverage.reduce((min, day) => (day.available < min.available ? day : min))
          : null;
      const deputyId = absence.deputyId ?? employee.deputyId;
      const days =
        absence.type === "vacation"
          ? vacationDuration(calendar, period).chargeableDays
          : eachISODate(period.start, period.end).length;
      return {
        absence,
        employee,
        department,
        days,
        deputy: {
          deputyId,
          ...deputyCheck(deputyId, { employeeId: employee.id, period }, { employees, absences }),
        },
        minCoverage,
        isBelow: minCoverage?.isBelowThreshold ?? false,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isBelow) - Number(a.isBelow) ||
        a.absence.period.start.localeCompare(b.absence.period.start),
    );
};

/** Решения руководителя за сегодня — свёрнутый блок «Решены сегодня» */
export const decidedToday = (absences: IAbsence[], managerId: string, today: ISODate) =>
  absences.filter((a) => a.decision?.byId === managerId && a.decision.at === today);

/** «до 12 дек.» — подпись отсутствия заместителя */
export const absenceUntil = (absence: IAbsence, today: ISODate) =>
  absence.period.end ? `до ${formatDay(absence.period.end, today)}` : "дата выхода неизвестна";
