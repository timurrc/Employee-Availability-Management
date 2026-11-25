import { CalendarOff, Clock3, Timer, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ABSENCE_META } from "@/constants/absence";
import { buildPath, ROUTES } from "@/constants/routes";
import { TONE_CLASSES, type Tone } from "@/constants/tones";
import type { ISODate } from "@/types/common.types";
import { cn } from "@/utils/cn";
import { formatDay } from "@/utils/date";
import type { IUpcomingEvent } from "@/utils/today";

const KIND_META: Record<
  Exclude<IUpcomingEvent["kind"], "absence">,
  { icon: LucideIcon; tone: Tone }
> = {
  deadline: { icon: Timer, tone: "info" },
  holiday: { icon: CalendarOff, tone: "danger" },
  shortened: { icon: Clock3, tone: "warning" },
};

interface UpcomingEventsProps {
  events: IUpcomingEvent[];
  today: ISODate;
}

/** Мои ближайшие события хронологически: дата слева колонкой */
const UpcomingEvents = ({ events, today }: UpcomingEventsProps) => {
  if (events.length === 0) {
    return <p className="text-[var(--color-text-muted)]">В ближайшие 30 дней событий нет.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {events.map((event) => {
        const { icon: Icon, tone } = event.absence
          ? ABSENCE_META[event.absence.type]
          : KIND_META[event.kind as keyof typeof KIND_META];
        const title = event.documentId ? (
          <Link
            to={buildPath(ROUTES.DOCUMENT, { id: event.documentId })}
            className="hover:text-[var(--color-primary)] hover:underline"
          >
            {event.title}
          </Link>
        ) : (
          event.title
        );
        return (
          <li
            key={event.id}
            className="grid grid-cols-[4.5rem_1rem_minmax(0,1fr)] items-baseline gap-2"
          >
            <time
              dateTime={event.date}
              className="text-sm text-[var(--color-text-muted)] tabular-nums"
            >
              {formatDay(event.date, today)}
            </time>
            <Icon
              className={cn("size-4 translate-y-0.5", TONE_CLASSES[tone].fg)}
              strokeWidth={1.75}
              aria-hidden
            />
            <span>{title}</span>
          </li>
        );
      })}
    </ol>
  );
};

export default UpcomingEvents;
