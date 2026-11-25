import { CircleCheck, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import DeputyHint from "@/components/modules/DeputyHint/DeputyHint";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Badge from "@/components/ui/Badge/Badge";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import { ABSENCE_META } from "@/constants/absence";
import { buildPath, ROUTES } from "@/constants/routes";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { describeStatus, shortName } from "@/utils/availability";
import { formatDay } from "@/utils/date";
import type { IAbsentRow, ISoonRow } from "@/utils/today";

interface AbsentListProps {
  rows: IAbsentRow[];
  soon: ISoonRow[];
  date: ISODate;
  employeeById: (id: string) => IEmployee | undefined;
  /** Строка поиска — для текста «ничего не найдено» */
  query: string;
  onResetQuery: () => void;
  /** Ближайшее отсутствие — для «Все на месте» */
  next: { absence: IAbsence; employee: IEmployee } | null;
  /** Руководитель и HR могут назначить замещающего */
  canAssign: boolean;
}

/**
 * Кто отсутствует на дату: человек · тег «В отпуске до 9 дек.» · кто замещает.
 * Ниже — свёрнутая группа «Скоро отсутствуют».
 */
const AbsentList = ({
  rows,
  soon,
  date,
  employeeById,
  query,
  onResetQuery,
  next,
  canAssign,
}: AbsentListProps) => {
  const isFiltered = query.trim().length > 0;

  return (
    <div className="flex flex-col">
      {rows.length === 0 &&
        (isFiltered ? (
          <EmptyState
            icon={SearchX}
            title={`Никто с именем «${query.trim()}» сегодня не отсутствует`}
            description="Найти любого сотрудника — поиск в шапке (⌘K)"
            action={
              <Button variant="secondary" size="sm" onClick={onResetQuery}>
                Сбросить поиск
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={CircleCheck}
            title="Сегодня все на месте"
            description={
              next
                ? `Ближайшее отсутствие: ${shortName(next.employee.fullName)}, с ${formatDay(next.absence.period.start, date)}`
                : undefined
            }
            className="[&>svg]:text-[var(--color-success)]"
          />
        ))}

      {rows.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {rows.map(({ employee, status, noDeputy }) => {
            const view = describeStatus(status, date);
            return (
              <li
                key={employee.id}
                className="grid gap-x-4 gap-y-2 px-4 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,1.2fr)] md:items-center"
              >
                <PersonChip person={employee} date={date} />
                {view && (
                  <Badge tone={view.tone} icon={view.icon} className="self-start md:self-center">
                    {view.text}
                  </Badge>
                )}
                <DeputyHint
                  resolution={status.deputy}
                  employeeById={employeeById}
                  className={noDeputy ? "py-1.5" : undefined}
                  emptyAction={
                    canAssign && (
                      <Link
                        to={buildPath(ROUTES.EMPLOYEE, { id: employee.id })}
                        className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                      >
                        Назначить
                      </Link>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {soon.length > 0 && !isFiltered && (
        <details className="group px-4 pt-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            Скоро отсутствуют (7 дней): {soon.length}
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {soon.map(({ employee, absence }) => (
              <li
                key={employee.id}
                className="grid gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,1.2fr)] md:items-center"
              >
                <PersonChip person={employee} date={date} />
                <Badge tone="warning" icon={ABSENCE_META[absence.type].icon} className="self-start">
                  С {formatDay(absence.period.start, date)} —{" "}
                  {ABSENCE_META[absence.type].label.toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default AbsentList;
