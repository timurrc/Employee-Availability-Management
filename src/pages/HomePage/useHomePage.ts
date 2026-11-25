import { useMemo, useState } from "react";
import { getDay, nextWorkingDay } from "@/core/calendar";
import { useAvailability } from "@/hooks/useAvailability";
import { toast } from "sonner";
import { UNDO_TOAST_MS } from "@/constants/vacation";
import { useDocuments, usePatchStep } from "@/hooks/useDocuments";
import { shortName } from "@/utils/availability";
import type { IPendingAction } from "@/utils/today";
import { useDepartments } from "@/hooks/useEmployees";
import { useAuthStore } from "@/store/auth.store";
import { todayISO } from "@/utils/date";
import { matchesQuery } from "@/utils/text";
import {
  absentRows,
  coverageRows,
  nextAbsence,
  nextDayOff,
  pendingActions,
  soonRows,
  upcomingEvents,
} from "@/utils/today";

export type Scope = "mine" | "all";

export const useHomePage = () => {
  const user = useAuthStore((state) => state.user);
  const availability = useAvailability();
  const departmentsQuery = useDepartments();
  const documentsQuery = useDocuments();
  const { calendar, employees, absences, delegations, statusOf, employeeById } = availability;
  const patchStep = usePatchStep();
  const [delegatingId, setDelegatingId] = useState<string | null>(null);

  const today = todayISO();
  const day = getDay(calendar, today);
  // В нерабочий день показываем, кого не будет в ближайший рабочий
  const date = day.kind === "workday" ? today : nextWorkingDay(calendar, today);

  const me = user ? employeeById(user.id) : undefined;
  const role = user?.role ?? "employee";
  const isWide = role === "hr" || role === "admin";

  const [scope, setScope] = useState<Scope>(isWide ? "all" : "mine");
  const [query, setQuery] = useState("");

  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);

  const inScope = useMemo(
    () =>
      scope === "mine" && me
        ? employees.filter((e) => e.departmentId === me.departmentId)
        : employees,
    [employees, scope, me],
  );

  const absent = useMemo(
    () => absentRows(inScope, statusOf, calendar, absences, date),
    [inScope, statusOf, calendar, absences, date],
  );
  const shown = useMemo(
    () =>
      query.trim() ? absent.filter((row) => matchesQuery(row.employee.fullName, query)) : absent,
    [absent, query],
  );
  const soon = useMemo(() => soonRows(inScope, absences, date), [inScope, absences, date]);
  const next = useMemo(
    () => nextAbsence(absences, new Set(inScope.map((e) => e.id)), date),
    [absences, inScope, date],
  );

  const coverage = useMemo(() => {
    const visible =
      isWide || role === "manager"
        ? departments
        : departments.filter((d) => d.id === me?.departmentId);
    return coverageRows(visible, employees, absences, date);
  }, [departments, employees, absences, date, isWide, role, me]);

  const actions = useMemo(
    () =>
      user
        ? pendingActions({
            userId: user.id,
            role,
            calendar,
            employees,
            departments,
            absences,
            documents,
            delegations,
            today,
          })
        : [],
    [user, role, calendar, employees, departments, absences, documents, delegations, today],
  );

  const events = useMemo(
    () =>
      user
        ? upcomingEvents({ userId: user.id, calendar, employees, absences, documents, today })
        : [],
    [user, calendar, employees, absences, documents, today],
  );

  const dayOff = useMemo(() => nextDayOff(calendar, today), [calendar, today]);

  const absentEmployee = next ? employeeById(next.employeeId) : undefined;

  /** «Передать заместителю» прямо из «Ждут вашего действия», с «Отменить» в тосте */
  const delegate = async (action: IPendingAction) => {
    if (!action.delegate) return;
    const { documentId, stepId, toId } = action.delegate;
    setDelegatingId(action.id);
    try {
      await patchStep.mutateAsync({ id: documentId, stepId, dto: { delegatedToId: toId } });
      const deputy = employeeById(toId);
      toast.success(`Этап передан: ${deputy ? shortName(deputy.fullName) : "заместителю"}`, {
        duration: UNDO_TOAST_MS,
        action: {
          label: "Отменить",
          onClick: () =>
            void patchStep.mutate({ id: documentId, stepId, dto: { delegatedToId: null } }),
        },
      });
    } catch {
      toast.error("Не удалось передать этап — повторите");
    } finally {
      setDelegatingId(null);
    }
  };

  return {
    delegate: (action: IPendingAction) => void delegate(action),
    delegatingId,
    user,
    role,
    today,
    day,
    date,
    nextDayOff: dayOff,
    hoursPerDay: me?.hoursPerDay ?? 8,
    scope,
    setScope,
    query,
    setQuery,
    absent: shown,
    absentTotal: absent.length,
    soon,
    next: next && absentEmployee ? { absence: next, employee: absentEmployee } : null,
    coverage,
    actions,
    events,
    statusOf,
    employeeById,
    people: {
      isLoading: availability.isLoading,
      isError: availability.isError,
      refetch: availability.refetch,
    },
    directory: {
      isLoading: availability.isLoading || departmentsQuery.isLoading,
      isError: departmentsQuery.isError,
      refetch: () => void departmentsQuery.refetch(),
    },
    documents: {
      isLoading: availability.isLoading || documentsQuery.isLoading || departmentsQuery.isLoading,
    },
  };
};
