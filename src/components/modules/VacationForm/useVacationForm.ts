import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { vacationEndFor } from "@/core/absence";
import { shiftISODate } from "@/core/calendar";
import { isApiError } from "@/api/axios.api";
import { useAvailability } from "@/hooks/useAvailability";
import { useCreateAbsence, useUpdateAbsence } from "@/hooks/useAbsences";
import { useDepartments } from "@/hooks/useEmployees";
import { vacationRequestSchema } from "@/schemas/vacation.schema";
import { useAuthStore } from "@/store/auth.store";
import type {
  IAbsence,
  ICreateAbsenceDto,
  IVacationRequestForm,
  IVacationRequestValues,
  RequestType,
} from "@/types/absence.types";
import type { IClosedPeriod, ISODate } from "@/types/common.types";
import { shortName } from "@/utils/availability";
import { todayISO } from "@/utils/date";
import {
  deputyCheck,
  requestCalc,
  requestConflict,
  requestIssues,
  vacationSummary,
} from "@/utils/vacation";

/** С чем открыть форму: пусто, с датой начала (клик в календаре), черновик или отклонённая заявка */
export interface IVacationFormInit {
  start?: ISODate;
  /** Черновик — сохраняется в ту же заявку; отклонённая — даты копируются в новую */
  source?: IAbsence;
}

export type PeriodMode = "range" | "length";

const sendStatus = { draft: "draft", pending: "pending" } as const;

/**
 * Форма «Новая заявка на отпуск»: период → расчёт → конфликты → заместитель → отправка.
 * Каждый блок считается только когда есть период; правила — в utils/vacation.
 */
