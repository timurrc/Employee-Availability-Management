import { useId, useState, type KeyboardEvent } from "react";
import AbsenceTag from "@/components/modules/AbsenceTag/AbsenceTag";
import Badge from "@/components/ui/Badge/Badge";
import { eachISODate } from "@/core/calendar";
import { ABSENCE_STATUS_META } from "@/constants/absence";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import { cn } from "@/utils/cn";
import { formatDays, formatPeriod } from "@/utils/date";

type Tab = "plan" | "history";

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: "plan", label: "План", empty: "Отсутствий не запланировано" },
  { id: "history", label: "История", empty: "Истории пока нет" },
];

interface AbsenceHistoryProps {
  plan: IAbsence[];
  history: IAbsence[];
  today: ISODate;
}

const Row = ({ absence, today }: { absence: IAbsence; today: ISODate }) => {
  const status = ABSENCE_STATUS_META[absence.status];
  const struck = absence.status === "rejected" || absence.status === "cancelled";
  const isPending = absence.status === "pending" || absence.status === "draft";
  return (
    <li className="grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-center">
      <AbsenceTag type={absence.type} pending={isPending} className="self-start" />
      <span className={cn("tabular-nums", struck && "text-[var(--color-text-muted)] line-through")}>
        {formatPeriod(absence.period, today)}
        <span className="text-[var(--color-text-muted)]">
          {" · "}
          {absence.period.end === null
            ? "дата выхода неизвестна"
            : formatDays(eachISODate(absence.period.start, absence.period.end).length, "calendar")}
        </span>
      </span>
      <Badge tone={status.tone} className="self-start sm:justify-self-end">
        {status.label}
      </Badge>
    </li>
  );
};

/** План / История отсутствий: вкладки по ARIA, план — по умолчанию */
const AbsenceHistory = ({ plan, history, today }: AbsenceHistoryProps) => {
  const [tab, setTab] = useState<Tab>("plan");
  const baseId = useId();
  const items = tab === "plan" ? plan : history;
  const current = TABS.find((t) => t.id === tab)!;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const next = tab === "plan" ? "history" : "plan";
    setTab(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label="Отсутствия"
        className="flex gap-4 border-b border-[var(--color-border)]"
      >
        {TABS.map((item) => {
          const selected = item.id === tab;
          const count = item.id === "plan" ? plan.length : history.length;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={onKeyDown}
              className={cn(
                "-mb-px cursor-pointer border-b-2 pb-2 font-medium",
                selected
                  ? "border-[var(--color-primary)] text-[var(--color-text)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {item.label}
              {count > 0 && <span className="ml-1 text-[var(--color-text-muted)]">{count}</span>}
            </button>
          );
        })}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`}>
        {items.length === 0 ? (
          <p className="py-4 text-[var(--color-text-muted)]">{current.empty}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((absence) => (
              <Row key={absence.id} absence={absence} today={today} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AbsenceHistory;
