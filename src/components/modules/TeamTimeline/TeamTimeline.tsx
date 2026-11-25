import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { ru } from "date-fns/locale/ru";
import { ArrowLeftRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import Avatar from "@/components/ui/Avatar/Avatar";
import CoverageMeter from "@/components/ui/CoverageMeter/CoverageMeter";
import Skeleton from "@/components/ui/Skeleton/Skeleton";
import { fromISODate } from "@/core/calendar";
import { ABSENCE_META, ABSENCE_STATUS_META } from "@/constants/absence";
import { buildPath, ROUTES } from "@/constants/routes";
import { TONE_CLASSES } from "@/constants/tones";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import type { IDepartment, IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { cn } from "@/utils/cn";
import { formatDayLong } from "@/utils/date";
import { matchesQuery } from "@/utils/text";
import {
  type IDayCoverage,
  type ITimelineBar,
  type ITimelineColumn,
  TIMELINE_SCALES,
  timelineBars,
  type TimelineScale,
} from "@/utils/timeline";

const NAME_PX = 240;
const ROW_PX = 36;
const HEADER_PX = 44;
/** Больше строк — рендерим только видимые */
const VIRTUAL_FROM = 50;
/** Подпись в полосе — если она шире стольких колонок */
const LABEL_MIN_SPAN = 3;

export interface ITimelineGroupView {
  department: IDepartment;
  employees: IEmployee[];
  coverage: (IDayCoverage | null)[];
}

type Row =
  | { kind: "group"; key: string; group: ITimelineGroupView }
  | {
      kind: "person";
      key: string;
      employee: IEmployee;
      bars: ITimelineBar[];
      /** Отсутствие по индексу колонки — для ячеек и скринридера */
      byColumn: (IAbsence | undefined)[];
    };

interface TeamTimelineProps {
  columns: ITimelineColumn[];
  groups: ITimelineGroupView[];
  absences: IAbsence[];
  scale: TimelineScale;
  today: ISODate;
  /** Поиск подсвечивает строки, не скрывая остальных */
  query: string;
  /** Чья строка: клик по пустой ячейке — новая заявка */
  viewerId?: string;
  /** Ячейка, к которой прокрутить (сводка «ниже порога») */
  scrollToDate?: ISODate | null;
  onOpenAbsence: (absence: IAbsence, anchor: HTMLElement) => void;
  onEmptyCell: (date: ISODate) => void;
  /** Данные обновляются — сетка полупрозрачная */
  isFetching?: boolean;
  /** Люди ещё грузятся: шапка дат уже есть, строки — скелетоны */
  isLoading?: boolean;
}

const dayLabel = (column: ITimelineColumn) => {
  const { day } = column;
  if (day.kind === "holiday") return day.note ? `праздник, ${day.note}` : "праздник";
  if (day.kind === "weekend") return "выходной";
  return day.isShortened ? "рабочий, сокращённый" : "рабочий";
};

const columnBg = ({ day }: ITimelineColumn) =>
  day.kind === "holiday"
    ? "bg-[var(--color-cal-holiday-bg)]"
    : day.kind === "weekend"
      ? "bg-[var(--color-cal-weekend-bg)]"
      : undefined;

const TODAY_LINE =
  "after:pointer-events-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-[var(--color-cal-today)]";

/**
 * Календарь команды: строки — сотрудники (по подразделениям), колонки — дни.
 * Своя CSS-сетка, role="grid" с навигацией стрелками; > 50 строк — виртуализация.
 * Полосы — визуальный слой поверх ячеек; ячейка сама объявляет, что в ней.
 */
const TeamTimeline = ({
  columns,
  groups,
  absences,
  scale,
  today,
  query,
  viewerId,
  scrollToDate,
  onOpenAbsence,
  onEmptyCell,
  isFetching,
  isLoading,
}: TeamTimelineProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnPx = TIMELINE_SCALES[scale].columnPx;
  const compact = scale === "quarter";
  const todayIndex = columns.findIndex((c) => c.day.date === today);

  const rows = useMemo<Row[]>(() => {
    const period = { start: columns[0]?.day.date ?? today, end: columns.at(-1)?.day.date ?? today };
    const byEmployee = new Map<string, IAbsence[]>();
    absences.forEach((a) =>
      byEmployee.set(a.employeeId, [...(byEmployee.get(a.employeeId) ?? []), a]),
    );
    return groups.flatMap((group) => [
      { kind: "group" as const, key: `g-${group.department.id}`, group },
      ...group.employees.map((employee) => {
        const bars = timelineBars(byEmployee.get(employee.id) ?? [], period, today);
        const byColumn: (IAbsence | undefined)[] = [];
        // Согласованное поверх заявки: сначала рисуем pending, потом действующие
        [...bars]
          .sort((a, b) => Number(b.isPending) - Number(a.isPending))
          .forEach((bar) => {
            for (let i = bar.column; i < bar.column + bar.span; i += 1) byColumn[i] = bar.absence;
          });
        return { kind: "person" as const, key: employee.id, employee, bars, byColumn };
      }),
    ]);
  }, [groups, absences, columns, today]);

  const isVirtual = rows.length > VIRTUAL_FROM;
  // Компилятор React пропускает этот компонент из-за useVirtualizer — это ожидаемо
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_PX,
    overscan: 8,
    scrollMargin: HEADER_PX,
    enabled: isVirtual,
  });

  const items = isVirtual ? virtualizer.getVirtualItems() : null;
  const visible = items
    ? items.map((item) => ({ row: rows[item.index]!, index: item.index }))
    : rows.map((row, index) => ({ row, index }));
  const padTop = items?.[0] ? items[0].start - HEADER_PX : 0;
  const padBottom = items?.length
    ? virtualizer.getTotalSize() - (items.at(-1)!.end - HEADER_PX)
    : 0;

  // Роуминг-фокус: одна ячейка в tab-порядке, остальные — стрелками
  const personRows = useMemo(
    () => rows.flatMap((row, index) => (row.kind === "person" ? [index] : [])),
    [rows],
  );
  const [active, setActive] = useState({ row: personRows[0] ?? 0, col: Math.max(todayIndex, 0) });
  const focusNext = useRef(false);

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    const find = () =>
      scrollRef.current?.querySelector<HTMLElement>(`[data-cell="${active.row}:${active.col}"]`);
    const cell = find();
    if (cell) {
      cell.focus();
      return;
    }
    virtualizer.scrollToIndex(active.row);
    requestAnimationFrame(() => find()?.focus());
  }, [active, virtualizer]);

  useEffect(() => {
    if (!scrollToDate || !scrollRef.current) return;
    const index = columns.findIndex((c) => c.day.date === scrollToDate);
    if (index >= 0) scrollRef.current.scrollTo({ left: Math.max(0, index * columnPx - columnPx) });
  }, [scrollToDate, columns, columnPx]);

  const move = (row: number, col: number) => {
    focusNext.current = true;
    setActive({ row, col: Math.min(Math.max(col, 0), columns.length - 1) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const position = personRows.indexOf(active.row);
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(active.row, active.col + 1),
      ArrowLeft: () => move(active.row, active.col - 1),
      ArrowDown: () => move(personRows[Math.min(position + 1, personRows.length - 1)]!, active.col),
      ArrowUp: () => move(personRows[Math.max(position - 1, 0)]!, active.col),
      Home: () => move(active.row, 0),
      End: () => move(active.row, columns.length - 1),
    };
    const handler = keys[event.key];
    if (!handler || !(event.target as HTMLElement).dataset.cell) return;
    event.preventDefault();
    handler();
  };

  const template = { gridTemplateColumns: `${NAME_PX}px repeat(${columns.length}, ${columnPx}px)` };
  const width = NAME_PX + columns.length * columnPx;

  const header = (
    <div
      role="row"
      className="sticky top-0 z-20 grid border-b border-[var(--color-border)] bg-[var(--color-elevated)]"
      style={{ ...template, height: HEADER_PX }}
    >
      <div
        role="columnheader"
        className="sticky left-0 z-10 flex items-end border-r border-[var(--color-border)] bg-[var(--color-elevated)] px-3 pb-1.5 text-xs font-medium text-[var(--color-text-muted)]"
      >
        Сотрудник
      </div>
      {columns.map((column, index) => {
        const { day } = column;
        const date = fromISODate(day.date);
        const isToday = index === todayIndex;
        const showNumber = !compact || date.getDay() === 1 || date.getDate() === 1;
        return (
          <div
            key={day.date}
            role="columnheader"
            aria-label={`${formatDayLong(day.date)}, ${dayLabel(column)}`}
            title={day.note ?? (day.isShortened ? "Сокращённый день, −1 ч" : undefined)}
            className={cn(
              "relative flex flex-col items-center justify-end pb-1 text-xs leading-tight tabular-nums",
              columnBg(column),
              day.kind === "workday"
                ? "text-[var(--color-text)]"
                : "text-[var(--color-text-muted)]",
              day.kind === "holiday" && "text-[var(--color-cal-holiday)]",
            )}
          >
            {day.isTransfer && !compact && (
              <ArrowLeftRight className="absolute top-0.5 left-0.5 size-3" aria-hidden />
            )}
            {day.isShortened && !compact && (
              <span className="absolute top-0 right-0.5 text-[10px] text-[var(--color-warning)]">
                −1ч
              </span>
            )}
            {showNumber && (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full",
                  isToday &&
                    "bg-[var(--color-cal-today)] font-semibold text-[var(--color-on-primary)]",
                  compact && "min-w-0 text-[10px]",
                )}
              >
                {date.getDate()}
              </span>
            )}
            {!compact && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {format(date, "EEEEEE", { locale: ru })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderGroup = (group: ITimelineGroupView, index: number) => {
    const todayCoverage = group.coverage[todayIndex];
    return (
      <div
        key={`g-${group.department.id}`}
        role="row"
        aria-rowindex={index + 2}
        className="grid border-b border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ ...template, height: ROW_PX }}
      >
        <div
          role="rowheader"
          className="sticky left-0 z-10 flex items-center gap-3 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {group.department.name}
          </span>
          {todayCoverage && (
            <CoverageMeter
              available={todayCoverage.available}
              total={todayCoverage.total}
              threshold={todayCoverage.threshold}
              label={`Покрытие сегодня: ${group.department.name}`}
              className="w-20 [&>p]:hidden"
            />
          )}
        </div>
        {group.coverage.map((day, col) => (
          <div
            key={columns[col]!.day.date}
            role="gridcell"
            aria-label={
              day
                ? `${formatDayLong(day.date)}: на месте ${day.available} из ${day.total}${day.isBelow ? ", ниже порога" : ""}`
                : `${formatDayLong(columns[col]!.day.date)}: ${dayLabel(columns[col]!)}`
            }
            title={day ? `${day.available} из ${day.total} · порог ${day.threshold}%` : undefined}
            className={cn("relative flex items-end justify-center pb-1", columnBg(columns[col]!))}
          >
            {day && (
              <span
                className={cn(
                  "w-1/2 max-w-3 min-w-0.5 rounded-t-[2px]",
                  day.isBelow ? "bg-[var(--color-danger)]" : "bg-[var(--color-border-strong)]",
                )}
                // Высота столбика = доля доступных
                style={{ height: `${Math.max(day.percent, 4) * 0.24}px` }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderBar = (bar: ITimelineBar) => {
    const meta = ABSENCE_META[bar.absence.type];
    const tone = TONE_CLASSES[meta.tone];
    const Icon = meta.icon;
    const showLabel = !compact && bar.span >= LABEL_MIN_SPAN;
    return (
      <div
        key={bar.absence.id}
        aria-hidden
        className={cn(
          "pointer-events-none z-[1] my-1.5 flex min-w-0 items-center gap-1 overflow-hidden rounded-[var(--radius-sm)] text-xs font-medium",
          tone.bg,
          tone.fg,
          !bar.cutStart && ["border-l-[3px]", tone.border],
          bar.cutStart && "rounded-l-none",
          bar.cutEnd && "rounded-r-none",
          bar.isPending && "border-dashed pattern-pending",
          bar.isOpen && "fade-out-end",
          compact ? "px-0" : "px-1",
        )}
        style={{ gridColumn: `${bar.column + 2} / span ${bar.span}`, gridRow: 1 }}
      >
        {!compact && <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />}
        {showLabel && (
          <span className="truncate">
            {meta.label}
            {bar.isPending && <span className="font-normal"> (на согласовании)</span>}
          </span>
        )}
        {bar.isOpen && !bar.cutEnd && !compact && <span className="ml-auto pr-1">?</span>}
      </div>
    );
  };

  const renderPerson = (row: Extract<Row, { kind: "person" }>, index: number) => {
    const { employee } = row;
    const isOwn = employee.id === viewerId;
    const isFound =
      query.trim() !== "" && matchesQuery(`${employee.fullName} ${employee.position}`, query);
    const name = shortName(employee.fullName);
    return (
      <div
        key={employee.id}
        role="row"
        aria-rowindex={index + 2}
        className={cn(
          "grid border-b border-[var(--color-border)] last:border-b-0",
          isFound && "bg-[var(--color-primary-soft)]",
        )}
        style={{ ...template, height: ROW_PX }}
      >
        <div
          role="rowheader"
          className={cn(
            "sticky left-0 z-10 flex min-w-0 items-center gap-2 border-r border-[var(--color-border)] px-3",
            isFound ? "bg-[var(--color-primary-soft)]" : "bg-[var(--color-elevated)]",
          )}
          style={{ gridColumn: 1, gridRow: 1 }}
        >
          <Avatar name={employee.fullName} size="sm" />
          <div className="flex min-w-0 flex-col leading-tight">
            <Link
              to={buildPath(ROUTES.EMPLOYEE, { id: employee.id })}
              className="truncate text-sm hover:text-[var(--color-primary)] hover:underline"
            >
              {employee.fullName}
            </Link>
            <span className="truncate text-xs text-[var(--color-text-muted)]">
              {employee.position}
            </span>
          </div>
        </div>

        {columns.map((column, col) => {
          const absence = row.byColumn[col];
          const meta = absence && ABSENCE_META[absence.type];
          const statusText = absence && ABSENCE_STATUS_META[absence.status].label.toLowerCase();
          const isActive = active.row === index && active.col === col;
          const clickable = Boolean(absence) || isOwn;
          return (
            <div
              key={column.day.date}
              role="gridcell"
              data-cell={`${index}:${col}`}
              tabIndex={isActive ? 0 : -1}
              aria-label={`${name}, ${formatDayLong(column.day.date)}: ${
                meta ? `${meta.label.toLowerCase()}, ${statusText}` : dayLabel(column)
              }`}
              title={meta ? `${meta.label} · ${statusText}` : undefined}
              onFocus={() =>
                (active.row !== index || active.col !== col) && setActive({ row: index, col })
              }
              onClick={(event) => {
                if (absence) onOpenAbsence(absence, event.currentTarget);
                else if (isOwn) onEmptyCell(column.day.date);
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && clickable) {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              className={cn(
                "relative outline-none focus-visible:z-[2] focus-visible:shadow-[inset_0_0_0_2px_var(--color-focus)]",
                columnBg(column),
                col === todayIndex && TODAY_LINE,
                clickable && "cursor-pointer",
                isOwn && !absence && "hover:bg-[var(--color-primary-soft)]",
              )}
              style={{ gridColumn: col + 2, gridRow: 1 }}
            />
          );
        })}

        {row.bars.map(renderBar)}
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      className={cn(
        "max-h-[calc(100svh-15rem)] min-h-64 overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)] transition-opacity",
        isFetching && "opacity-60",
      )}
    >
      <div
        role="grid"
        aria-label="Календарь команды"
        aria-rowcount={rows.length + 1}
        aria-colcount={columns.length + 1}
        onKeyDown={onKeyDown}
        style={{ width }}
      >
        {header}
        {padTop > 0 && <div aria-hidden style={{ height: padTop }} />}
        {visible.map(({ row, index }) =>
          row.kind === "group" ? renderGroup(row.group, index) : renderPerson(row, index),
        )}
        {padBottom > 0 && <div aria-hidden style={{ height: padBottom }} />}
        {isLoading && (
          <div role="status" aria-label="Загрузка сотрудников" className="flex flex-col gap-3 p-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamTimeline;
