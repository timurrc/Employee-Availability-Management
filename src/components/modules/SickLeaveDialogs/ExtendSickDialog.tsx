import { useState } from "react";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/Input";
import Modal from "@/components/ui/Modal/Modal";
import type { IAbsence, IExtendSickLeaveDto } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import { formatPeriod } from "@/utils/date";
import { formatEln } from "@/utils/sickLeave";

interface ExtendSickDialogProps {
  leave: IAbsence;
  /** «Иванов П.» */
  name: string;
  today: ISODate;
  isPending: boolean;
  /** Ошибка сервера — показываем в диалоге, данные не теряются */
  error?: string;
  onConfirm: (dto: IExtendSickLeaveDto) => void;
  onClose: () => void;
}

/** Продление: новый ЭЛН (если выдан) и новая ожидаемая дата — или «Неизвестна» */
const ExtendSickDialog = ({
  leave,
  name,
  today,
  isPending,
  error,
  onConfirm,
  onClose,
}: ExtendSickDialogProps) => {
  const [eln, setEln] = useState("");
  const [unknown, setUnknown] = useState(leave.period.end === null);
  const [end, setEnd] = useState(leave.period.end ?? "");
  const [touched, setTouched] = useState(false);

  const digits = eln.replace(/\s/g, "");
  const elnError = digits && !/^\d{12}$/.test(digits) ? "Номер ЭЛН — 12 цифр" : undefined;
  const endError = unknown
    ? undefined
    : !end
      ? "Укажите дату или «Неизвестна»"
      : end < leave.period.start
        ? "Окончание раньше начала"
        : undefined;

  const submit = () => {
    setTouched(true);
    if (elnError || endError) return;
    onConfirm({ end: unknown ? null : end, elnNumber: digits || undefined });
  };

  return (
    <Modal
      title="Продлить больничный"
      description={`${name} · ${formatPeriod(leave.period, today)}${leave.elnNumber ? ` · ЭЛН ${formatEln(leave.elnNumber)}` : ""}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="extend-sick-form" isLoading={isPending}>
            Продлить
          </Button>
        </>
      }
    >
      <form
        id="extend-sick-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          label="Новый номер ЭЛН (если выдан)"
          inputMode="numeric"
          placeholder="0000 0000 0000"
          className="font-mono"
          data-autofocus
          value={eln}
          onChange={(event) => setEln(event.target.value)}
          error={touched ? elnError : undefined}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-[var(--color-text-muted)]">
            Ожидаемая дата окончания
          </legend>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-primary)]"
              checked={unknown}
              onChange={(event) => setUnknown(event.target.checked)}
            />
            Неизвестна
          </label>
          {!unknown && (
            <Input
              type="date"
              aria-label="Дата окончания"
              min={leave.period.start}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              error={touched ? endError : undefined}
            />
          )}
        </fieldset>
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </form>
    </Modal>
  );
};

export default ExtendSickDialog;
