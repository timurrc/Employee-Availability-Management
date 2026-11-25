import { ChevronLeft, ChevronRight, Info, Plus, Search, TriangleAlert, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import AbsenceCard from "@/components/modules/AbsenceCard/AbsenceCard";
import TeamDayList from "@/components/modules/TeamDayList/TeamDayList";
import TeamTimeline from "@/components/modules/TeamTimeline/TeamTimeline";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import ErrorState from "@/components/ui/ErrorState/ErrorState";
import SegmentedControl from "@/components/ui/SegmentedControl/SegmentedControl";
import { ABSENCE_META } from "@/constants/absence";
import { ROUTES, withQuery } from "@/constants/routes";
import { TONE_CLASSES } from "@/constants/tones";
import type { IAbsence } from "@/types/absence.types";
import { cn } from "@/utils/cn";
import { formatPeriod, plural } from "@/utils/date";
import { periodPhrase, TIMELINE_SCALES, type TimelineScale } from "@/utils/timeline";
import { ALL_DEPARTMENTS, useTeamPage } from "./useTeamPage";

const SCALE_OPTIONS = (Object.keys(TIMELINE_SCALES) as TimelineScale[]).map((value) => ({
  value,
  label: TIMELINE_SCALES[value].label,
}));

const FIELD =
  "h-8 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 text-sm outline-none focus:border-[var(--color-focus)]";

const Notice = ({
  tone,
  children,
}: {
  tone: "info" | "warning" | "danger";
  children: ReactNode;
}) => {
  const Icon = tone === "info" ? Info : TriangleAlert;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-md)] px-3 py-2 text-sm",
        TONE_CLASSES[tone].bg,
      )}
    >
      <Icon className={cn("size-4 shrink-0", TONE_CLASSES[tone].fg)} aria-hidden />
      {children}
    </div>
  );
};

const TeamPage = () => {
  const page = useTeamPage();
  const navigate = useNavigate();
  const [card, setCard] = useState<{ absence: IAbsence; anchor: HTMLElement } | null>(null);
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  const people = page.groups.flatMap((g) => g.employees);
  const noPeople = !page.isLoading && !page.isError && people.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Календарь команды</h1>
        {page.role !== "admin" && (
          <Link
            to={ROUTES.VACATIONS}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3.5 font-medium text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="size-4" aria-hidden />
            Заявка на отпуск
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="sr-only">Подразделение</span>
            <select
              value={page.dept}
              onChange={(event) => page.setDept(event.target.value)}
              className={cn(FIELD, "max-w-56")}
            >
              {page.canSeeAll && <option value={ALL_DEPARTMENTS}>Все подразделения</option>}
              {page.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
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
              placeholder="ФИО"
              className={cn(FIELD, "w-40 pl-8")}
            />
          </label>
          {page.query.trim() && (
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={page.onlyFound}
                onChange={(event) => page.setOnlyFound(event.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              Только найденные
            </label>
          )}
        </div>

        <div className="flex items-center gap-1 md:ml-auto">
          <Button variant="ghost" size="icon" onClick={page.goPrev} aria-label="Предыдущий период">
            <ChevronLeft aria-hidden />
          </Button>
          <p className="min-w-36 text-center font-medium tabular-nums" aria-live="polite">
            {page.title}
          </p>
          <Button variant="ghost" size="icon" onClick={page.goNext} aria-label="Следующий период">
            <ChevronRight aria-hidden />
          </Button>
          <Button variant="secondary" size="sm" onClick={page.goToday}>
            Сегодня
          </Button>
        </div>
        <SegmentedControl
          label="Масштаб"
          value={page.scale}
          options={SCALE_OPTIONS}
          onChange={page.setScale}
          className="hidden md:inline-flex"
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Типы отсутствий">
        {page.allTypes.map((type) => {
          const meta = ABSENCE_META[type];
          const on = page.types.includes(type);
          const Icon = meta.icon;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => page.toggleType(type)}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1 rounded-[var(--radius-full)] border px-2.5 text-sm",
                on
                  ? [TONE_CLASSES[meta.tone].bg, TONE_CLASSES[meta.tone].fg, "border-transparent"]
                  : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]",
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
              {meta.label}
            </button>
          );
        })}
      </div>

      {page.missingYears.length > 0 && (
        <Notice tone="warning">
          Производственный календарь на {page.missingYears.join(" и ")} не загружен — выходные
          показаны по субботам и воскресеньям.
        </Notice>
      )}
      {page.risk.map(({ department, ranges, days }) => (
        <Notice key={department.id} tone="danger">
          <span>
            {page.risk.length > 1 && `${department.name}: `}
            {days} {plural(days, ["день", "дня", "дней"])} ниже порога:
          </span>
          {ranges.map((range) => (
            <button
              key={range.start}
              type="button"
              onClick={() => setScrollTo(range.start)}
              className="cursor-pointer font-medium text-[var(--color-danger)] underline-offset-2 hover:underline"
            >
              {formatPeriod(range, page.today)}
            </button>
          ))}
        </Notice>
      ))}
      {!page.isLoading && !page.isError && !noPeople && !page.hasAbsences && (
        <Notice tone="info">
          {periodPhrase(page.scale, page.period, page.today)} никто не отсутствует
        </Notice>
      )}

      {page.isError ? (
        <ErrorState what="календарь команды" onRetry={page.refetch} />
      ) : noPeople ? (
        <EmptyState
          icon={Users}
          title={
            page.selectedDepartmentEmpty
              ? "В подразделении пока нет сотрудников"
              : "Нет сотрудников по фильтру"
          }
          action={
            !page.selectedDepartmentEmpty && (
              <Button variant="secondary" size="sm" onClick={page.resetFilters}>
                Сбросить фильтры
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <TeamTimeline
              columns={page.columns}
              groups={page.groups}
              absences={page.absences}
              scale={page.scale}
              today={page.today}
              query={page.query}
              viewerId={page.user?.id}
              scrollToDate={scrollTo}
              isLoading={page.isLoading}
              onOpenAbsence={(absence, anchor) => setCard({ absence, anchor })}
              onEmptyCell={(date) => navigate(withQuery(ROUTES.VACATIONS, { start: date }))}
            />
          </div>
          <div className="md:hidden">
            <TeamDayList
              columns={page.columns}
              employees={people}
              absences={page.absences}
              today={page.today}
            />
          </div>
        </>
      )}

      {card && (
        <AbsenceCard
          key={card.absence.id}
          absence={card.absence}
          anchor={card.anchor}
          onClose={() => setCard(null)}
          employeeById={page.employeeById}
          statusOf={page.statusOf}
          viewer={page.user ? { id: page.user.id, role: page.user.role } : null}
          today={page.today}
        />
      )}
    </div>
  );
};

export default TeamPage;
