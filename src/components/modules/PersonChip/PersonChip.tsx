import { Link } from "react-router-dom";
import Avatar from "@/components/ui/Avatar/Avatar";
import Badge from "@/components/ui/Badge/Badge";
import { TONE_CLASSES } from "@/constants/tones";
import { buildPath, ROUTES } from "@/constants/routes";
import type { IPersonStatus } from "@/types/availability.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { AVAILABLE_VIEW, describeStatus, shortName } from "@/utils/availability";
import { cn } from "@/utils/cn";
import { todayISO } from "@/utils/date";

type Person = Pick<IEmployee, "id" | "fullName" | "position">;

interface PersonChipProps {
  person: Person;
  /** Статус на дату; не передан — показываем только имя */
  status?: IPersonStatus;
  /** Кто замещает — уже найденный по status.deputy.actorId */
  deputy?: Person | null;
  variant?: "inline" | "row" | "card";
  showPosition?: boolean;
  /** Дата, на которую посчитан статус, — для формата «9 дек.» без года */
  date?: ISODate;
  /** Без ссылки на карточку (например, внутри другой ссылки или кнопки) */
  noLink?: boolean;
  className?: string;
}

/**
 * Главный компонент продукта: имя + статус доступности + кто замещает.
 * «Сотрудник в штате ≠ сотрудник, который может подписать сегодня».
 */
const PersonChip = ({
  person,
  status,
  deputy,
  variant = "row",
  showPosition = variant !== "inline",
  date = todayISO(),
  noLink = false,
  className,
}: PersonChipProps) => {
  const view = status ? describeStatus(status, date) : null;
  const isAbsent = status?.availability.status === "absent";
  const noDeputy =
    isAbsent && (status.deputy.status === "no_deputy" || status.deputy.status === "cycle");

  const name = variant === "inline" ? shortName(person.fullName) : person.fullName;
  const nameNode = noLink ? (
    <span className="font-medium">{name}</span>
  ) : (
    <Link
      to={buildPath(ROUTES.EMPLOYEE, { id: person.id })}
      className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline"
    >
      {name}
    </Link>
  );

  const deputyNode =
    isAbsent &&
    (noDeputy ? (
      <span className="text-[var(--color-danger)]">Нет замещающего</span>
    ) : (
      deputy && <span>Замещает {shortName(deputy.fullName)}</span>
    ));

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex flex-wrap items-baseline gap-x-1", className)}>
        {nameNode}
        {view && <span className={cn("text-sm", TONE_CLASSES[view.tone].fg)}>({view.text})</span>}
      </span>
    );
  }

  if (variant === "card") {
    const badge = view ?? (status ? AVAILABLE_VIEW : null);
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <Avatar name={person.fullName} size="lg" ring={view?.ring} soon={view?.soon} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-md">{nameNode}</span>
          {showPosition && (
            <span className="text-[var(--color-text-muted)]">{person.position}</span>
          )}
          {badge && (
            <Badge tone={badge.tone} icon={badge.icon} className="self-start">
              {badge.text}
            </Badge>
          )}
          {deputyNode && (
            <span className="text-sm text-[var(--color-text-muted)]">{deputyNode}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar name={person.fullName} size="md" ring={view?.ring} soon={view?.soon} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{nameNode}</span>
        {(view || (showPosition && person.position)) && (
          <span className="truncate text-sm text-[var(--color-text-muted)]">
            {view ? (
              <>
                <span className={TONE_CLASSES[view.tone].fg}>{view.text}</span>
                {deputyNode && <> · {deputyNode}</>}
              </>
            ) : (
              person.position
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default PersonChip;
