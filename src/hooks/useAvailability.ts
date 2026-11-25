import { useCallback, useMemo } from "react";
import { isActiveAbsence } from "@/core/absence";
import { resolveDeputy, statusOn } from "@/core/availability";
import { indexCalendar, shiftISODate } from "@/core/calendar";
import { containsDate } from "@/core/period";
import { SOON_DAYS } from "@/constants/absence";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import type { IPersonStatus } from "@/types/availability.types";
import { todayISO } from "@/utils/date";
import { useAbsences } from "./useAbsences";
import { useCalendarYear } from "./useCalendar";
import { useEmployees } from "./useEmployees";

/** Отсутствие, которое начнётся в ближайшие SOON_DAYS дней (после date) */
const upcomingAbsence = (absences: IAbsence[], employeeId: string, date: ISODate) => {
  const until = shiftISODate(date, SOON_DAYS);
  return (
    absences
      .filter(
        (a) =>
          a.employeeId === employeeId &&
          isActiveAbsence(a) &&
          a.period.start > date &&
          containsDate({ start: date, end: until }, a.period.start),
      )
      .sort((a, b) => a.period.start.localeCompare(b.period.start))[0] ?? null
  );
};

/**
 * Статус доступности и заместитель любого сотрудника на дату. Собирает справочник,
 * отсутствия и производственный календарь (текущий и следующий год) и считает через src/core.
 * Нужен везде, где есть имя человека: PersonChip, поиск, маршрут согласования.
 */
export const useAvailability = () => {
  const year = Number(todayISO().slice(0, 4));
  const employees = useEmployees();
  const absences = useAbsences();
  const current = useCalendarYear(year);
  const next = useCalendarYear(year + 1);

  // Следующего года в календаре может ещё не быть (постановление не вышло) — это не ошибка
  const queries = [employees, absences, current];

  const calendar = useMemo(
    () => indexCalendar([current.data, next.data].filter((y) => y !== undefined)),
    [current.data, next.data],
  );

  const byId = useMemo(
    () => new Map((employees.data ?? []).map((employee) => [employee.id, employee])),
    [employees.data],
  );

  const statusOf = useCallback(
    (employeeId: string, date: ISODate = todayISO()): IPersonStatus => {
      const list = absences.data ?? [];
      return {
        availability: statusOn(calendar, employeeId, date, list),
        upcoming: upcomingAbsence(list, employeeId, date),
        deputy: resolveDeputy(employeeId, date, {
          employees: employees.data ?? [],
          absences: list,
        }),
      };
    },
    [calendar, absences.data, employees.data],
  );

  const employeeById = useCallback((id: string): IEmployee | undefined => byId.get(id), [byId]);

  return {
    calendar,
    employees: employees.data ?? [],
    absences: absences.data ?? [],
    statusOf,
    employeeById,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    refetch: () => queries.filter((q) => q.isError).forEach((q) => void q.refetch()),
  };
};
