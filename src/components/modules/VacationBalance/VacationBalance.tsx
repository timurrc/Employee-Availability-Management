import Alert from "@/components/ui/Alert/Alert";
import Card from "@/components/ui/Card/Card";
import { MIN_VACATION_PART } from "@/core/absence";
import type { ISODate } from "@/types/common.types";
import { cn } from "@/utils/cn";
import { formatDay } from "@/utils/date";
import { formatBalance, type IVacationSummary } from "@/utils/vacation";

interface VacationBalanceProps {
  summary: IVacationSummary;
  today: ISODate;
  /** Карточка сотрудника: только «Доступно» и «использовано из 28» */
  compact?: boolean;
  className?: string;
}

/** Баланс ежегодного отпуска — один и тот же блок на «Отпусках» и в карточке сотрудника */
const VacationBalance = ({ summary, today, compact = false, className }: VacationBalanceProps) => {
  const isOver = summary.available < 0;
  const value = (
    <p className={cn("text-lg font-semibold", isOver && "text-[var(--color-danger)]")}>
      {isOver
        ? `Перерасход ${formatBalance(-summary.available)} дн.`
        : `${formatBalance(summary.available)} дн. доступно`}
    </p>
  );

  if (compact) {
    return (
      <Card title="Отпуск" className={className}>
        {value}
        <p className="text-sm text-[var(--color-text-muted)]">
          использовано {summary.used}, запланировано {summary.planned} из {summary.annual}
        </p>
      </Card>
    );
  }

  return (
    <Card title={`Баланс на ${formatDay(today, today)}`} className={className}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          {value}
          <p className="text-sm text-[var(--color-text-muted)]">
            Использовано {summary.used} · Запланировано {summary.planned} · Год {summary.annual}
          </p>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-primary)]">Как считается</summary>
          <p className="mt-1.5 text-[var(--color-text-muted)]">
            {summary.annual} дн. в год / 12 = 2,33 дн. за каждый месяц рабочего года (с{" "}
            {formatDay(summary.year.start, today)}). Начислено {formatBalance(summary.accrued)} дн.
            {summary.carryover > 0 && `, из них ${summary.carryover} — остаток прошлых лет`}. Из
            начисленного вычитаются использованные дни и заявки на согласовании.
          </p>
        </details>
        {!summary.hasLongPart && (
          <Alert tone="warning">
            Одна из частей отпуска должна быть не меньше {MIN_VACATION_PART} дней (ст. 125 ТК РФ) —
            в этом рабочем году такой ещё не было.
          </Alert>
        )}
      </div>
    </Card>
  );
};

export default VacationBalance;
