import Alert from "@/components/ui/Alert/Alert";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/Input";
import Modal from "@/components/ui/Modal/Modal";
import Select from "@/components/ui/Select/Select";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { formatPeriod, plural } from "@/utils/date";
import { useSickLeaveForm } from "./useSickLeaveForm";

interface SickLeaveFormProps {
  onClose: () => void;
  /** Назначить постоянного заместителя прямо из формы (нет заместителя) */
  onAssignDeputy: (employee: IEmployee) => void;
  /** Предвыбранный сотрудник */
  employeeId?: string;
}

/** Шит «Открыть больничный» — docs/design/screens/04-sick-leaves.md */
const SickLeaveForm = ({ onClose, onAssignDeputy, employeeId }: SickLeaveFormProps) => {
  const sheet = useSickLeaveForm(onClose, employeeId);
  const { form, impact, employee, today } = sheet;
  const { errors } = form.formState;
  const startIssue = sheet.issues.find((issue) => issue.field === "start");

  return (
    <Modal
      title="Открыть больничный"
      placement="right"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="sick-leave-form"
            isLoading={sheet.isPending}
            disabled={Boolean(sheet.blocking)}
          >
            Открыть больничный
          </Button>
        </>
      }
    >
      <form
        id="sick-leave-form"
        noValidate
        onSubmit={(event) => void sheet.onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Select
          label="Сотрудник"
          data-autofocus
          error={errors.employeeId?.message}
          {...form.register("employeeId")}
        >
          <option value="">Выберите сотрудника</option>
          {sheet.employees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName} — {person.position}
            </option>
          ))}
        </Select>

        <Input
          type="date"
          label="Начало"
          error={errors.start?.message ?? startIssue?.message}
          {...form.register("start")}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-[var(--color-text-muted)]">
            Окончание
          </legend>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-primary)]"
              {...form.register("endUnknown")}
            />
            Дата окончания неизвестна
          </label>
          {!sheet.endUnknown && (
            <Input
              type="date"
              aria-label="Дата окончания"
              error={errors.end?.message}
              {...form.register("end")}
            />
          )}
        </fieldset>

        <Input
          label="Номер ЭЛН"
          inputMode="numeric"
          placeholder="0000 0000 0000"
          hint="12 цифр"
          className="font-mono"
          error={errors.elnNumber?.message}
          {...form.register("elnNumber")}
        />

        {impact && employee && (
          <section className="flex flex-col gap-2" aria-label="Что это задевает">
            <h3 className="text-sm font-medium text-[var(--color-text-muted)]">Что это задевает</h3>
            {impact.vacations.map((vacation) => (
              <Alert
                key={vacation.id}
                tone="warning"
                title={`Согласованный отпуск ${formatPeriod(vacation.period, today)} пересекается или скоро начнётся`}
              >
                Если больничный придётся на отпуск, отпуск нужно продлить или перенести (ст. 124 ТК
                РФ). Решение — при закрытии больничного.
              </Alert>
            ))}
            {impact.steps.length > 0 && (
              <Alert
                tone="info"
                title={`${impact.steps.length} ${plural(impact.steps.length, ["этап", "этапа", "этапов"])} документов ${plural(impact.steps.length, ["ждёт", "ждут", "ждут"])} ${shortName(employee.fullName)}`}
              >
                <ul className="flex flex-col">
                  {impact.steps.map(({ document, step }) => (
                    <li key={`${document.id}-${step.id}`}>
                      <span className="font-mono text-sm">{document.number}</span> {document.title}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Инициаторам будет предложено передать их заместителю.
                </p>
              </Alert>
            )}
            {impact.deputy ? (
              impact.vacations.length === 0 &&
              impact.steps.length === 0 && (
                <Alert tone="success">
                  Пересечений нет, заместитель — {shortName(impact.deputy.fullName)}
                </Alert>
              )
            ) : (
              <Alert
                tone="danger"
                title="Постоянного заместителя нет"
                actions={
                  <Button size="sm" variant="secondary" onClick={() => onAssignDeputy(employee)}>
                    Назначить
                  </Button>
                }
              >
                Документы на {shortName(employee.fullName)} будут ждать.
              </Alert>
            )}
            {impact.deputy && (impact.vacations.length > 0 || impact.steps.length > 0) && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Замещает {shortName(impact.deputy.fullName)} (постоянный заместитель)
              </p>
            )}
          </section>
        )}

        {sheet.sendError && (
          <Alert tone="danger" title="Не удалось сохранить — повторите">
            {sheet.sendError}. Данные в форме не потеряны.
          </Alert>
        )}
      </form>
    </Modal>
  );
};

export default SickLeaveForm;
