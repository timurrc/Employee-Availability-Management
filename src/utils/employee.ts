import { isActiveAbsence } from "@/core/absence";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";

const isClosedOut = (absence: IAbsence) =>
  absence.status === "rejected" || absence.status === "cancelled";

/**
 * Отсутствия сотрудника для карточки: план (текущие и будущие, по дате начала),
 * история (прошедшие, отклонённые и отменённые — новые сверху) и ближайшее будущее.
 * Черновики видит только сам сотрудник.
 */
export const splitAbsences = (
  absences: IAbsence[],
  employeeId: string,
  today: ISODate,
  { showDrafts = false }: { showDrafts?: boolean } = {},
) => {
  const own = absences.filter(
    (a) => a.employeeId === employeeId && (showDrafts || a.status !== "draft"),
  );
  const isPast = (a: IAbsence) => a.period.end !== null && a.period.end < today;

  const plan = own
    .filter((a) => !isClosedOut(a) && !isPast(a))
    .sort((a, b) => a.period.start.localeCompare(b.period.start));
  const history = own
    .filter((a) => isClosedOut(a) || isPast(a))
    .sort((a, b) => b.period.start.localeCompare(a.period.start));
  const next =
    plan.find((a) => a.period.start > today && (isActiveAbsence(a) || a.status === "pending")) ??
    null;

  return { plan, history, next };
};
