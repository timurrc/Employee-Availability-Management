import { format } from "date-fns";
import { ru } from "date-fns/locale/ru";
import { Copy } from "lucide-react";
import AbsenceTag from "@/components/modules/AbsenceTag/AbsenceTag";
import Alert from "@/components/ui/Alert/Alert";
import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import Input from "@/components/ui/Input/Input";
import SegmentedControl from "@/components/ui/SegmentedControl/SegmentedControl";
import Select from "@/components/ui/Select/Select";
import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";
import { fromISODate, shiftISODate } from "@/core/calendar";
import type { ISODate } from "@/types/common.types";
import { shortName } from "@/utils/availability";
import { formatDay, formatDays, formatPeriod } from "@/utils/date";
import { CALC_MODES } from "@/utils/deadlineCalc";
import { formatHours } from "@/utils/productionCalendar";
import { useDeadlinesPage } from "./useDeadlinesPage";

const weekday = (date: ISODate) => format(fromISODate(date), "EEEEEE", { locale: ru });
const fullDate = (date: ISODate) => {
  const text = format(fromISODate(date), "d MMMM yyyy, EEEE", { locale: ru });
  return text;
};

/** Калькулятор сроков — docs/design/screens/08-deadline-calculator.md */
const DeadlinesPage = () => {
  const page = useDeadlinesPage();
  const { add, between, today } = page;

  const absenceBlock = (() => {
    const info = page.withAbsence;
    if (!info) return null;
    const { plain, waiting } = info;
    const person = page.employeeById(plain.approverId);
    const name = person ? shortName(person.fullName) : "сотрудник";
    if (plain.risk === "none") {
      return <Alert tone="success">{name} на месте весь срок.</Alert>;
    }
    const deputyId = plain.resolution.status === "deputy" ? plain.resolution.actorId : null;
    const deputy = deputyId ? page.employeeById(deputyId) : undefined;
    const absence = plain.absence;
    return (
      <Alert
        tone="warning"
        title={
          absence ? (
            <span className="flex flex-wrap items-center gap-2">
              {name}: <AbsenceTag type={absence.type} period={absence.period} />
            </span>
          ) : (
            name
          )
        }
      >
        {plain.risk === "absent_in_window" && absence && (
          <p>
            Уйдёт до окончания срока — успеет, если всё сделает до{" "}
            {formatDay(shiftISODate(absence.period.start, -1), today)}
          </p>
        )}
        {waiting && (
          <p>
            {waiting.dueIfWaiting
              ? `Если ждать выхода — ${formatDay(waiting.dueIfWaiting, today)}`
              : "Дата выхода неизвестна — посчитать с учётом отсутствия нельзя."}
          </p>
        )}
        {deputy ? (
          <p>
            Или передать {shortName(deputy.fullName)} — {formatDay(plain.due, today)}
          </p>
        ) : (
          plain.risk !== "absent_in_window" && <p>Замещающего нет.</p>
        )}
      </Alert>
    );
  })();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-[-0.01em]">Сроки</h1>
      <SegmentedControl
        label="Режим"
        value={page.mode}
        options={CALC_MODES}
        onChange={page.setMode}
        className="self-start"
      />

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex flex-col gap-1">
              <Input
                type="date"
                label="От"
                value={page.from}
                onChange={(event) => page.setFrom(event.target.value)}
                error={page.fromError ?? undefined}
              />
            </div>
            {page.mode === "add" ? (
              <Input
                type="number"
                label="Рабочих дней (+/−)"
                value={page.daysRaw}
                min={-365}
                max={365}
                onChange={(event) => page.setDays(event.target.value)}
                error={page.nError ?? undefined}
                className="w-32"
              />
            ) : (
              <Input
                type="date"
                label="До"
                value={page.to}
                onChange={(event) => page.setTo(event.target.value)}
                error={page.toError ?? undefined}
              />
            )}
            {page.mode === "add" && (
              <div className="min-w-64">
                <Select
                  label="Учитывать отсутствие"
                  value={page.employeeId}
                  onChange={(event) => page.setEmployeeId(event.target.value)}
                  hint="Исполнитель — необязательно"
                >
                  <option value="">— никого —</option>
                  {page.employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          {page.fromInfo && page.mode === "add" && (
            <p className="text-sm text-[var(--color-text-muted)]">
              {page.fromInfo.isWorking
                ? `${formatDay(page.from, today)} — рабочий день.`
                : `${formatDay(page.from, today)} — нерабочий${page.fromInfo.note ? ` (${page.fromInfo.note})` : ""}: отсчёт начнётся с ${formatDay(page.fromInfo.firstWorking, today)}.`}
            </p>
          )}
        </div>
      </Card>

      {page.missing.length > 0 && (
        <Alert tone="warning">
          Календарь на {page.missing.join(", ")} не загружен — праздники не учтены, результат
          посчитан по выходным и может быть неточным.
        </Alert>
      )}

      {page.isLoading ? (
        <div role="status" aria-label="Загрузка">
          <Delayed>
            <Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
          </Delayed>
        </div>
      ) : add ? (
        <Card title="Результат">
          <div className="flex flex-col gap-3" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold" data-testid="calc-result">
                {fullDate(add.result)}
              </p>
              <Button variant="secondary" size="sm" onClick={page.copy}>
                <Copy aria-hidden />
                Копировать
              </Button>
            </div>
            <p className="text-[var(--color-text-muted)]">
              {formatDays(Math.abs(Number(page.daysRaw)), "working", true)} ={" "}
              {formatDays(add.calendarDays, "calendar", true)}
            </p>
            {absenceBlock}
            <details open={add.hasSpecial} className="group">
              <summary className="cursor-pointer text-sm font-medium text-[var(--color-primary)]">
                Разбор
              </summary>
              {!add.hasSpecial && (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Праздников и переносов нет, только выходные.
                </p>
              )}
              <ol
                className="mt-2 flex flex-col gap-0.5 text-sm tabular-nums"
                aria-label="Разбор по дням"
              >
                {add.items.map((item) =>
                  item.kind === "work" ? (
                    <li key={item.date} className="flex gap-2">
                      <span className="w-40 shrink-0">
                        {formatDay(item.date, today)} {weekday(item.date)}
                      </span>
                      <span className="font-medium">№ {item.number}</span>
                      <span className="text-[var(--color-text-muted)]">
                        рабочий{item.isShortened && ", сокращённый"}
                      </span>
                    </li>
                  ) : (
                    <li key={item.start} className="flex gap-2 text-[var(--color-text-muted)]">
                      <span className="w-40 shrink-0">
                        {formatPeriod({ start: item.start, end: item.end }, today)}
                      </span>
                      <span>— нерабочие: {item.reason}</span>
                    </li>
                  ),
                )}
              </ol>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Отсчёт со следующего дня после даты «От».
              </p>
            </details>
          </div>
        </Card>
      ) : between ? (
        <Card title="Результат">
          <div className="flex flex-col gap-3" aria-live="polite">
            <p className="text-lg font-semibold" data-testid="calc-result">
              {formatDays(between.workingDays, "working", true)} · {formatHours(between.hours)}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Обе даты включительно
              {between.shortened.length > 0 &&
                ` · с учётом сокращённых: ${between.shortened.map((d) => formatDay(d, today)).join(", ")}`}
            </p>
            <table className="w-full max-w-md text-sm tabular-nums">
              <caption className="sr-only">По месяцам</caption>
              <thead className="text-left text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    Месяц
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Раб. дней
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Часов
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {between.byMonth.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="py-1 text-left font-normal">
                      {row.label}
                    </th>
                    <td className="py-1 text-right">{row.workingDays}</td>
                    <td className="py-1 text-right">{formatHours(row.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
};

export default DeadlinesPage;
