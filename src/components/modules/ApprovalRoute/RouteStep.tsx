import { ArrowDown, ArrowUp, Check, Clock, UserRoundX, X } from "lucide-react";
import { useState } from "react";
import AbsenceTag from "@/components/modules/AbsenceTag/AbsenceTag";
import DeadlineExplain from "@/components/modules/DeadlineExplain/DeadlineExplain";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Badge from "@/components/ui/Badge/Badge";
import Button from "@/components/ui/Button/Button";
import Select from "@/components/ui/Select/Select";
import type { CalendarIndex } from "@/core/calendar";
import { countWorkingDays, shiftISODate } from "@/core/calendar";
import type { IRouteStepDeadline } from "@/core/deadline";
import { APPROVAL_STATUS_META } from "@/constants/absence";
import type { ISODate } from "@/types/common.types";
import type { IApprovalStep } from "@/types/document.types";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { cn } from "@/utils/cn";
import { formatDay } from "@/utils/date";
import { isBeyondCalendar, isOpenStep, MAX_STEP_DAYS, type IRouteIssue } from "@/utils/document";

export interface RouteStepHandlers {
  onDelegate: (step: IApprovalStep, toId: string) => void;
  onReturn: (step: IApprovalStep) => void;
  onWait: (step: IApprovalStep, wait: boolean) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onDuration: (index: number, days: number) => void;
}

interface RouteStepProps extends RouteStepHandlers {
  step: IApprovalStep;
  index: number;
  total: number;
  deadline?: IRouteStepDeadline;
  /** Нерешённая проблема этапа: отсутствует / уйдёт / некому замещать */
  issue?: IRouteIssue;
  calendar: CalendarIndex;
  today: ISODate;
  employees: IEmployee[];
  employeeById: (id: string) => IEmployee | undefined;
  /** Правка маршрута (черновик, автор) */
  canEdit: boolean;
  /** Передача заместителю (автор, этап не закрыт) */
  canDelegate: boolean;
  isCurrent: boolean;
  isBusy?: boolean;
}

/** Срок этапа: поле можно очистить и набрать заново, в маршрут уходит только допустимое число */
const DurationInput = ({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (days: number) => void;
}) => {
  const [text, setText] = useState(String(value));
  const parsed = Number(text);
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_STEP_DAYS;
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
      <input
        type="number"
        min={1}
        max={MAX_STEP_DAYS}
        value={text}
        aria-label={label}
        aria-invalid={!isValid}
        onChange={(event) => {
          setText(event.target.value);
          const days = Number(event.target.value);
          if (Number.isInteger(days) && days >= 1 && days <= MAX_STEP_DAYS) onChange(days);
        }}
        onBlur={() => !isValid && setText(String(value))}
        className={cn(
          "h-7 w-14 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 text-right text-[var(--color-text)] tabular-nums outline-none focus:border-[var(--color-focus)]",
          !isValid && "border-[var(--color-danger)]",
        )}
      />
      раб. дн.
    </label>
  );
};

const nameOf = (employeeById: RouteStepProps["employeeById"], id: string | null | undefined) => {
  const person = id ? employeeById(id) : undefined;
  return person ? shortName(person.fullName) : "сотрудник";
};

/**
 * Этап маршрута: согласующий — не строка справочника, а человек со статусом на даты этапа.
 * Если его не будет — заместитель по цепочке и одно действие «Передать заместителю».
 */
