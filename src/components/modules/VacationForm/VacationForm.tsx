import { format } from "date-fns";
import { ru } from "date-fns/locale/ru";
import { CircleCheck, RotateCw } from "lucide-react";
import { useState } from "react";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Alert from "@/components/ui/Alert/Alert";
import Button from "@/components/ui/Button/Button";
import DateRangePicker from "@/components/ui/DateRangePicker/DateRangePicker";
import Input from "@/components/ui/Input/Input";
import Modal from "@/components/ui/Modal/Modal";
import SegmentedControl from "@/components/ui/SegmentedControl/SegmentedControl";
import Select from "@/components/ui/Select/Select";
import Textarea from "@/components/ui/Textarea/Textarea";
import { fromISODate, getDay } from "@/core/calendar";
import { ABSENCE_META } from "@/constants/absence";
import { REQUEST_TYPES } from "@/constants/vacation";
import { shortName } from "@/utils/availability";
import { cn } from "@/utils/cn";
import { formatDay, formatDays, formatPeriod, plural } from "@/utils/date";
import { formatBalance } from "@/utils/vacation";
import { useVacationForm, type IVacationFormInit, type PeriodMode } from "./useVacationForm";

interface VacationFormProps {
  init: IVacationFormInit;
  onClose: () => void;
}

const MODES: { value: PeriodMode; label: string }[] = [
  { value: "range", label: "С — по" },
  { value: "length", label: "Начало + дни" },
];

const BLOCK =
  "flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3";

/**
 * Шит «Новая заявка на отпуск» — docs/design/screens/03-vacations.md.
 * Блоки расчёта, конфликтов и заместителя появляются, когда выбран период.
 */
