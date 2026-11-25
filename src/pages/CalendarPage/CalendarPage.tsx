import {
  ArrowLeftRight,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
} from "lucide-react";
import CalendarImportDialog from "@/components/modules/CalendarImportDialog/CalendarImportDialog";
import DayEditDialog from "@/components/modules/DayEditDialog/DayEditDialog";
import ProductionCalendarGrid from "@/components/modules/ProductionCalendarGrid/ProductionCalendarGrid";
import Alert from "@/components/ui/Alert/Alert";
import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import ErrorState from "@/components/ui/ErrorState/ErrorState";
import SegmentedControl from "@/components/ui/SegmentedControl/SegmentedControl";
import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";
import { formatHours, PERIOD_TABS, WEEK_HOURS } from "@/utils/productionCalendar";
import { useCalendarPage } from "./useCalendarPage";

const LoadingState = () => (
  <div role="status" aria-label="Загрузка" className="flex flex-col gap-4">
    <Delayed>
      <Skeleton className="h-28 w-full rounded-[var(--radius-lg)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-[var(--radius-lg)]" />
        ))}
      </div>
    </Delayed>
  </div>
);

const Legend = () => (
  <ul
    className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--color-text-muted)]"
    aria-label="Легенда"
  >
    <li className="flex items-center gap-1.5">
      <span
        className="size-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)]"
        aria-hidden
      />
      рабочий
    </li>
    <li className="flex items-center gap-1.5">
      <span
        className="size-4 rounded-[var(--radius-sm)] bg-[var(--color-cal-weekend-bg)]"
        aria-hidden
      />
      выходной
    </li>
    <li className="flex items-center gap-1.5">
      <span
        className="size-4 rounded-[var(--radius-sm)] bg-[var(--color-cal-holiday-bg)]"
        aria-hidden
      />
      праздник
    </li>
    <li className="flex items-center gap-1.5">
      <span className="text-xs text-[var(--color-warning)]" aria-hidden>
        −1
      </span>
      сокращённый (−1 ч)
    </li>
    <li className="flex items-center gap-1.5">
      <ArrowLeftRight className="size-3" aria-hidden />
      перенос
    </li>
    <li className="flex items-center gap-1.5">
      <span
        className="size-4 rounded-[var(--radius-sm)] ring-2 ring-[var(--color-cal-today)] ring-inset"
        aria-hidden
      />
      сегодня
    </li>
  </ul>
);

/** Производственный календарь — docs/design/screens/05-production-calendar.md */
const CalendarPage = () => {
  const page = useCalendarPage();
  const { summary } = page;

  const content = page.isLoading ? (
    <LoadingState />
  ) : page.isNotLoaded ? (
    <EmptyState
      icon={CalendarX2}
      title={`Календарь на ${page.year} не загружен`}
      description="Пока он не загружен, сроки считаются только по выходным."
      action={
        page.isAdmin ? (
          <Button onClick={page.openImport}>
            <Upload aria-hidden />
            Импорт JSON
          </Button>
        ) : (
          <span className="text-[var(--color-text-muted)]">Обратитесь к администратору</span>
        )
      }
    />
  ) : page.error || !page.data || !page.calendar || !summary ? (
    <ErrorState
      what="производственный календарь"
      reason={page.error?.message}
      onRetry={page.refetch}
    />
  ) : (
    <>
      <p className="-mt-3 text-[var(--color-text-muted)]">Основание: {page.data.source}</p>

      <Card title={`Сводка ${page.year}`}>
        <div className="flex flex-col gap-4">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Рабочих дней</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {summary.workingDays}
                {!summary.mismatch && summary.expected !== undefined && (
                  <span className="ml-1 text-sm font-normal text-[var(--color-success)]">
                    ✓ как в постановлении
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Выходных и праздничных</dt>
              <dd className="text-lg font-semibold tabular-nums">{summary.daysOff}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Норма 40-ч недели</dt>
              <dd
                className="text-lg font-semibold tabular-nums"
                title={`36 ч: ${formatHours(summary.hours[36])}, 24 ч: ${formatHours(summary.hours[24])}`}
              >
                {formatHours(summary.hours[40])}
              </dd>
            </div>
          </dl>
          {summary.mismatch && (
            <Alert tone="warning">
              Проверьте: {summary.workingDays} рабочих дней, по постановлению — {summary.expected}.
            </Alert>
          )}
          <SegmentedControl
            label="Период"
            value={page.period}
            options={PERIOD_TABS}
            onChange={page.setPeriod}
            className="self-start"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Нормы рабочего времени</caption>
              <thead className="text-left text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    {page.period === "year" ? "Квартал" : "Месяц"}
                  </th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                    Календ. дни
                  </th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                    Рабочие
                  </th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                    Выходные
                  </th>
                  {WEEK_HOURS.map((week) => (
                    <th key={week} scope="col" className="py-1.5 pr-3 text-right font-medium">
                      Норма {week} ч
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] tabular-nums">
                {page.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      {row.label}
                    </th>
                    <td className="py-1.5 pr-3 text-right">{row.calendarDays}</td>
                    <td className="py-1.5 pr-3 text-right">{row.workingDays}</td>
                    <td className="py-1.5 pr-3 text-right">{row.daysOff}</td>
                    {WEEK_HOURS.map((week) => (
                      <td key={week} className="py-1.5 pr-3 text-right">
                        {formatHours(row.hours[week])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <ProductionCalendarGrid
        year={page.data}
        calendar={page.calendar}
        today={page.today}
        onDayClick={page.startEdit}
      />
      <Legend />
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Производственный календарь</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Предыдущий год" onClick={page.prevYear}>
            <ChevronLeft aria-hidden />
          </Button>
          <span
            className="min-w-12 text-center text-md font-semibold tabular-nums"
            aria-live="polite"
          >
            {page.year}
          </span>
          <Button variant="ghost" size="icon" aria-label="Следующий год" onClick={page.nextYear}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {page.isAdmin && (
            <Button variant="secondary" onClick={page.openImport}>
              <Upload aria-hidden />
              Импорт JSON
            </Button>
          )}
          {page.data && (
            <Button variant="secondary" onClick={page.exportYear}>
              <Download aria-hidden />
              Экспорт
            </Button>
          )}
        </div>
      </header>

      {content}

      {page.editing && (
        <DayEditDialog
          day={page.editing}
          isPending={page.isEditPending}
          onApply={page.applyEdit}
          onClose={page.cancelEdit}
        />
      )}
      {page.isImportOpen && (
        <CalendarImportDialog onDone={page.onImported} onClose={page.closeImport} />
      )}
    </div>
  );
};

export default CalendarPage;
