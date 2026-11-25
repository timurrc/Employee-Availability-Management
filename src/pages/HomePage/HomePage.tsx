import { format } from "date-fns";
import { ru } from "date-fns/locale/ru";
import { HeartPulse, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import AbsentList from "@/components/modules/AbsentList/AbsentList";
import DepartmentCoverage from "@/components/modules/DepartmentCoverage/DepartmentCoverage";
import TodayActions from "@/components/modules/TodayActions/TodayActions";
import UpcomingEvents from "@/components/modules/UpcomingEvents/UpcomingEvents";
import Card from "@/components/ui/Card/Card";
import ErrorState from "@/components/ui/ErrorState/ErrorState";
import SegmentedControl from "@/components/ui/SegmentedControl/SegmentedControl";
import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";
import { fromISODate } from "@/core/calendar";
import { ROUTES } from "@/constants/routes";
import { formatDay } from "@/utils/date";
import { type Scope, useHomePage } from "./useHomePage";

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "mine", label: "Мой отдел" },
  { value: "all", label: "Все" },
];

const PRIMARY_LINK =
  "inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3.5 font-medium text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] [&_svg]:size-4";

const Rows = ({ count, className }: { count: number; className?: string }) => (
  <Delayed>
    <div className="flex flex-col gap-3 px-4 py-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={className ?? "h-9 w-full"} />
      ))}
    </div>
  </Delayed>
);

const HomePage = () => {
  const page = useHomePage();
  const { day, today, date } = page;

  const dayContext =
    day.kind !== "workday"
      ? `Нерабочий день${day.note ? ` — ${day.note}` : ""}`
      : day.isShortened
        ? `Сокращённый день · ${page.hoursPerDay - 1} ч, предпраздничный`
        : `Рабочий день · ${page.hoursPerDay} ч`;
  const nextOff = page.nextDayOff
    ? ` Ближайший нерабочий: ${formatDay(page.nextDayOff.date, today)}${page.nextDayOff.isTransfer && page.nextDayOff.kind === "weekend" ? " (перенос)" : ""}.`
    : "";

  const absentTitle =
    date === today
      ? "Отсутствуют сегодня"
      : `Отсутствуют в ближайший рабочий день, ${formatDay(date, today)}`;

  const mainAction =
    page.role === "hr" ? (
      <Link to={ROUTES.SICK_LEAVES} className={PRIMARY_LINK}>
        <HeartPulse aria-hidden />
        Открыть больничный
      </Link>
    ) : page.role === "admin" ? null : (
      <Link to={ROUTES.VACATIONS} className={PRIMARY_LINK}>
        <Plus aria-hidden />
        Заявка на отпуск
      </Link>
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">
            Сегодня, {format(fromISODate(today), "EEEE d MMMM", { locale: ru })}
          </h1>
          <p className="text-[var(--color-text-muted)]">
            {dayContext}.{nextOff}
          </p>
        </div>
        {mainAction}
      </header>

      {page.documents.isLoading ? (
        <Card title="Ждут вашего действия" flush>
          <Rows count={2} />
        </Card>
      ) : (
        <TodayActions
          actions={page.actions}
          onDelegate={page.delegate}
          delegatingId={page.delegatingId}
        />
      )}

      <Card
        flush
        title={
          <>
            {absentTitle}
            {!page.people.isLoading && !page.people.isError && (
              <span className="font-normal text-[var(--color-text-muted)]">
                {" "}
                · {page.absentTotal}
              </span>
            )}
          </>
        }
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Чьи отсутствия показать"
              value={page.scope}
              options={SCOPE_OPTIONS}
              onChange={page.setScope}
            />
            <label className="relative">
              <span className="sr-only">Поиск по ФИО</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--color-text-subtle)]"
                aria-hidden
              />
              <input
                type="search"
                value={page.query}
                onChange={(event) => page.setQuery(event.target.value)}
                placeholder="Поиск по ФИО"
                className="h-8 w-48 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] pr-2 pl-8 text-sm outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-focus)]"
              />
            </label>
          </div>
        }
      >
        <div className="pb-4">
          {page.people.isLoading ? (
            <Rows count={4} />
          ) : page.people.isError ? (
            <ErrorState compact what="отсутствия" onRetry={page.people.refetch} className="mx-4" />
          ) : (
            <AbsentList
              rows={page.absent}
              soon={page.soon}
              date={date}
              employeeById={page.employeeById}
              query={page.query}
              onResetQuery={() => page.setQuery("")}
              next={page.next}
              canAssign={page.role === "manager" || page.role === "hr"}
            />
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Покрытие по подразделениям">
          {page.directory.isLoading ? (
            <Rows count={3} className="h-6 w-full" />
          ) : page.directory.isError ? (
            <ErrorState compact what="подразделения" onRetry={page.directory.refetch} />
          ) : (
            <DepartmentCoverage rows={page.coverage} />
          )}
        </Card>
        <Card title="Мои ближайшие события">
          {page.documents.isLoading ? (
            <Rows count={3} className="h-5 w-full" />
          ) : (
            <UpcomingEvents events={page.events} today={today} />
          )}
        </Card>
      </div>
    </div>
  );
};

export default HomePage;
