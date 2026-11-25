import Alert from "@/components/ui/Alert/Alert";
import Button from "@/components/ui/Button/Button";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import { formatDay, formatDays, formatPeriod } from "@/utils/date";
import type { ISickOverlapView } from "@/utils/sickLeave";

interface SickOverlapProps {
  leave: IAbsence;
  overlap: ISickOverlapView;
  today: ISODate;
  isPending?: boolean;
  onExtend: (overlap: ISickOverlapView) => void;
}

/**
 * Больничный пришёлся на отпуск (ст. 124 ТК РФ): отпуск продлевается на эти дни
 * или переносится. Пока больничный открыт, точное число дней неизвестно — продлить нельзя.
 */
const SickOverlap = ({ leave, overlap, today, isPending, onExtend }: SickOverlapProps) => {
  const vacation = overlap.vacation.period;
  return (
    <Alert
      tone="warning"
      title={
        overlap.isOpen
          ? `Больничный ${formatPeriod(leave.period, today)} пересекается с отпуском ${formatPeriod(vacation, today)} минимум на ${formatDays(overlap.minDays, "calendar")} (больничный открыт)`
          : `Больничный ${formatPeriod(leave.period, today)} пересекается с отпуском ${formatPeriod(vacation, today)} на ${formatDays(overlap.daysToMove, "calendar")}${overlap.alreadyExtended ? ` (уже продлён на ${overlap.alreadyExtended})` : ""}`
      }
      actions={
        overlap.extendedEnd ? (
          <Button size="sm" isLoading={isPending} onClick={() => onExtend(overlap)}>
            Продлить отпуск до {formatDay(overlap.extendedEnd, today)}
          </Button>
        ) : (
          <span className="text-sm text-[var(--color-text-muted)]">
            «Продлить отпуск» станет доступно после закрытия больничного
          </span>
        )
      }
    >
      По ст. 124 ТК РФ отпуск продлевается на эти дни или переносится по согласованию с сотрудником.
    </Alert>
  );
};

export default SickOverlap;
