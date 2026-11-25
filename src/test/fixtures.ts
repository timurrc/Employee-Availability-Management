import { PRODUCTION_CALENDAR_SOURCES } from "@/constants/productionCalendar";
import { buildCalendarYear, indexCalendar } from "@/core/calendar";
import type { IAbsence, IDelegation } from "@/types/absence.types";
import type { IEmployee } from "@/types/employee.types";

/**
 * Фикстуры для unit-тестов `src/core`: фиксированные даты и минимальные сущности,
 * не зависят от моков «от сегодня».
 */
export const CALENDAR = indexCalendar(PRODUCTION_CALENDAR_SOURCES.map(buildCalendarYear));

export const makeEmployee = (id: string, extra: Partial<IEmployee> = {}): IEmployee => ({
  id,
  fullName: `Сотрудник ${id}`,
  position: "Специалист",
  departmentId: "d1",
  managerId: null,
  deputyId: null,
  role: "employee",
  hoursPerDay: 8,
  email: `${id}@example.com`,
  hireDate: "2020-01-01",
  vacationCarryover: 0,
  ...extra,
});

export const makeAbsence = (
  id: string,
  employeeId: string,
  start: string,
  end: string | null,
  extra: Partial<IAbsence> = {},
): IAbsence => ({
  id,
  employeeId,
  type: "vacation",
  period: { start, end },
  status: "approved",
  deputyId: null,
  createdAt: "2026-01-01",
  ...extra,
});

export const makeDelegation = (
  id: string,
  fromId: string,
  toId: string,
  start: string,
  end: string | null,
  extra: Partial<IDelegation> = {},
): IDelegation => ({
  id,
  fromId,
  toId,
  period: { start, end },
  reason: "manual",
  documentTypes: [],
  ...extra,
});
