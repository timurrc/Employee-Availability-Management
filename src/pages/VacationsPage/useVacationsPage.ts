import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { IVacationFormInit } from "@/components/modules/VacationForm/useVacationForm";
import { useDeleteAbsence } from "@/hooks/useAbsences";
import { useAvailability } from "@/hooks/useAvailability";
import { useDepartments } from "@/hooks/useEmployees";
import { useVacationDecision } from "@/hooks/useVacationDecision";
import { VACATION_TAB_LABELS, type VacationTab } from "@/constants/vacation";
import { useAuthStore } from "@/store/auth.store";
import type { IAbsence } from "@/types/absence.types";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { todayISO } from "@/utils/date";
import { toast } from "sonner";
import {
  approvalQueue,
  decidedToday,
  isRequest,
  myRequests,
  vacationSummary,
  vacationTabsFor,
  type IQueueRow,
} from "@/utils/vacation";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * «Отпуска»: вкладка в URL (?tab=mine|queue|all), ?start=YYYY-MM-DD открывает форму
 * с датой начала (клик по своей пустой ячейке в календаре команды).
 */
export const useVacationsPage = () => {
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams();
  const availability = useAvailability();
  const departmentsQuery = useDepartments();
  const decision = useVacationDecision();
  const remove = useDeleteAbsence();
  const { calendar, employees, absences, employeeById, statusOf } = availability;
  const today = todayISO();
  const role = user?.role ?? "employee";
  const me = user ? employeeById(user.id) : undefined;
  const departments = departmentsQuery.data ?? [];

  const queue = user
    ? approvalQueue(calendar, { managerId: user.id, employees, departments, absences })
    : [];
  const { tabs, fallback } = vacationTabsFor(role, queue.length);
  const rawTab = params.get("tab") as VacationTab | null;
  const tab = rawTab && tabs.includes(rawTab) ? rawTab : fallback;

  const rawStart = params.get("start");
  const [form, setForm] = useState<IVacationFormInit | null>(() =>
    rawStart && ISO_DATE.test(rawStart) ? { start: rawStart } : null,
  );
  const [rejecting, setRejecting] = useState<IQueueRow | null>(null);

  const closeForm = () => {
    setForm(null);
    if (params.has("start")) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("start");
          return next;
        },
        { replace: true },
      );
    }
  };

  // Руководитель видит заявки своего отдела, HR и админ — все. Черновики — личные.
  const allRequests = absences.filter(
    (a) =>
      isRequest(a) &&
      a.status !== "draft" &&
      (role !== "manager" || employeeById(a.employeeId)?.departmentId === me?.departmentId),
  );

  const nameOf = (employee: IEmployee) => shortName(employee.fullName);

  return {
    user,
    role,
    me,
    today,
    calendar,
    employees,
    absences,
    departments,
    employeeById,
    statusOf,
    tabs: tabs.map((value) => ({
      value,
      label:
        value === "queue"
          ? `${VACATION_TAB_LABELS[value]} · ${queue.length}`
          : VACATION_TAB_LABELS[value],
    })),
    tab,
    setTab: (value: VacationTab) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", value);
          return next;
        },
        { replace: true },
      ),
    summary: me ? vacationSummary(calendar, me, absences, today) : null,
    summaryOf: (employee: IEmployee) => vacationSummary(calendar, employee, absences, today),
    requests: me ? myRequests(absences, me.id) : [],
    queue,
    decided: user ? decidedToday(absences, user.id, today) : [],
    allRequests,
    busyId: decision.busyId ?? (remove.isPending ? (remove.variables ?? null) : null),
    form,
    openForm: (init: IVacationFormInit = {}) => setForm(init),
    closeForm,
    editRequest: (absence: IAbsence) => setForm({ source: absence }),
    cancelRequest: (absence: IAbsence) => void decision.cancel(absence),
    deleteRequest: (absence: IAbsence) =>
      remove.mutate(absence.id, {
        onSuccess: () => toast.success("Черновик удалён"),
        onError: (error) => toast.error(`Не удалось удалить черновик: ${error.message}`),
      }),
    approve: (row: IQueueRow) => void decision.approve(row.absence, nameOf(row.employee)),
    approveMany: async (rows: IQueueRow[]) => {
      for (const row of rows) await decision.approve(row.absence, nameOf(row.employee));
    },
    rejecting,
    startReject: (row: IQueueRow) => setRejecting(row),
    cancelReject: () => setRejecting(null),
    confirmReject: async (reason: string) => {
      if (!rejecting) return;
      const ok = await decision.reject(rejecting.absence, reason, nameOf(rejecting.employee));
      if (ok) setRejecting(null);
    },
    isRejectPending: Boolean(rejecting && decision.busyId === rejecting.absence.id),
    isLoading: availability.isLoading || departmentsQuery.isLoading,
    isError: availability.isError || departmentsQuery.isError,
    refetch: () => {
      availability.refetch();
      if (departmentsQuery.isError) void departmentsQuery.refetch();
    },
  };
};
