import { useState } from "react";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/Input";
import Modal from "@/components/ui/Modal/Modal";
import type { CalendarIndex } from "@/core/calendar";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import { formatDay, formatDays, formatPeriod } from "@/utils/date";
import { calendarDays, overlapsOnClose } from "@/utils/sickLeave";

export type CloseOverlap = ReturnType<typeof overlapsOnClose>[number];

interface CloseSickDialogProps {
  leave: IAbsence;
  name: string;
  calendar: CalendarIndex;
  absences: IAbsence[];
  today: ISODate;
  isPending: boolean;
  error?: string;
  /** Дата окончания и отпуска, которые продлить сразу (ст. 124) */
  onConfirm: (end: ISODate, extend: CloseOverlap[]) => void;
  onClose: () => void;
}

/**
 * Закрытие больничного — с последствиями: итог в календарных днях и предложение
 * продлить пересёкшийся отпуск (чекбокс включён по умолчанию).
 */
const CloseSickDialog = ({
  leave,
  name,
  calendar,
  absences,
  today,
  isPending,
  error,
  onConfirm,
  onClose,
}: CloseSickDialogProps) => {
  const initial = leave.period.start > today ? leave.period.start : today;
  const [end, setEnd] = useState(initial);
  /** id отпусков, которые НЕ продлевать (по умолчанию продлеваем все) */
  const [skipped, setSkipped] = useState<string[]>([]);

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= leave.period.start;
  const overlaps = isValid ? overlapsOnClose(calendar, leave, absences, end) : [];

  return (
    <Modal
      title="Закрыть больничный"
      description={name}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="close-sick-form" isLoading={isPending} disabled={!isValid}>
            Закрыть больничный
          </Button>
        </>
      }
    >
      <form
        id="close-sick-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid) return;
          onConfirm(
            end,
            overlaps.filter((item) => !skipped.includes(item.vacation.id)),
          );
        }}
      >
        <Input
          type="date"
          label="Дата окончания"
          data-autofocus
          min={leave.period.start}
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          error={isValid ? undefined : "Не раньше начала больничного"}
        />
        {isValid && (
          <p>
            Больничный {formatPeriod({ start: leave.period.start, end }, today)},{" "}
            {formatDays(calendarDays({ start: leave.period.start, end }), "calendar", true)}
          </p>
        )}
        {overlaps.map((item) => (
          <label
            key={item.vacation.id}
            className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3 py-2.5"
          >
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--color-primary)]"
              checked={!skipped.includes(item.vacation.id)}
              onChange={(event) =>
                setSkipped((prev) =>
                  event.target.checked
                    ? prev.filter((id) => id !== item.vacation.id)
                    : [...prev, item.vacation.id],
                )
              }
            />
            <span>
              Отпуск {formatPeriod(item.vacation.period, today)} продлить на{" "}
              {formatDays(item.remaining, "calendar")} — до {formatDay(item.extendedEnd, today)}{" "}
              <span className="text-sm text-[var(--color-text-muted)]">(ст. 124 ТК РФ)</span>
            </span>
          </label>
        ))}
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </form>
    </Modal>
  );
};

export default CloseSickDialog;
