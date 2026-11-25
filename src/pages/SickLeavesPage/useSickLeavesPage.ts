import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { CloseOverlap } from "@/components/modules/SickLeaveDialogs/CloseSickDialog";
import { UNDO_TOAST_MS } from "@/constants/vacation";
import { useCloseSickLeave, useExtendSickLeave, useExtendVacation } from "@/hooks/useAbsences";
import { useAvailability } from "@/hooks/useAvailability";
import { useDocuments } from "@/hooks/useDocuments";
import { useDepartments } from "@/hooks/useEmployees";
import type { IAbsence, IExtendSickLeaveDto } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { formatDay, todayISO } from "@/utils/date";
import {
  filterSickRows,
  isSickTab,
  overlapCount,
  sickImpact,
  sickRows,
  type ISickOverlapView,
  type ISickRow,
  type SickTab,
} from "@/utils/sickLeave";

/**
 * «Больничные» (HR): вкладка и подразделение — в URL (?tab=open|closed|all&dept=d-it),
 * поиск по ФИО — локально. Продлить/закрыть — диалоги, продление отпуска по ст. 124 — тост с «Отменить».
 */
export const useSickLeavesPage = () => {
  const [params, setParams] = useSearchParams();
  const availability = useAvailability();
  const departmentsQuery = useDepartments();
  const documentsQuery = useDocuments();
  const extendSick = useExtendSickLeave();
  const closeSick = useCloseSickLeave();
  const extendVacation = useExtendVacation();
  const { calendar, employees, absences, delegations, employeeById } = availability;
  const departments = departmentsQuery.data ?? [];
  const documents = documentsQuery.data ?? [];
  const today = todayISO();

  const rawTab = params.get("tab");
  const tab: SickTab = isSickTab(rawTab) ? rawTab : "open";
  const departmentId = params.get("dept") ?? "";
  const [query, setQuery] = useState("");
  const [onlyOverlaps, setOnlyOverlaps] = useState(false);

  const [isFormOpen, setFormOpen] = useState(false);
  const [extending, setExtending] = useState<ISickRow | null>(null);
  const [closing, setClosing] = useState<ISickRow | null>(null);
  const [assigning, setAssigning] = useState<IEmployee | null>(null);
  const [busyVacationId, setBusyVacationId] = useState<string | null>(null);

  const allRows = sickRows({ calendar, employees, departments, absences, delegations, today });
  const filtered = filterSickRows(allRows, { tab, query, departmentId }, today);
  const rows = onlyOverlaps ? filtered.filter((row) => row.overlaps.length > 0) : filtered;
  const openCount = allRows.filter((row) => row.leave.status !== "closed").length;

  const setParam = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const nameOf = (row: ISickRow | null) => (row ? shortName(row.employee.fullName) : "");

  /** Продлить отпуск на недостающие дни больничного; «Отменить» в тосте возвращает как было */
  const extendVacationBy = async (
    sick: IAbsence,
    overlap: Pick<ISickOverlapView, "vacation" | "remaining" | "alreadyExtended" | "extendedEnd">,
  ) => {
    const { vacation, extendedEnd, remaining, alreadyExtended } = overlap;
    if (!extendedEnd || !vacation.period.end) return false;
    const previous = {
      end: vacation.period.end,
      sickLeaveId: vacation.extension?.sickLeaveId ?? null,
      days: vacation.extension?.days ?? 0,
    };
    setBusyVacationId(vacation.id);
    try {
      await extendVacation.mutateAsync({
        id: vacation.id,
        dto: { end: extendedEnd, sickLeaveId: sick.id, days: alreadyExtended + remaining },
      });
      toast.success(`Отпуск продлён до ${formatDay(extendedEnd, today)}`, {
        duration: UNDO_TOAST_MS,
        action: {
          label: "Отменить",
          onClick: () => void extendVacation.mutate({ id: vacation.id, dto: previous }),
        },
      });
      return true;
    } catch {
      toast.error("Не удалось продлить отпуск — повторите");
      return false;
    } finally {
      setBusyVacationId(null);
    }
  };

  const confirmExtend = async (dto: IExtendSickLeaveDto) => {
    if (!extending) return;
    try {
      await extendSick.mutateAsync({ id: extending.leave.id, dto });
      toast.success(
        dto.end
          ? `Больничный продлён до ${formatDay(dto.end, today)}: ${nameOf(extending)}`
          : `Больничный продлён, дата выхода неизвестна: ${nameOf(extending)}`,
      );
      setExtending(null);
    } catch {
      // Сообщение — в диалоге (extendSick.error)
    }
  };

  const confirmClose = async (end: ISODate, extend: CloseOverlap[]) => {
    if (!closing) return;
    try {
      await closeSick.mutateAsync({ id: closing.leave.id, dto: { end } });
      toast.success(`Больничный закрыт: ${nameOf(closing)}`);
      const leave = closing.leave;
      setClosing(null);
      for (const item of extend) await extendVacationBy(leave, item);
    } catch {
      // Сообщение — в диалоге (closeSick.error)
    }
  };

  const stepsOf = (employeeId: string) =>
    sickImpact(
      { employeeId, period: { start: today, end: today } },
      { employees, absences, documents },
    ).steps;

  return {
    today,
    calendar,
    absences,
    employees,
    departments,
    employeeById,
    rows,
    openCount,
    overlapTotal: overlapCount(allRows),
    tab,
    setTab: (value: SickTab) => setParam("tab", value === "open" ? "" : value),
    departmentId,
    setDepartmentId: (value: string) => setParam("dept", value),
    query,
    setQuery,
    onlyOverlaps,
    showOverlaps: () => {
      setOnlyOverlaps(true);
      setParam("tab", "all");
    },
    resetFilters: () => {
      setQuery("");
      setOnlyOverlaps(false);
      setParams({}, { replace: true });
    },
    hasFilters: Boolean(query || departmentId || onlyOverlaps),
    stepsOf,
    busyVacationId,
    extendVacationBy: (row: ISickRow, overlap: ISickOverlapView) =>
      void extendVacationBy(row.leave, overlap),
    isFormOpen,
    openForm: () => setFormOpen(true),
    closeForm: () => setFormOpen(false),
    extending,
    startExtend: (row: ISickRow) => {
      extendSick.reset();
      setExtending(row);
    },
    cancelExtend: () => setExtending(null),
    confirmExtend: (dto: IExtendSickLeaveDto) => void confirmExtend(dto),
    extendError: extendSick.error?.message,
    isExtendPending: extendSick.isPending,
    closing,
    startClose: (row: ISickRow) => {
      closeSick.reset();
      setClosing(row);
    },
    cancelClose: () => setClosing(null),
    confirmClose: (end: ISODate, extend: CloseOverlap[]) => void confirmClose(end, extend),
    closeError: closeSick.error?.message,
    isClosePending: closeSick.isPending,
    assigning,
    assign: (employee: IEmployee) => setAssigning(employee),
    cancelAssign: () => setAssigning(null),
    nameOf,
    isLoading: availability.isLoading,
    isError: availability.isError,
    refetch: availability.refetch,
  };
};
