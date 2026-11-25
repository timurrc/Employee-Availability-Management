import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AbsenceTag from "@/components/modules/AbsenceTag/AbsenceTag";
import DeputyHint from "@/components/modules/DeputyHint/DeputyHint";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Badge from "@/components/ui/Badge/Badge";
import { eachISODate } from "@/core/calendar";
import { ABSENCE_META, ABSENCE_STATUS_META } from "@/constants/absence";
import { buildPath, ROUTES } from "@/constants/routes";
import type { IAbsence } from "@/types/absence.types";
import type { IPersonStatus } from "@/types/availability.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee, Role } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { formatDays, formatPeriod } from "@/utils/date";

const WIDTH = 320;
const GAP = 6;
const EDGE = 8;

interface AbsenceCardProps {
  absence: IAbsence;
  /** Элемент, по которому кликнули: к нему крепится карточка и возвращается фокус */
  anchor: HTMLElement;
  onClose: () => void;
  employeeById: (id: string) => IEmployee | undefined;
  statusOf: (employeeId: string, date: ISODate) => IPersonStatus;
  viewer: { id: string; role: Role } | null;
  today: ISODate;
}

const LINK = "text-sm font-medium text-[var(--color-primary)] hover:underline";

/**
 * Поповер «Карточка отсутствия»: тип, период, статус, кто замещает, комментарий.
 * Решения (согласовать, продлить) — в своих разделах, сюда ведут ссылки.
 */
const AbsenceCard = ({
  absence,
  anchor,
  onClose,
  employeeById,
  statusOf,
  viewer,
  today,
}: AbsenceCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const employee = employeeById(absence.employeeId);
  const meta = ABSENCE_META[absence.type];
  const status = ABSENCE_STATUS_META[absence.status];
  const isPending = absence.status === "pending" || absence.status === "draft";

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const height = ref.current?.offsetHeight ?? 0;
    const below = rect.bottom + GAP;
    const top =
      below + height > window.innerHeight - EDGE ? Math.max(EDGE, rect.top - GAP - height) : below;
    const left = Math.min(Math.max(EDGE, rect.left), window.innerWidth - WIDTH - EDGE);
    setPosition({ top, left });
    ref.current?.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    // Esc и «Закрыть» возвращают фокус на ячейку; клик мимо — нет (фокус ушёл туда, куда кликнули)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      anchor.focus();
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [anchor, onClose]);

  // Кто замещает: по факту на сегодня (или на первый день), а у заявки — кто назначен
  const checkDate = absence.period.start > today ? absence.period.start : today;
  const deputy = statusOf(absence.employeeId, checkDate).deputy;
  const plannedDeputyId = absence.deputyId ?? employee?.deputyId ?? null;
  const plannedDeputy = plannedDeputyId ? employeeById(plannedDeputyId) : undefined;

  const length =
    absence.period.end === null
      ? "дата выхода неизвестна"
      : formatDays(eachISODate(absence.period.start, absence.period.end).length, "calendar");

  const isAuthor = viewer?.id === absence.employeeId;
  const action =
    viewer?.role === "manager" && absence.status === "pending" ? (
      <Link to={ROUTES.VACATIONS} className={LINK}>
        Разобрать заявку
      </Link>
    ) : (viewer?.role === "hr" || viewer?.role === "admin") && absence.type === "sick" ? (
      <Link to={ROUTES.SICK_LEAVES} className={LINK}>
        К больничным
      </Link>
    ) : isAuthor && absence.type !== "sick" ? (
      <Link to={ROUTES.VACATIONS} className={LINK}>
        Мои заявки
      </Link>
    ) : null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${meta.label}${employee ? `: ${employee.fullName}` : ""}`}
      tabIndex={-1}
      className="fixed z-50 flex w-80 flex-col gap-3 rounded-[var(--radius-lg)] bg-[var(--color-elevated)] p-4 shadow-[var(--shadow-pop)] outline-none"
      // Геометрия поповера зависит от позиции ячейки — классами не выразить
      style={position ?? { top: -9999, left: -9999 }}
    >
      <div className="flex items-start justify-between gap-2">
        <AbsenceTag type={absence.type} pending={isPending} />
        <button
          type="button"
          onClick={() => {
            onClose();
            anchor.focus();
          }}
          aria-label="Закрыть"
          className="-m-1 cursor-pointer rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {employee && <PersonChip person={employee} date={today} />}

      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-[var(--color-text-muted)]">Период</dt>
        <dd>
          {formatPeriod(absence.period, today)} · {length}
        </dd>
        <dt className="text-[var(--color-text-muted)]">Статус</dt>
        <dd>
          <Badge tone={status.tone}>{status.label}</Badge>
        </dd>
        {absence.elnNumber && (viewer?.role === "hr" || viewer?.role === "admin") && (
          <>
            <dt className="text-[var(--color-text-muted)]">ЭЛН</dt>
            <dd className="font-mono">{absence.elnNumber}</dd>
          </>
        )}
        {absence.comment && (
          <>
            <dt className="text-[var(--color-text-muted)]">Комментарий</dt>
            <dd>{absence.comment}</dd>
          </>
        )}
      </dl>

      {deputy.status !== "self" ? (
        <DeputyHint resolution={deputy} employeeById={employeeById} className="text-sm" />
      ) : (
        <p className="text-sm">
          <span className="text-[var(--color-text-muted)]">Заместитель: </span>
          {plannedDeputy ? (
            shortName(plannedDeputy.fullName)
          ) : (
            <span className="text-[var(--color-warning)]">не назначен</span>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
        {employee && (
          <Link to={buildPath(ROUTES.EMPLOYEE, { id: employee.id })} className={LINK}>
            Профиль сотрудника
          </Link>
        )}
        {action}
      </div>
    </div>
  );
};

export default AbsenceCard;
