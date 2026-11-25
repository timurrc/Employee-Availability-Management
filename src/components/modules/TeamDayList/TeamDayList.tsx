import { format } from "date-fns";
import { ru } from "date-fns/locale/ru";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Badge from "@/components/ui/Badge/Badge";
import { absenceOn } from "@/core/availability";
import { fromISODate } from "@/core/calendar";
import { ABSENCE_META } from "@/constants/absence";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { cn } from "@/utils/cn";
import type { ITimelineColumn } from "@/utils/timeline";

interface TeamDayListProps {
  columns: ITimelineColumn[];
  employees: IEmployee[];
  absences: IAbsence[];
  today: ISODate;
}

/** Мобильный режим календаря: дни периода, под каждым — кто отсутствует */
const TeamDayList = ({ columns, employees, absences, today }: TeamDayListProps) => {
  const days = columns
    .map(({ day }) => ({
      day,
      people: employees.flatMap((employee) => {
        const absence = absenceOn(absences, employee.id, day.date, () => true);
        return absence ? [{ employee, absence }] : [];
      }),
    }))
    .filter(({ day, people }) => people.length > 0 || day.date === today);

  return (
    <ol className="flex flex-col gap-4">
      {days.map(({ day, people }) => (
        <li key={day.date} className="flex flex-col gap-2">
          <h3
            className={cn(
              "text-sm font-semibold first-letter:uppercase",
              day.kind !== "workday" && "text-[var(--color-text-muted)]",
              day.date === today && "text-[var(--color-primary)]",
            )}
          >
            {format(fromISODate(day.date), "EEEE, d MMMM", { locale: ru })}
            {day.kind === "holiday" && ` · ${day.note ?? "праздник"}`}
          </h3>
          {people.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Все на месте</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {people.map(({ employee, absence }) => {
                const meta = ABSENCE_META[absence.type];
                return (
                  <li key={employee.id} className="flex flex-wrap items-center gap-2">
                    <PersonChip person={employee} className="flex-1" />
                    <Badge tone={meta.tone} icon={meta.icon}>
                      {meta.label}
                      {absence.status === "pending" && " (на согл.)"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
};

export default TeamDayList;
