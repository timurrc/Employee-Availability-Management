import { useParams } from "react-router-dom";
import { availableFrom } from "@/core/availability";
import { getDay, nextWorkingDay } from "@/core/calendar";
import { routeDeadlines } from "@/core/deadline";
import { useAvailability } from "@/hooks/useAvailability";
import { useDocuments } from "@/hooks/useDocuments";
import { useDepartments, useEmployee } from "@/hooks/useEmployees";
import { useAuthStore } from "@/store/auth.store";
import { todayISO } from "@/utils/date";
import { splitAbsences } from "@/utils/employee";
import { vacationSummary } from "@/utils/vacation";

export const useEmployeePage = () => {
  const { id } = useParams<{ id: string }>();
  const viewer = useAuthStore((state) => state.user);
  const employeeQuery = useEmployee(id);
  const availability = useAvailability();
  const departmentsQuery = useDepartments();
  const documentsQuery = useDocuments();
  const { calendar, absences, employees, statusOf, employeeById } = availability;
  const today = todayISO();

  const employee = employeeQuery.data;
  const role = viewer?.role ?? "employee";
  const isSelf = viewer?.id === id;

  const department = departmentsQuery.data?.find((d) => d.id === employee?.departmentId);
  const manager = employee?.managerId ? employeeById(employee.managerId) : undefined;
  const permanentDeputy = employee?.deputyId ? employeeById(employee.deputyId) : undefined;

  // В нерабочий день статус показываем на ближайший рабочий
  const day = getDay(calendar, today);
  const statusDate = day.kind === "workday" ? today : nextWorkingDay(calendar, today);
  const status = id ? statusOf(id, statusDate) : undefined;
  const returnsOn =
    id && status?.availability.absence ? availableFrom(calendar, id, statusDate, absences) : null;
  const actor =
    status && status.deputy.status === "deputy" && status.deputy.actorId
      ? employeeById(status.deputy.actorId)
      : undefined;

  const { plan, history, next } = splitAbsences(absences, id ?? "", today, { showDrafts: isSelf });

  // Этапы, где сотрудник согласующий и решение ещё не принято
  const documents = (() => {
    if (!id || !viewer) return [];
    const canSeeAll = role === "manager" || role === "hr" || role === "admin";
    return (documentsQuery.data ?? [])
      .filter((document) => canSeeAll || document.authorId === viewer.id)
      .flatMap((document) => {
        const deadlines = routeDeadlines(calendar, document, { employees, absences });
        return document.steps.flatMap((step, index) => {
          const open = step.status === "waiting" || step.status === "in_progress";
          if (!open || (step.delegatedToId ?? step.approverId) !== id) return [];
          return [{ document, step, deadline: deadlines[index] ?? null }];
        });
      });
  })();

  // Баланс видят сам сотрудник, его руководитель и HR — остальным блок не рендерится
  const canSeeBalance =
    isSelf || role === "hr" || (role === "manager" && employee?.managerId === viewer?.id);
  const balance =
    canSeeBalance && employee ? vacationSummary(calendar, employee, absences, today) : null;

  return {
    id,
    employee,
    balance,
    department,
    manager,
    permanentDeputy,
    permanentDeputyStatus: permanentDeputy ? statusOf(permanentDeputy.id, statusDate) : undefined,
    today,
    day,
    statusDate,
    status,
    returnsOn,
    actor,
    actorStatus: actor ? statusOf(actor.id, statusDate) : undefined,
    plan,
    history,
    next,
    documents,
    employeeById,
    statusOf,
    canSeeEln: role === "hr",
    isLoading: employeeQuery.isPending || availability.isLoading,
    isNotFound: employeeQuery.error?.status === 404,
    error: employeeQuery.error,
    isStatusError: availability.isError,
    refetch: () => {
      if (employeeQuery.isError) void employeeQuery.refetch();
      availability.refetch();
    },
    documentsState: { isLoading: documentsQuery.isLoading, isError: documentsQuery.isError },
  };
};
