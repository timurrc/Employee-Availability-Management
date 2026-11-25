import { format } from "date-fns";
import { ru } from "date-fns/locale/ru";
import { CircleCheck, TriangleAlert } from "lucide-react";
import DeputyHint from "@/components/modules/DeputyHint/DeputyHint";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Badge from "@/components/ui/Badge/Badge";
import Card from "@/components/ui/Card/Card";
import { fromISODate } from "@/core/calendar";
import { ABSENCE_META } from "@/constants/absence";
import type { IAbsence } from "@/types/absence.types";
import type { IPersonStatus } from "@/types/availability.types";
import type { ICalendarDay } from "@/types/calendar.types";
import type { ISODate } from "@/types/common.types";
import type { IEmployee } from "@/types/employee.types";
import { formatDay } from "@/utils/date";

interface EmployeeNowProps {
  status: IPersonStatus;
  today: ISODate;
  /** Сегодняшний день календаря — для «нерабочий день» */
  day: ICalendarDay;
  /** На какую дату посчитан статус (ближайший рабочий, если сегодня выходной) */
  statusDate: ISODate;
  returnsOn: ISODate | null;
  permanentDeputy?: IEmployee;
  permanentDeputyStatus?: IPersonStatus;
  next: IAbsence | null;
  employeeById: (id: string) => IEmployee | undefined;
  canSeeEln: boolean;
}

const weekday = (date: ISODate) => format(fromISODate(date), "EEEE", { locale: ru });

/** «Сейчас»: где человек, когда вернётся, кто за него — главный блок карточки */
const EmployeeNow = ({
  status,
  today,
  day,
  statusDate,
  returnsOn,
  permanentDeputy,
  permanentDeputyStatus,
  next,
  employeeById,
  canSeeEln,
}: EmployeeNowProps) => {
  const { absence } = status.availability;
  const meta = absence ? ABSENCE_META[absence.type] : null;
  const isDayOff = statusDate !== today;

  return (
    <Card title="Сейчас">
      <div className="flex flex-col gap-3">
        {isDayOff && (
          <p className="text-[var(--color-text-muted)]">
            Сегодня нерабочий день{day.note ? ` — ${day.note}` : ""}. Статус на{" "}
            {formatDay(statusDate, today)}:
          </p>
        )}

        {absence && meta ? (
          <div className="flex flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone={meta.tone} icon={meta.icon}>
                {absence.period.end === null
                  ? `${meta.label} с ${formatDay(absence.period.start, today)}, дата выхода неизвестна`
                  : `${meta.stateLabel} до ${formatDay(absence.period.end, today)} включительно`}
              </Badge>
              {returnsOn && (
                <span className="text-[var(--color-text-muted)]">
                  выйдет {formatDay(returnsOn, today)} ({weekday(returnsOn)})
                </span>
              )}
            </p>
            {absence.elnNumber && canSeeEln && (
              <p className="text-sm text-[var(--color-text-muted)]">
                ЭЛН <span className="font-mono">{absence.elnNumber}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone="success" icon={CircleCheck}>
              На месте
            </Badge>
            {next && (
              <span className="text-[var(--color-text-muted)]">
                Следующее отсутствие: с {formatDay(next.period.start, today)} —{" "}
                {ABSENCE_META[next.type].label.toLowerCase()}
                {next.status === "pending" && " (на согласовании)"}
              </span>
            )}
          </p>
        )}

        {absence && <DeputyHint resolution={status.deputy} employeeById={employeeById} />}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--color-border)] pt-3">
          {permanentDeputy ? (
            <>
              <span className="text-[var(--color-text-muted)]">Постоянный заместитель:</span>
              <PersonChip
                person={permanentDeputy}
                status={permanentDeputyStatus}
                variant="inline"
                date={statusDate}
              />
            </>
          ) : (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3 py-2">
              <TriangleAlert className="size-4 shrink-0 text-[var(--color-warning)]" aria-hidden />
              <p className="flex-1">
                Постоянный заместитель не назначен — при отсутствии документы будут ждать
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default EmployeeNow;