const RouteStep = ({
  step,
  index,
  total,
  deadline,
  issue,
  calendar,
  today,
  employees,
  employeeById,
  canEdit,
  canDelegate,
  isCurrent,
  isBusy,
  onDelegate,
  onReturn,
  onWait,
  onMove,
  onRemove,
  onDuration,
}: RouteStepProps) => {
  const approver = employeeById(step.approverId);
  const delegate = step.delegatedToId ? employeeById(step.delegatedToId) : undefined;
  const open = isOpenStep(step);
  const absence = deadline?.absence ?? null;
  const beyond = deadline ? isBeyondCalendar(calendar, deadline.due) : false;
  const label = `этап ${index + 1}`;

  const waitingDays =
    deadline && deadline.risk === "waiting" && deadline.dueIfWaiting && absence?.period.end
      ? countWorkingDays(calendar, shiftISODate(deadline.start, 1), deadline.due) -
        step.durationDays
      : 0;

  const statusLine = (() => {
    if (!open) {
      const meta = APPROVAL_STATUS_META[step.status];
      return (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={meta.tone}>
            {meta.label}
            {step.decidedAt && ` ${formatDay(step.decidedAt, today)}`}
          </Badge>
          {step.comment && <span className="text-[var(--color-text-muted)]">«{step.comment}»</span>}
        </p>
      );
    }
    if (!deadline) return null;
    if (step.delegatedToId) {
      return (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-[var(--color-text-muted)]">
          Передано: {nameOf(employeeById, step.delegatedToId)} замещает{" "}
          {nameOf(employeeById, step.approverId)}
          {canDelegate && (
            <Button size="sm" variant="ghost" onClick={() => onReturn(step)} disabled={isBusy}>
              Вернуть {nameOf(employeeById, step.approverId)}
            </Button>
          )}
        </p>
      );
    }
    if (deadline.risk === "none") {
      return (
        <p className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
          <Check className="size-3.5" aria-hidden />
          На месте в даты этапа
        </p>
      );
    }

    const tag = absence && <AbsenceTag type={absence.type} period={absence.period} />;

    if (deadline.risk === "waiting") {
      return (
        <div className="flex flex-col gap-1 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            {tag}
            <Badge tone="neutral" icon={Clock}>
              Ждёт выхода
            </Badge>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-[var(--color-text-muted)]">
            {deadline.dueIfWaiting
              ? `Срок сдвинут на выход: +${waitingDays} раб. дн.`
              : "Дата выхода неизвестна — срок посчитать нельзя"}
            {canDelegate && (
              <Button size="sm" variant="ghost" onClick={() => onWait(step, false)}>
                Не ждать
              </Button>
            )}
          </p>
        </div>
      );
    }

    const deputyId = issue?.deputyId ?? null;
    const lastDayBefore = absence ? shiftISODate(absence.period.start, -1) : null;
    const canWait = absence?.period.end !== null;

    return (
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          {tag}
          {deadline.risk === "absent_in_window" && lastDayBefore && (
            <span className="text-[var(--color-text-muted)]">
              пересекается с этапом — успеет, если согласует до {formatDay(lastDayBefore, today)}
            </span>
          )}
        </p>
        {deadline.resolution.chain.length > 2 && deputyId && (
          <p className="text-[var(--color-text-muted)]">
            Цепочка: {deadline.resolution.chain.map((id) => nameOf(employeeById, id)).join(" → ")}
          </p>
        )}
        {deputyId ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[var(--color-text-muted)]">Замещает</span>
            <PersonChip
              person={
                employeeById(deputyId) ?? { id: deputyId, fullName: "Сотрудник", position: "" }
              }
              variant="inline"
            />
            {canDelegate && (
              <span className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={isBusy}
                  onClick={() => onDelegate(step, deputyId)}
                >
                  Передать заместителю
                </Button>
                {absence?.period.start && absence.period.start <= deadline.start && canWait && (
                  <Button size="sm" variant="ghost" onClick={() => onWait(step, true)}>
                    Оставить
                  </Button>
                )}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3 py-2">
            <p className="flex items-center gap-1.5">
              <UserRoundX className="size-4 text-[var(--color-danger)]" aria-hidden />
              <span className="font-medium text-[var(--color-danger)]">Нет замещающего</span>
            </p>
            {canDelegate && (
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  aria-label={`Выбрать согласующего вместо ${nameOf(employeeById, step.approverId)}`}
                  value=""
                  onChange={(event) => event.target.value && onDelegate(step, event.target.value)}
                  className="h-7 text-sm"
                >
                  <option value="">Выбрать согласующего…</option>
                  {employees
                    .filter((e) => e.id !== step.approverId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} — {e.position}
                      </option>
                    ))}
                </Select>
                {canWait ? (
                  absence?.period.start &&
                  absence.period.start <= deadline.start && (
                    <Button size="sm" variant="ghost" onClick={() => onWait(step, true)}>
                      Ждать выхода
                      {deadline.dueIfWaiting && ` (до ${formatDay(deadline.dueIfWaiting, today)})`}
                    </Button>
                  )
                ) : (
                  <span className="text-[var(--color-text-muted)]">
                    Ждать нельзя — дата выхода неизвестна
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  })();

  return (
    <li
      className={cn("flex gap-3 px-4 py-3", isCurrent && "bg-[var(--color-info-bg)]")}
      aria-label={`${label}: ${approver?.fullName ?? ""}`}
      data-testid="route-step"
    >
      <span
        className={cn(
          "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums",
          step.status === "approved"
            ? "border-[var(--color-success)] text-[var(--color-success)]"
            : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]",
        )}
        aria-hidden
      >
        {index + 1}
      </span>

      <div className="grid min-w-0 flex-1 gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="flex min-w-0 flex-col gap-1.5">
          {approver && (
            <div className={cn(delegate && "opacity-60")}>
              <PersonChip person={approver} variant="row" />
            </div>
          )}
          {delegate && <PersonChip person={delegate} variant="row" />}
          {statusLine}
        </div>

        <div className="flex flex-col gap-1.5 md:items-end md:text-right">
          {canEdit ? (
            <DurationInput
              key={step.durationDays}
              value={step.durationDays}
              label={`Срок, ${label}`}
              onChange={(days) => onDuration(index, days)}
            />
          ) : null}
          {deadline && open && !beyond && (
            <DeadlineExplain
              start={deadline.start}
              due={deadline.due}
              durationDays={deadline.risk === "waiting" ? step.durationDays : deadline.durationDays}
              extraDaysOff={deadline.extraDaysOff}
              className="md:items-end"
            >
              {issue && (
                <Badge tone="warning" className="self-start md:self-end">
                  Риск срока
                </Badge>
              )}
            </DeadlineExplain>
          )}
          {deadline && open && beyond && (
            <p className="text-sm text-[var(--color-warning)]">
              Не можем посчитать дату: календарь на {deadline.due.slice(0, 4)} не загружен
            </p>
          )}
          {canEdit && (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`Выше, ${label}`}
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`Ниже, ${label}`}
                disabled={index === total - 1}
                onClick={() => onMove(index, 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`Удалить ${label}`}
                onClick={() => onRemove(index)}
              >
                <X aria-hidden />
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

export default RouteStep;
