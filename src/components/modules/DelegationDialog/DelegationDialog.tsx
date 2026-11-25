import { useState } from "react";
import { toast } from "sonner";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/Input";
import Modal from "@/components/ui/Modal/Modal";
import Select from "@/components/ui/Select/Select";
import { useCreateDelegation } from "@/hooks/useDelegations";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { formatPeriod } from "@/utils/date";

interface DelegationDialogProps {
  employee: IEmployee;
  employees: IEmployee[];
  /** Кто назначает — руководитель или HR */
  createdById: string;
  today: ISODate;
  /** Период по умолчанию — например, текущее отсутствие */
  initial?: { start: ISODate; end: ISODate };
  onClose: () => void;
}

/** «Назначить на период»: ручное замещение важнее постоянного заместителя и цепочки */
const DelegationDialog = ({
  employee,
  employees,
  createdById,
  today,
  initial,
  onClose,
}: DelegationDialogProps) => {
  const mutation = useCreateDelegation();
  const [toId, setToId] = useState("");
  const [start, setStart] = useState(initial?.start ?? today);
  const [end, setEnd] = useState(initial?.end ?? today);
  const [touched, setTouched] = useState(false);

  const toError = toId ? undefined : "Выберите, кто замещает";
  const endError = end && start && end >= start ? undefined : "Окончание раньше начала";

  const save = async () => {
    setTouched(true);
    if (toError || endError) return;
    try {
      await mutation.mutateAsync({
        fromId: employee.id,
        toId,
        period: { start, end },
        documentTypes: [],
        createdById,
      });
      const deputy = employees.find((e) => e.id === toId);
      toast.success(
        `${deputy ? shortName(deputy.fullName) : "Сотрудник"} замещает ${shortName(employee.fullName)} ${formatPeriod({ start, end }, today)}`,
      );
      onClose();
    } catch {
      // Ошибка в диалоге — mutation.error
    }
  };

  const colleagues = employees
    .filter((e) => e.id !== employee.id)
    .sort(
      (a, b) =>
        Number(b.departmentId === employee.departmentId) -
          Number(a.departmentId === employee.departmentId) ||
        a.fullName.localeCompare(b.fullName, "ru"),
    );

  return (
    <Modal
      title="Назначить замещение на период"
      description={employee.fullName}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button isLoading={mutation.isPending} onClick={() => void save()}>
            Назначить
          </Button>
        </>
      }
    >
      <Select
        label="Кто замещает"
        data-autofocus
        value={toId}
        onChange={(event) => setToId(event.target.value)}
        error={touched ? toError : undefined}
      >
        <option value="">Выберите сотрудника</option>
        {colleagues.map((person) => (
          <option key={person.id} value={person.id}>
            {person.fullName} — {person.position}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input
          type="date"
          label="С"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        <Input
          type="date"
          label="По"
          min={start}
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          error={touched ? endError : undefined}
        />
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        На эти даты документы {shortName(employee.fullName)} пойдут выбранному сотруднику, даже если
        назначен постоянный заместитель.
      </p>
      {mutation.error && (
        <p className="text-sm text-[var(--color-danger)]">{mutation.error.message}</p>
      )}
    </Modal>
  );
};

export default DelegationDialog;
