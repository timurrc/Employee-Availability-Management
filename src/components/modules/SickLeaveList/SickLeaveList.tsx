import { ChevronDown, HeartPulse, UserRoundX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import SickOverlap from "@/components/modules/SickOverlap/SickOverlap";
import Badge from "@/components/ui/Badge/Badge";
import Button from "@/components/ui/Button/Button";
import { buildPath, ROUTES } from "@/constants/routes";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { cn } from "@/utils/cn";
import { formatDay, formatPeriod } from "@/utils/date";
import {
  calendarDays,
  formatEln,
  type ISickOverlapView,
  type ISickRow,
  type IStepOnEmployee,
} from "@/utils/sickLeave";

interface SickLeaveListProps {
  rows: ISickRow[];
  today: ISODate;
  employeeById: (id: string) => IEmployee | undefined;
  stepsOf: (employeeId: string) => IStepOnEmployee[];
  /** Какой отпуск сейчас продлевается — спиннер в кнопке */
  busyVacationId: string | null;
  onExtend: (row: ISickRow) => void;
  onClose: (row: ISickRow) => void;
  onAssign: (row: ISickRow) => void;
  onExtendVacation: (row: ISickRow, overlap: ISickOverlapView) => void;
}

const STATUS_LABEL = { open: "Открыт", extended: "Продлён", closed: "Закрыт" } as const;

const Period = ({ row, today }: { row: ISickRow; today: ISODate }) => {
  const { period, status } = row.leave;
  if (status === "closed" && period.end) {
    return (
      <span>
        {formatPeriod(period, today)} · {calendarDays({ start: period.start, end: period.end })}{" "}
        календ. дн.
      </span>
    );
  }
  return (
    <span>
      {period.end === null ? `с ${formatDay(period.start, today)}` : formatPeriod(period, today)}
      {row.dayNumber !== null && ` · ${row.dayNumber}-й день`}
      {period.end === null ? (
        <span className="text-[var(--color-warning)]"> · выход неизвестен</span>
      ) : (
        status === "extended" && " (продлён)"
      )}
    </span>
  );
};

/**
 * Список больничных для HR. В строке — всё для решения: кто, сколько уже болеет,
 * ЭЛН, кто замещает, риски. Детали (история ЭЛН, документы) — по раскрытию.
 */
const SickLeaveList = ({
  rows,
  today,
  employeeById,
  stepsOf,
  busyVacationId,
  onExtend,
  onClose,
  onAssign,
  onExtendVacation,
}: SickLeaveListProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
      {rows.map((row) => {
        const { leave, employee } = row;
        const isOpen = leave.status !== "closed";
        const isExpanded = expanded === leave.id;
        const deputy =
          row.deputy.status === "deputy" && row.deputy.actorId
            ? employeeById(row.deputy.actorId)
            : undefined;
        const steps = stepsOf(employee.id);
        const detailsId = `sick-details-${leave.id}`;

        return (
          <li key={leave.id} className="flex flex-col gap-3 px-4 py-3" data-testid="sick-row">
            <div className="grid gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 flex-col">
                <PersonChip person={employee} variant="row" />
                {row.department && (
                  <span className="pl-10 text-sm text-[var(--color-text-muted)]">
                    {row.department.name}
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={isOpen ? "abs-sick" : "neutral"} icon={HeartPulse}>
                    {STATUS_LABEL[leave.status as keyof typeof STATUS_LABEL] ?? "Больничный"}
                  </Badge>
                  <Period row={row} today={today} />
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--color-text-muted)]">
                  {leave.elnNumber && (
                    <span>
                      ЭЛН <span className="font-mono">{formatEln(leave.elnNumber)}</span>
                    </span>
                  )}
                  {isOpen &&
                    (row.noDeputy ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--color-danger)]">
                        <UserRoundX className="size-4" aria-hidden />
                        Нет замещающего
                      </span>
                    ) : (
                      deputy && <span>Замещает {shortName(deputy.fullName)}</span>
                    ))}
                  {row.overlaps.length > 0 && (
                    <span className="font-medium text-[var(--color-warning)]">
                      Отпуск с {formatDay(row.overlaps[0]!.vacation.period.start, today)}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {isOpen && row.noDeputy && (
                  <Button size="sm" variant="secondary" onClick={() => onAssign(row)}>
                    Назначить
                  </Button>
                )}
                {isOpen && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => onExtend(row)}>
                      Продлить
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onClose(row)}>
                      Закрыть
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  aria-label={`Подробнее: ${employee.fullName}`}
                  onClick={() => setExpanded(isExpanded ? null : leave.id)}
                >
                  <ChevronDown
                    className={cn("transition-transform", isExpanded && "rotate-180")}
                    aria-hidden
                  />
                </Button>
              </div>
            </div>

            {row.overlaps.map((overlap) => (
              <SickOverlap
                key={overlap.vacation.id}
                leave={leave}
                overlap={overlap}
                today={today}
                isPending={busyVacationId === overlap.vacation.id}
                onExtend={(item) => onExtendVacation(row, item)}
              />
            ))}

            {isExpanded && (
              <div
                id={detailsId}
                className="grid gap-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-3 py-3 text-sm md:grid-cols-2"
              >
                <section className="flex flex-col gap-1.5">
                  <h3 className="font-medium">История листков</h3>
                  {(leave.elnHistory ?? []).length === 0 ? (
                    <p className="text-[var(--color-text-muted)]">Нет данных о продлениях</p>
                  ) : (
                    <ol className="flex flex-col gap-1">
                      {leave.elnHistory!.map((record) => (
                        <li key={record.number} className="flex flex-wrap gap-x-2">
                          <span className="font-mono">{formatEln(record.number)}</span>
                          <span className="text-[var(--color-text-muted)]">
                            {formatPeriod({ start: record.start, end: record.end }, today)}
                            {record.end === null && " · окончание неизвестно"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                <section className="flex flex-col gap-1.5">
                  <h3 className="font-medium">Документы на сотруднике</h3>
                  {steps.length === 0 ? (
                    <p className="text-[var(--color-text-muted)]">Этапов, которые ждут его, нет</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {steps.map(({ document, step }) => (
                        <li key={`${document.id}-${step.id}`}>
                          <Link
                            to={buildPath(ROUTES.DOCUMENT, { id: document.id })}
                            className="hover:text-[var(--color-primary)] hover:underline"
                          >
                            <span className="font-mono text-[var(--color-text-muted)]">
                              {document.number}
                            </span>{" "}
                            {document.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default SickLeaveList;
