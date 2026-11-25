import { useState } from "react";
import { toast } from "sonner";
import Button from "@/components/ui/Button/Button";
import Modal from "@/components/ui/Modal/Modal";
import Select from "@/components/ui/Select/Select";
import { deputyCycle } from "@/core/availability";
import { useSetDeputy } from "@/hooks/useEmployees";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";

interface DeputyDialogProps {
  employee: IEmployee;
  employees: IEmployee[];
  onClose: () => void;
}

/**
 * Постоянный заместитель. Варианты, которые замкнут цепочку замещений, недоступны
 * с объяснением: «создаст цикл: Смирнов → Егорова». Сначала — коллеги по отделу.
 */
const DeputyDialog = ({ employee, employees, onClose }: DeputyDialogProps) => {
  const mutation = useSetDeputy();
  const [deputyId, setDeputyId] = useState(employee.deputyId ?? "");
  const nameOf = (id: string) => {
    const person = employees.find((e) => e.id === id);
    return person ? shortName(person.fullName) : id;
  };

  const candidates = employees
    .filter((e) => e.id !== employee.id)
    .map((e) => ({ person: e, cycle: deputyCycle(employees, employee.id, e.id) }))
    .sort(
      (a, b) =>
        Number(b.person.departmentId === employee.departmentId) -
          Number(a.person.departmentId === employee.departmentId) ||
        a.person.fullName.localeCompare(b.person.fullName, "ru"),
    );

  const save = async () => {
    try {
      await mutation.mutateAsync({ id: employee.id, deputyId: deputyId || null });
      toast.success(
        deputyId
          ? `${shortName(employee.fullName)}: заместитель — ${nameOf(deputyId)}`
          : `${shortName(employee.fullName)}: постоянный заместитель снят`,
      );
      onClose();
    } catch {
      // Ошибка показывается в диалоге — mutation.error
    }
  };

  return (
    <Modal
      title="Постоянный заместитель"
      description={`${employee.fullName} · ${employee.position}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={deputyId === (employee.deputyId ?? "")}
            onClick={() => void save()}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Select
        label="Заместитель"
        data-autofocus
        value={deputyId}
        onChange={(event) => setDeputyId(event.target.value)}
        hint="Замещает при любом отсутствии, если на период не назначен другой"
        error={mutation.error?.message}
      >
        <option value="">Не назначен</option>
        {candidates.map(({ person, cycle }) => (
          <option key={person.id} value={person.id} disabled={cycle !== null}>
            {person.fullName} — {person.position}
            {cycle && ` (создаст цикл: ${cycle.map(nameOf).join(" → ")})`}
          </option>
        ))}
      </Select>
      {!deputyId && (
        <p className="text-sm text-[var(--color-warning)]">
          Без заместителя документы на сотруднике будут ждать его возвращения.
        </p>
      )}
    </Modal>
  );
};

export default DeputyDialog;
