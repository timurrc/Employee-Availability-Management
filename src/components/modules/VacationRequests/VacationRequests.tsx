import { Palmtree } from "lucide-react";
import AbsenceTag from "@/components/modules/AbsenceTag/AbsenceTag";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu/ActionMenu";
import Badge from "@/components/ui/Badge/Badge";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import { eachISODate, type CalendarIndex } from "@/core/calendar";
import { vacationDuration } from "@/core/absence";
import { ABSENCE_STATUS_META } from "@/constants/absence";
import type { IAbsence } from "@/types/absence.types";
import type { IClosedPeriod, ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { cn } from "@/utils/cn";
import { formatPeriod } from "@/utils/date";
import { canCancel } from "@/utils/vacation";

interface VacationRequestsProps {
  requests: IAbsence[];
  calendar: CalendarIndex;
  today: ISODate;
  employeeById: (id: string) => IEmployee | undefined;
  /** Кто согласует заявки этого сотрудника */
  managerId: string | null;
  /** Заявка, по которой сейчас идёт действие — строка полупрозрачная */
  busyId: string | null;
  onEdit: (absence: IAbsence) => void;
  onCancel: (absence: IAbsence) => void;
  onDelete: (absence: IAbsence) => void;
  onCreate: () => void;
}

const daysOf = (calendar: CalendarIndex, absence: IAbsence) => {
  if (!absence.period.end) return null;
  const period = absence.period as IClosedPeriod;
  return absence.type === "vacation"
    ? vacationDuration(calendar, period).chargeableDays
    : eachISODate(period.start, period.end).length;
};

/** «Мои заявки»: тип, период, дни, заместитель, статус; у отклонённой — причина и «Изменить даты» */
const VacationRequests = ({
  requests,
  calendar,
  today,
  employeeById,
  managerId,
  busyId,
  onEdit,
  onCancel,
  onDelete,
  onCreate,
}: VacationRequestsProps) => {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Palmtree}
        title="Заявок пока нет"
        description="Выберите даты — дни с учётом праздников и конфликты в команде посчитаются сразу."
        action={<Button onClick={onCreate}>Новая заявка</Button>}
      />
    );
  }

  const manager = managerId ? employeeById(managerId) : undefined;

  return (
    <ul className="flex flex-col divide-y divide-[var(--color-border)]" aria-label="Мои заявки">
      {requests.map((absence) => {
        const status = ABSENCE_STATUS_META[absence.status];
        const deputy = absence.deputyId ? employeeById(absence.deputyId) : undefined;
        const days = daysOf(calendar, absence);
        const items: ActionMenuItem[] = [
          ...(absence.status === "draft"
            ? [{ label: "Удалить", onSelect: () => onDelete(absence), danger: true }]
            : []),
          ...(canCancel(absence, today)
            ? [{ label: "Отменить заявку", onSelect: () => onCancel(absence) }]
            : []),
        ];
        return (
          <li
            key={absence.id}
            aria-busy={busyId === absence.id || undefined}
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
              busyId === absence.id && "opacity-50",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <AbsenceTag
                  type={absence.type}
                  pending={absence.status === "pending" || absence.status === "draft"}
                />
                <span className="font-medium">{formatPeriod(absence.period, today)}</span>
                {days !== null && (
                  <span className="text-[var(--color-text-muted)]">· {days} дн.</span>
                )}
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {deputy ? `Зам. ${shortName(deputy.fullName)}` : "Заместитель — постоянный"}
                {absence.comment && ` · «${absence.comment}»`}
              </p>
              {absence.status === "rejected" && absence.decision?.reason && (
                <p className="text-sm">
                  <span className="text-[var(--color-text-muted)]">Причина отказа: </span>«
                  {absence.decision.reason}»
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-0.5">
                <Badge tone={status.tone}>{status.label}</Badge>
                {absence.status === "pending" && manager && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    согласует {shortName(manager.fullName)}
                  </span>
                )}
              </div>
              {absence.status === "rejected" && (
                <Button variant="secondary" size="sm" onClick={() => onEdit(absence)}>
                  Изменить даты
                </Button>
              )}
              {absence.status === "draft" && (
                <Button variant="secondary" size="sm" onClick={() => onEdit(absence)}>
                  Продолжить
                </Button>
              )}
              <ActionMenu
                items={items}
                label={`Действия с заявкой ${formatPeriod(absence.period, today)}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default VacationRequests;