const VacationForm = ({ init, onClose }: VacationFormProps) => {
  const f = useVacationForm(init, onClose);
  const { form, period, calc, issues, today } = f;
  const { register, formState } = form;
  const [lengthStart, setLengthStart] = useState(period?.start ?? "");
  const [length, setLength] = useState(14);

  const periodError = formState.errors.period?.message ?? issues?.errors[0];
  const deputyPerson = f.deputyId ? f.employeeById(f.deputyId) : undefined;
  const fallback = f.deputy?.fallbackId ? f.employeeById(f.deputy.fallbackId) : undefined;

  const footer = (
    <div className="flex w-full flex-col items-stretch gap-1.5 sm:items-end">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => void f.saveDraft()}
          disabled={!period || f.hasErrors || f.isPending}
        >
          Сохранить черновик
        </Button>
        <Button
          onClick={() => void f.send()}
          disabled={!period || f.hasErrors}
          isLoading={f.isPending}
        >
          Отправить руководителю
        </Button>
      </div>
      <p className="text-right text-sm text-[var(--color-text-muted)]">
        {!period
          ? "Выберите период"
          : f.manager
            ? `Согласует ${shortName(f.manager.fullName)}`
            : "Руководитель не назначен"}
      </p>
    </div>
  );

  return (
    <>
      <Modal
        title={f.isDraft ? "Черновик заявки" : "Новая заявка на отпуск"}
        placement="right"
        onClose={f.requestClose}
        footer={footer}
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void f.send();
          }}
          className="flex flex-col gap-5"
        >
          <fieldset className="flex flex-col gap-2" disabled={f.isPending}>
            <legend className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Тип</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {REQUEST_TYPES.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    value={option.value}
                    {...register("type", { onChange: () => f.setSplitUnpaid(false) })}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <section className="flex flex-col gap-3" aria-label="Период">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)]">Период</h3>
              <SegmentedControl
                label="Как задать период"
                value={f.mode}
                options={MODES}
                onChange={f.setMode}
              />
            </div>
            {f.mode === "range" ? (
              <DateRangePicker
                key={f.pickerKey}
                value={period ?? null}
                onChange={(range) => f.setPeriod(range)}
                min={today}
                dayInfo={(date) => {
                  const day = getDay(f.calendar, date);
                  return { kind: day.kind, note: day.note };
                }}
              />
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                <Input
                  label="Начало"
                  type="date"
                  min={today}
                  value={lengthStart}
                  onChange={(event) => {
                    setLengthStart(event.target.value);
                    f.setByLength(event.target.value, length);
                  }}
                />
                <Input
                  label="Календарных дней"
                  type="number"
                  min={1}
                  max={365}
                  value={length}
                  className="w-28"
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setLength(value);
                    f.setByLength(lengthStart, value);
                  }}
                  hint={f.type === "vacation" ? "Праздники внутри продлят отпуск" : undefined}
                />
              </div>
            )}
            {periodError && (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {periodError}
                {issues && issues.errors.length > 1 && ` (и ещё ${issues.errors.length - 1})`}
              </p>
            )}
          </section>

          {period && calc && (
            <>
              {f.missingYears.length > 0 && (
                <Alert tone="warning">
                  Календарь на {f.missingYears.join(", ")} не загружен — праздники не учтены.
                </Alert>
              )}

              <section className={BLOCK} aria-label="Расчёт" aria-live="polite">
                {f.type === "vacation" ? (
                  <p className="text-md font-semibold">
                    {f.days} {plural(f.days, ["день", "дня", "дней"])} спишется с баланса
                    {f.summary && (
                      <span className="font-normal text-[var(--color-text-muted)]">
                        {" "}
                        → останется{" "}
                        {formatBalance(Math.round((f.summary.available - f.days) * 100) / 100)} дн.
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-md font-semibold">
                    {formatDays(f.days, "calendar", true)}
                    <span className="font-normal text-[var(--color-text-muted)]">
                      {" "}
                      · {ABSENCE_META[f.type].label.toLowerCase()}
                    </span>
                  </p>
                )}
                <p>
                  Окончание {formatDay(period.end, today)}, выход на работу{" "}
                  {formatDay(calc.returnDate, today)} (
                  {format(fromISODate(calc.returnDate), "EEEEEE", { locale: ru })})
                </p>
                {calc.notes.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {formatDays(calc.duration.calendarDays, "calendar", true)}, праздников нет
                  </p>
                ) : (
                  <details open={calc.duration.holidays.length > 0} className="text-sm">
                    <summary className="cursor-pointer text-[var(--color-primary)]">
                      Почему {formatDay(period.end, today)}
                    </summary>
                    <ul className="mt-1.5 flex flex-col gap-1 text-[var(--color-text-muted)]">
                      {calc.notes.map((note) => (
                        <li key={note.period.start}>
                          <span className="text-[var(--color-text)]">
                            {formatPeriod(note.period, today)}
                          </span>{" "}
                          — {note.text}.
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>

              {f.type === "vacation" && issues && issues.shortage > 0 && f.summary && (
                <Alert
                  tone="warning"
                  title={`Не хватает ${issues.shortage} дн.: доступно ${formatBalance(f.summary.available)}, нужно ${f.days}`}
                  actions={
                    f.summary.available >= 1 && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => f.shortenTo(Math.floor(f.summary!.available))}
                        >
                          Сократить до {Math.floor(f.summary.available)}
                        </Button>
                        <Button
                          variant={f.splitUnpaid ? "ghost" : "secondary"}
                          size="sm"
                          aria-pressed={f.splitUnpaid}
                          onClick={() => f.setSplitUnpaid(!f.splitUnpaid)}
                        >
                          Оформить {issues.shortage} дн. без сохранения
                        </Button>
                      </>
                    )
                  }
                >
                  {f.split ? (
                    <>
                      Будет две заявки: отпуск {formatPeriod(f.split.paid, today)} и без сохранения{" "}
                      {formatPeriod(f.split.unpaid, today)}.
                    </>
                  ) : (
                    "Отправить можно — решает руководитель."
                  )}
                </Alert>
              )}

              {issues?.longPart && (
                <Alert tone={issues.longPart.level}>{issues.longPart.message}</Alert>
              )}

              {f.conflict && f.department && (
                <Alert
                  tone="warning"
                  title={`${f.department.name}: ${f.conflict.ranges
                    .map((range) => formatPeriod(range, today))
                    .join(
                      ", ",
                    )} будет доступно ${f.conflict.worst.available} из ${f.conflict.worst.total} (${f.conflict.worst.percent}%), порог ${f.conflict.worst.threshold}%`}
                >
                  {f.conflict.others.length > 0 && (
                    <p>
                      Тоже отсутствуют:{" "}
                      {f.conflict.others.map((absence, index) => {
                        const person = f.employeeById(absence.employeeId);
                        return (
                          <span key={absence.id}>
                            {index > 0 && "; "}
                            {person && (
                              <PersonChip person={person} variant="inline" noLink date={today} />
                            )}{" "}
                            — {ABSENCE_META[absence.type].label.toLowerCase()}{" "}
                            {formatPeriod(absence.period, today)}
                            {absence.status === "pending" && " (на согласовании)"}
                          </span>
                        );
                      })}
                    </p>
                  )}
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Руководитель увидит это предупреждение. Отправить можно.
                  </p>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <Select label="Заместитель" {...register("deputyId")} disabled={f.isPending}>
                  <option value="">— не назначен —</option>
                  {f.colleagues.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                      {person.id === f.me?.deputyId ? " — постоянный" : ""}
                    </option>
                  ))}
                </Select>
                {f.deputy?.status === "ok" && (
                  <p className="flex items-center gap-1.5 text-sm text-[var(--color-success)]">
                    <CircleCheck className="size-4" aria-hidden />
                    На месте в эти даты
                  </p>
                )}
                {f.deputy?.status === "absent" && f.deputy.absence && deputyPerson && (
                  <Alert tone="warning">
                    {shortName(deputyPerson.fullName)} —{" "}
                    {ABSENCE_META[f.deputy.absence.type].label.toLowerCase()}{" "}
                    {formatPeriod(f.deputy.absence.period, today)}.{" "}
                    {fallback
                      ? `Выберите другого или замещение пойдёт к ${shortName(fallback.fullName)} (цепочка).`
                      : "Выберите другого — иначе в эти дни замещать будет некому."}
                  </Alert>
                )}
                {f.deputy?.status === "none" && (
                  <Alert tone="danger">
                    Нет замещающего — документы будут ждать вашего выхода.
                  </Alert>
                )}
              </div>

              <Textarea
                label="Комментарий"
                placeholder="Необязательно: для руководителя"
                error={formState.errors.comment?.message}
                disabled={f.isPending}
                {...register("comment")}
              />
            </>
          )}

          {f.sendError && (
            <Alert
              tone="danger"
              title="Не удалось отправить заявку"
              actions={
                <Button variant="secondary" size="sm" onClick={() => void f.retry()}>
                  <RotateCw aria-hidden />
                  Повторить
                </Button>
              }
            >
              {f.sendError}. Данные в форме не потеряны.
            </Alert>
          )}
        </form>
      </Modal>

      {f.confirmClose && (
        <Modal
          title="Сохранить черновик?"
          onClose={f.cancelClose}
          footer={
            <>
              <Button variant="secondary" onClick={f.closeWithoutSaving}>
                Не сохранять
              </Button>
              <Button onClick={f.saveAndClose} data-autofocus>
                Сохранить
              </Button>
            </>
          }
        >
          <p className={cn("text-[var(--color-text-muted)]")}>
            Заявка не отправлена. Черновик останется в списке «Мои отпуска» — его можно отправить
            позже.
          </p>
        </Modal>
      )}
    </>
  );
};

export default VacationForm;
