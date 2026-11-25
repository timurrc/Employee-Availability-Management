import { UserPlus } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button/Button";
import Select from "@/components/ui/Select/Select";
import type { IPersonStatus } from "@/types/availability.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { describeStatus, shortName } from "@/utils/availability";

interface AddApproverProps {
  employees: IEmployee[];
  /** Уже в маршруте — не предлагаем */
  excludeIds: string[];
  /** Плановая дата старта нового этапа — статус показываем на неё */
  date: ISODate;
  statusOf: (employeeId: string, date: ISODate) => IPersonStatus;
  employeeById: (id: string) => IEmployee | undefined;
  onAdd: (employeeId: string) => void;
}

/**
 * Добавить согласующего. Отсутствующие не скрыты — в подписи статус на дату этапа
 * и кто замещает, чтобы выбрать осознанно.
 */
const AddApprover = ({
  employees,
  excludeIds,
  date,
  statusOf,
  employeeById,
  onAdd,
}: AddApproverProps) => {
  const [value, setValue] = useState("");

  const options = employees
    .filter((e) => !excludeIds.includes(e.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"))
    .map((employee) => {
      const status = statusOf(employee.id, date);
      const away = status.availability.status === "absent";
      const deputyId = status.deputy.status === "deputy" ? status.deputy.actorId : null;
      const deputy = deputyId ? employeeById(deputyId) : undefined;
      const note = away
        ? ` · ${describeStatus(status, date)?.text ?? "отсутствует"}${deputy ? ` · замещает ${shortName(deputy.fullName)}` : " · нет замещающего"}`
        : "";
      return { employee, note };
    });

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 sm:max-w-md">
        <Select
          label="Добавить согласующего"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">Выберите сотрудника</option>
          {options.map(({ employee, note }) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} — {employee.position}
              {note}
            </option>
          ))}
        </Select>
      </div>
      <Button
        variant="secondary"
        disabled={!value}
        onClick={() => {
          onAdd(value);
          setValue("");
        }}
      >
        <UserPlus aria-hidden />
        Добавить
      </Button>
    </div>
  );
};

export default AddApprover;