export const useVacationForm = (init: IVacationFormInit, onDone: () => void) => {
  const user = useAuthStore((state) => state.user);
  const { calendar, employees, absences, employeeById } = useAvailability();
  const departments = useDepartments().data ?? [];
  const create = useCreateAbsence();
  const update = useUpdateAbsence();
  const today = todayISO();

  const me = user ? employeeById(user.id) : undefined;
  const draftId = init.source?.status === "draft" ? init.source.id : undefined;
  const sourceType: RequestType =
    init.source && ["vacation", "unpaid", "study"].includes(init.source.type)
      ? (init.source.type as RequestType)
      : "vacation";
  const initialPeriod: IClosedPeriod | null = init.source?.period.end
    ? { start: init.source.period.start, end: init.source.period.end }
    : init.start
      ? { start: init.start, end: init.start }
      : null;

  const form = useForm<IVacationRequestForm, unknown, IVacationRequestValues>({
    resolver: zodResolver(vacationRequestSchema),
    defaultValues: {
      type: sourceType,
      period: initialPeriod,
      deputyId: init.source?.deputyId ?? me?.deputyId ?? "",
      comment: init.source?.comment ?? "",
    },
  });

  const [mode, setMode] = useState<PeriodMode>("range");
  /** Меняется при внешней правке периода — DateRangePicker пересоздаётся с новыми полями */
  const [pickerKey, setPickerKey] = useState(0);
  const [splitUnpaid, setSplitUnpaid] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const type = useWatch({ control: form.control, name: "type" });
  const period = useWatch({ control: form.control, name: "period" });
  const deputyId = useWatch({ control: form.control, name: "deputyId" });

  const manager = me?.managerId ? employeeById(me.managerId) : undefined;
  const department = departments.find((d) => d.id === me?.departmentId);
  const summary = me ? vacationSummary(calendar, me, absences, today, draftId) : null;
  const calc = period ? requestCalc(calendar, period) : null;
  const days = calc
    ? type === "vacation"
      ? calc.duration.chargeableDays
      : calc.duration.calendarDays
    : 0;
  const request = period && me ? { id: draftId, employeeId: me.id, period } : null;
  const issues = request
    ? requestIssues({ ...request, type }, { today, absences, days, summary })
    : null;
  const conflict =
    request && department
      ? requestConflict(calendar, department, employees, absences, request)
      : null;
  const deputy = request ? deputyCheck(deputyId || null, request, { employees, absences }) : null;
  // Календарь года не загружен — праздники не учтены (getDay подставляет обычную пятидневку)
  const missingYears = period
    ? [...new Set([period.start, period.end].map((d) => Number(d.slice(0, 4))))].filter(
        (year) => !calendar.has(`${year}-01-01`),
      )
    : [];

  const colleagues = employees.filter(
    (e) => e.id !== me?.id && (e.departmentId === me?.departmentId || e.id === me?.deputyId),
  );

  const setPeriod = (next: IClosedPeriod | null, external = false) => {
    form.setValue("period", next, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    setSplitUnpaid(false);
    if (external) setPickerKey((key) => key + 1);
  };

  /** Режим «начало + N календарных дней»: для ежегодного праздники продлевают отпуск */
  const setByLength = (start: ISODate, length: number) => {
    if (!start || !Number.isFinite(length) || length < 1) return setPeriod(null);
    const end =
      type === "vacation"
        ? vacationEndFor(calendar, start, length)
        : shiftISODate(start, length - 1);
    setPeriod({ start, end });
  };

  /** «Сократить до 12»: столько дней, сколько есть на балансе */
  const shortenTo = (length: number) => {
    if (period)
      setPeriod({ start: period.start, end: vacationEndFor(calendar, period.start, length) }, true);
  };

  /** Две заявки: ежегодный на доступные дни + без сохранения на остаток */
  const split =
    splitUnpaid && period && summary && summary.available >= 1
      ? (() => {
          const paidEnd = vacationEndFor(calendar, period.start, Math.floor(summary.available));
          return {
            paid: { start: period.start, end: paidEnd },
            unpaid: { start: shiftISODate(paidEnd, 1), end: period.end },
          };
        })()
      : null;

  const isPending = create.isPending || update.isPending;
  // formState — прокси: читаем при рендере, чтобы подписаться на изменения
  const { isDirty } = form.formState;

  const submit = (status: keyof typeof sendStatus) =>
    form.handleSubmit(async (values) => {
      if (!me) return;
      if (issues && issues.errors.length > 0) {
        form.setError("period", { message: issues.errors[0] });
        return;
      }
      setSendError(null);
      const base = {
        type: values.type,
        deputyId: values.deputyId || null,
        comment: values.comment,
        status: sendStatus[status],
      };
      const parts: { type: RequestType; period: IClosedPeriod }[] =
        split && values.type === "vacation"
          ? [
              { type: "vacation", period: split.paid },
              { type: "unpaid", period: split.unpaid },
            ]
          : [{ type: values.type, period: values.period }];

      try {
        for (const [index, part] of parts.entries()) {
          const dto: ICreateAbsenceDto = { ...base, ...part, employeeId: me.id };
          if (draftId && index === 0) await update.mutateAsync({ id: draftId, dto });
          else await create.mutateAsync(dto);
        }
        toast.success(
          status === "pending"
            ? manager
              ? `Заявка отправлена: ${shortName(manager.fullName)}`
              : "Заявка отправлена"
            : "Черновик сохранён",
        );
        onDone();
      } catch (error) {
        const message = isApiError(error) ? error.message : "Неизвестная ошибка";
        const fieldError = isApiError(error) ? error.fieldErrors?.period?.[0] : undefined;
        if (fieldError) form.setError("period", { message: fieldError });
        else setSendError(message);
      }
    });

  const requestClose = () => {
    if (isPending) return;
    if (isDirty && period) setConfirmClose(true);
    else onDone();
  };

  return {
    form,
    me,
    manager,
    department,
    today,
    calendar,
    employeeById,
    type,
    period,
    mode,
    setMode: (next: PeriodMode) => {
      setMode(next);
      setPickerKey((key) => key + 1);
    },
    pickerKey,
    setPeriod,
    setByLength,
    summary,
    calc,
    days,
    issues,
    conflict,
    deputy,
    deputyId,
    colleagues,
    missingYears,
    split,
    splitUnpaid,
    setSplitUnpaid,
    shortenTo,
    isDraft: Boolean(draftId),
    isPending,
    sendError,
    hasErrors: Boolean(issues && issues.errors.length > 0),
    saveDraft: submit("draft"),
    send: submit("pending"),
    retry: submit("pending"),
    requestClose,
    confirmClose,
    cancelClose: () => setConfirmClose(false),
    closeWithoutSaving: () => {
      setConfirmClose(false);
      onDone();
    },
    saveAndClose: () => {
      setConfirmClose(false);
      void submit("draft")();
    },
  };
};
