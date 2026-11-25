import { CheckCircle, ChevronDown, CircleCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import AbsenceTag from "@/components/modules/AbsenceTag/AbsenceTag";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import TeamTimeline from "@/components/modules/TeamTimeline/TeamTimeline";
import Badge from "@/components/ui/Badge/Badge";
import Button from "@/components/ui/Button/Button";
import CoverageMeter from "@/components/ui/CoverageMeter/CoverageMeter";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import { shiftISODate, type CalendarIndex } from "@/core/calendar";
import { ABSENCE_META, ABSENCE_STATUS_META } from "@/constants/absence";
import { ROUTES } from "@/constants/routes";
import { QUEUE_TIMELINE_PADDING_DAYS } from "@/constants/vacation";
import type { IAbsence } from "@/types/absence.types";
import type { IPersonStatus } from "@/types/availability.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { cn } from "@/utils/cn";
import { formatPeriod } from "@/utils/date";
import { timelineColumns, timelineCoverage, timelineGroups } from "@/utils/timeline";
import { formatBalance, type IQueueRow, type IVacationSummary } from "@/utils/vacation";

interface ApprovalQueueProps {
  rows: IQueueRow[];
  decided: IAbsence[];
  calendar: CalendarIndex;
  employees: IEmployee[];
  absences: IAbsence[];
  today: ISODate;
  busyId: string | null;
  employeeById: (id: string) => IEmployee | undefined;
  statusOf: (employeeId: string, date: ISODate) => IPersonStatus;
  summaryOf: (employee: IEmployee) => IVacationSummary;
  onApprove: (row: IQueueRow) => void;
  onApproveMany: (rows: IQueueRow[]) => void;
  onReject: (row: IQueueRow) => void;
}

const noop = () => {};

/** Раскрытая строка: мини-таймлайн отдела на период ± 3 дня, комментарий, баланс */
const RowDetails = ({
  row,
  calendar,
  employees,
  absences,
  today,
  summary,
}: {
  row: IQueueRow;
  calendar: CalendarIndex;
  employees: IEmployee[];
  absences: IAbsence[];
  today: ISODate;
  summary: IVacationSummary;
}) => {
  const end = row.absence.period.end ?? row.absence.period.start;
  const period = {
    start: shiftISODate(row.absence.period.start, -QUEUE_TIMELINE_PADDING_DAYS),
    end: shiftISODate(end, QUEUE_TIMELINE_PADDING_DAYS),
  };
  const columns = timelineColumns(calendar, period);
  const groups = row.department
    ? timelineGroups([row.department], employees).map((group) => ({
        ...group,
        coverage: timelineCoverage(columns, group.department, employees, absences),
      }))
    : [];

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      {groups.length > 0 && (
        <TeamTimeline
          columns={columns}
          groups={groups}
          absences={absences.filter(
            (a) => a.status !== "rejected" && a.status !== "cancelled" && a.status !== "draft",
          )}
          scale="2w"
          today={today}
          query=""
          onOpenAbsence={noop}
          onEmptyCell={noop}
        />
      )}
      <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-[var(--color-text-muted)]">Комментарий</dt>
        <dd>{row.absence.comment ? `«${row.absence.comment}»` : "—"}</dd>
        {row.absence.type === "vacation" && (
          <>
            <dt className="text-[var(--color-text-muted)]">Баланс</dt>
            <dd>
              {formatBalance(summary.available)} дн. доступно с учётом этой заявки
              {summary.available < 0 && (
                <span className="text-[var(--color-danger)]"> — не хватает дней</span>
              )}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
};

/**
 * Очередь руководителя: всё для решения в одной строке — человек, период, заместитель,
 * минимальное покрытие отдела, если согласовать. Ниже порога — сверху и без пакетного выбора.
 */
const ApprovalQueue = ({
  rows,
  decided,
  calendar,
  employees,
  absences,
  today,
  busyId,
  employeeById,
  statusOf,
  summaryOf,
  onApprove,
  onApproveMany,
  onReject,
}: ApprovalQueueProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const picked = rows.filter((row) => selected.includes(row.absence.id) && !row.isBelow);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="Все заявки разобраны"
          action={
            <Link
              to={ROUTES.TEAM}
              className="font-medium text-[var(--color-primary)] hover:underline"
            >
              Открыть календарь команды
            </Link>
          }
        />
      ) : (
        <>
          {picked.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4">
              <span className="text-sm text-[var(--color-text-muted)]">
                Выбрано {picked.length}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  onApproveMany(picked);
                  setSelected([]);
                }}
              >
                Согласовать выбранные ({picked.length})
              </Button>
            </div>
          )}
          <ul
            className="flex flex-col divide-y divide-[var(--color-border)]"
            aria-label="Заявки на согласовании"
          >
            {rows.map((row) => {
              const { absence, employee, deputy, minCoverage } = row;
              const deputyPerson = deputy.deputyId ? employeeById(deputy.deputyId) : undefined;
              const isBusy = busyId === absence.id;
              const isOpen = expanded === absence.id;
              const subject = `${shortName(employee.fullName)}, ${formatPeriod(absence.period, today)}`;
              return (
                <li
                  key={absence.id}
                  aria-busy={isBusy || undefined}
                  className={cn(isBusy && "opacity-60")}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-primary)] disabled:cursor-not-allowed"
                      aria-label={`Выбрать: ${subject}`}
                      title={row.isBelow ? "Ниже порога покрытия — решите отдельно" : undefined}
                      disabled={row.isBelow}
                      checked={selected.includes(absence.id)}
                      onChange={(event) =>
                        setSelected((prev) =>
                          event.target.checked
                            ? [...prev, absence.id]
                            : prev.filter((id) => id !== absence.id),
                        )
                      }
                    />
                    <div className="flex min-w-56 flex-1 flex-col gap-1">
                      <PersonChip person={employee} variant="inline" date={today} />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <AbsenceTag type={absence.type} pending />
                        <span>
                          {formatPeriod(absence.period, today)} · {row.days} дн.
                        </span>
                      </div>
                    </div>
                    <div className="flex min-w-40 flex-col gap-0.5 text-sm">
                      <span className="text-[var(--color-text-muted)]">Заместитель</span>
                      {deputy.status === "none" ? (
                        <span className="text-[var(--color-danger)]">не назначен</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          {deputyPerson ? shortName(deputyPerson.fullName) : "—"}
                          {deputy.status === "ok" ? (
                            <CircleCheck
                              className="size-3.5 text-[var(--color-success)]"
                              aria-label="на месте"
                            />
                          ) : (
                            deputy.absence && (
                              <span className="flex items-center gap-1 text-[var(--color-warning)]">
                                <TriangleAlert className="size-3.5" aria-hidden />
                                {ABSENCE_META[deputy.absence.type].label.toLowerCase()}
                              </span>
                            )
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-40 flex-col gap-0.5">
                      {minCoverage && row.department ? (
                        <CoverageMeter
                          available={minCoverage.available}
                          total={minCoverage.total}
                          threshold={minCoverage.threshold}
                          label={`Покрытие ${row.department.name}, если согласовать`}
                        />
                      ) : (
                        <span className="text-sm text-[var(--color-text-muted)]">—</span>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Button size="sm" isLoading={isBusy} onClick={() => onApprove(row)}>
                        Согласовать
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => onReject(row)}
                      >
                        Отклонить
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={isOpen ? `Свернуть: ${subject}` : `Подробнее: ${subject}`}
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(isOpen ? null : absence.id)}
                      >
                        <ChevronDown
                          className={cn("transition-transform", isOpen && "rotate-180")}
                          aria-hidden
                        />
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <RowDetails
                      row={row}
                      calendar={calendar}
                      employees={employees}
                      absences={absences}
                      today={today}
                      summary={summaryOf(employee)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {decided.length > 0 && (
        <details className="px-4 pb-4">
          <summary className="cursor-pointer text-sm font-medium text-[var(--color-text-muted)]">
            Решены сегодня · {decided.length}
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {decided.map((absence) => {
              const person = employeeById(absence.employeeId);
              const status = ABSENCE_STATUS_META[absence.status];
              return (
                <li key={absence.id} className="flex flex-wrap items-center gap-2 text-sm">
                  {person && (
                    <PersonChip
                      person={person}
                      status={statusOf(person.id, today)}
                      variant="inline"
                      date={today}
                    />
                  )}
                  <span>{formatPeriod(absence.period, today)}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {absence.decision?.reason && (
                    <span className="text-[var(--color-text-muted)]">
                      «{absence.decision.reason}»
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
};

export default ApprovalQueue;
