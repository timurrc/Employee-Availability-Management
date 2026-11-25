import { UserRoundX } from "lucide-react";
import type { ReactNode } from "react";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import type { IDeputyResolution } from "@/core/availability";
import type { IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { cn } from "@/utils/cn";

interface DeputyHintProps {
  resolution: IDeputyResolution;
  employeeById: (id: string) => IEmployee | undefined;
  /** Действие при найденном заместителе: «Передать» */
  action?: ReactNode;
  /** Действие, когда замещать некому: «Выбрать» */
  emptyAction?: ReactNode;
  className?: string;
}

const nameOf = (employeeById: DeputyHintProps["employeeById"], id: string) => {
  const employee = employeeById(id);
  return employee ? shortName(employee.fullName) : "сотрудник";
};

/**
 * Кто замещает. Цепочка A → B → C объясняется: «(Смирнов тоже отсутствует)».
 * Нет замещающего и цикл — явное danger-состояние с действием «Выбрать».
 */
const DeputyHint = ({
  resolution,
  employeeById,
  action,
  emptyAction,
  className,
}: DeputyHintProps) => {
  if (resolution.status === "self") return null;

  if (resolution.status === "no_deputy" || resolution.status === "cycle") {
    const reason =
      resolution.status === "cycle"
        ? `замещения по кругу: ${resolution.chain.map((id) => nameOf(employeeById, id)).join(" → ")}`
        : resolution.chain.length > 1
          ? `${resolution.chain
              .slice(1)
              .map((id) => nameOf(employeeById, id))
              .join(
                ", ",
              )} тоже ${resolution.chain.length > 2 ? "отсутствуют" : "отсутствует"}, дальше замещать некому`
          : "заместитель не назначен";
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3 py-2",
          className,
        )}
      >
        <UserRoundX className="size-4 shrink-0 text-[var(--color-danger)]" aria-hidden />
        <p className="flex-1">
          <span className="font-medium text-[var(--color-danger)]">Нет замещающего</span>
          <span className="text-[var(--color-text-muted)]"> — {reason}</span>
        </p>
        {emptyAction}
      </div>
    );
  }

  const deputy = resolution.actorId ? employeeById(resolution.actorId) : undefined;
  const skipped = resolution.chain.slice(1, -1);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <p className="flex flex-1 flex-wrap items-baseline gap-x-1">
        <span className="text-[var(--color-text-muted)]">Замещает:</span>
        {deputy ? <PersonChip person={deputy} variant="inline" /> : <span>сотрудник</span>}
        {skipped.length > 0 && (
          <span className="text-sm text-[var(--color-text-muted)]">
            ({skipped.map((id) => nameOf(employeeById, id)).join(", ")} тоже{" "}
            {skipped.length > 1 ? "отсутствуют" : "отсутствует"})
          </span>
        )}
      </p>
      {action}
    </div>
  );
};

export default DeputyHint;
