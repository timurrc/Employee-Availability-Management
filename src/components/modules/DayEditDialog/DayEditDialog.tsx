import { format } from "date-fns";
import { ru } from "date-fns/locale/ru";
import { useState } from "react";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/Input";
import Modal from "@/components/ui/Modal/Modal";
import { fromISODate } from "@/core/calendar";
import type { DayKind, ICalendarDay, ISetCalendarDayDto } from "@/types/calendar.types";
import { cn } from "@/utils/cn";

interface DayEditDialogProps {
  day: ICalendarDay;
  isPending: boolean;
  onApply: (dto: ISetCalendarDayDto) => void;
  onClose: () => void;
}

const KINDS: { value: DayKind; label: string }[] = [
  { value: "holiday", label: "Праздник" },
  { value: "weekend", label: "Выходной" },
  { value: "workday", label: "Рабочий" },
];

/**
 * Правка дня (админ): тип, «сокращённый» (только у рабочего), примечание.
 * Перенос не выбирается вручную — он следует из типа: выходной в будни, рабочий в сб/вс.
 */
const DayEditDialog = ({ day, isPending, onApply, onClose }: DayEditDialogProps) => {
  const [kind, setKind] = useState<DayKind>(day.kind);
  const [isShortened, setShortened] = useState(day.isShortened);
  const [note, setNote] = useState(day.note ?? "");
  const canShorten = kind === "workday";
  const title = format(fromISODate(day.date), "EEEEEE, d MMMM yyyy", { locale: ru });

  return (
    <Modal
      title={title[0]!.toUpperCase() + title.slice(1)}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            isLoading={isPending}
            onClick={() => onApply({ kind, isShortened: canShorten && isShortened, note })}
          >
            Применить
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-[var(--color-text-muted)]">Тип</legend>
        <div className="flex flex-wrap gap-4">
          {KINDS.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="day-kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                data-autofocus={kind === option.value ? true : undefined}
                className="size-4 accent-[var(--color-primary)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label
        className={cn(
          "flex items-center gap-2",
          canShorten ? "cursor-pointer" : "cursor-not-allowed text-[var(--color-text-subtle)]",
        )}
        title={canShorten ? undefined : "Сокращённым бывает только рабочий день"}
      >
        <input
          type="checkbox"
          checked={canShorten && isShortened}
          disabled={!canShorten}
          onChange={(event) => setShortened(event.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        Сокращённый (−1 ч)
      </label>
      <Input
        label="Примечание"
        value={note}
        placeholder="Например, День защитника Отечества"
        onChange={(event) => setNote(event.target.value)}
      />
    </Modal>
  );
};

export default DayEditDialog;
