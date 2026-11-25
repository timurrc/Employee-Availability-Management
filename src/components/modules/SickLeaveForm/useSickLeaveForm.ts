import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { isApiError } from "@/api/axios.api";
import { useOpenSickLeave } from "@/hooks/useAbsences";
import { useAvailability } from "@/hooks/useAvailability";
import { useDocuments } from "@/hooks/useDocuments";
import { sickLeaveSchema } from "@/schemas/sickLeave.schema";
import type { ISickLeaveForm, ISickLeaveValues } from "@/types/absence.types";
import type { IPeriod } from "@/types/common.types";
import { shortName } from "@/utils/availability";
import { formatDay, todayISO } from "@/utils/date";
import { sickImpact, sickLeaveIssues } from "@/utils/sickLeave";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * «Открыть больничный»: сотрудник, начало, окончание или «неизвестна», ЭЛН.
 * «Что это задевает» считается, как только выбраны сотрудник и дата начала.
 */
export const useSickLeaveForm = (onDone: () => void, employeeId = "") => {
  const { employees, absences, employeeById } = useAvailability();
  const documents = useDocuments().data ?? [];
  const open = useOpenSickLeave();
  const today = todayISO();
  const [sendError, setSendError] = useState<string | null>(null);

  const form = useForm<ISickLeaveForm, unknown, ISickLeaveValues>({
    resolver: zodResolver(sickLeaveSchema),
    defaultValues: { employeeId, start: today, endUnknown: true, end: "", elnNumber: "" },
  });
  const [selectedId, start, endUnknown, end] = useWatch({
    control: form.control,
    name: ["employeeId", "start", "endUnknown", "end"],
  });

  const period: IPeriod | null =
    selectedId && ISO.test(start)
      ? { start, end: endUnknown || !ISO.test(end) || end < start ? null : end }
      : null;
  const impact = period
    ? sickImpact({ employeeId: selectedId, period }, { employees, absences, documents })
    : null;
  const issues = period
    ? sickLeaveIssues({ employeeId: selectedId, period }, absences, today, (date) =>
        formatDay(date, today),
      )
    : [];
  const blocking = issues.find((issue) => issue.message.startsWith("Уже открыт"));
  const employee = selectedId ? employeeById(selectedId) : undefined;

  const onSubmit = form.handleSubmit(async (values) => {
    if (blocking) return;
    setSendError(null);
    try {
      await open.mutateAsync({
        employeeId: values.employeeId,
        start: values.start,
        end: values.endUnknown ? null : values.end,
        elnNumber: values.elnNumber,
      });
      const who = employeeById(values.employeeId);
      toast.success(`Больничный открыт${who ? `: ${shortName(who.fullName)}` : ""}`);
      onDone();
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) {
        Object.entries(error.fieldErrors).forEach(([field, messages]) => {
          if (field in values) {
            form.setError(field as keyof ISickLeaveForm, { message: messages[0] });
          }
        });
        if (Object.keys(error.fieldErrors).some((field) => field in values)) return;
      }
      setSendError(isApiError(error) ? error.message : "Не удалось сохранить");
    }
  });

  return {
    form,
    employees: [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru")),
    employee,
    employeeById,
    endUnknown,
    impact,
    issues,
    blocking,
    today,
    sendError,
    onSubmit,
    isPending: open.isPending,
  };
};
