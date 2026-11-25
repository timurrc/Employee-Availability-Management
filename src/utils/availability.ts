import type { LucideIcon } from "lucide-react";
import { CircleCheck, Clock } from "lucide-react";
import { ABSENCE_META } from "@/constants/absence";
import type { Tone } from "@/constants/tones";
import type { IPersonStatus } from "@/types/availability.types";
import type { ISODate } from "@/types/common.types";
import { formatDay } from "./date";

export interface IStatusView {
  /** «В отпуске до 9 дек.», «С 1 дек. — отпуск», «Больничный, выход неизвестен» */
  text: string;
  tone: Tone;
  icon: LucideIcon;
  /** Кольцо аватара — только если человек отсутствует на дату */
  ring?: Tone;
  soon: boolean;
}

/** «Кузнецов Дмитрий Александрович» → «Кузнецов Д.» */
export const shortName = (fullName: string) => {
  const [last, first] = fullName.split(/\s+/);
  return first ? `${last} ${first[0]}.` : (last ?? fullName);
};

/**
 * Статус человека для подписи. null — на месте и ничего не предстоит:
 * в списках «На месте» не показываем (шум), карточка решает сама.
 */
export const describeStatus = (
  { availability, upcoming }: IPersonStatus,
  today: ISODate,
): IStatusView | null => {
  const { absence } = availability;
  if (absence) {
    const meta = ABSENCE_META[absence.type];
    const text =
      absence.period.end === null
        ? `${meta.label}, выход неизвестен`
        : `${meta.stateLabel} до ${formatDay(absence.period.end, today)}`;
    return { text, tone: meta.tone, icon: meta.icon, ring: meta.tone, soon: false };
  }
  if (upcoming) {
    const meta = ABSENCE_META[upcoming.type];
    return {
      text: `С ${formatDay(upcoming.period.start, today)} — ${meta.label.toLowerCase()}`,
      tone: "warning",
      icon: Clock,
      soon: true,
    };
  }
  return null;
};

export const AVAILABLE_VIEW: IStatusView = {
  text: "На месте",
  tone: "success",
  icon: CircleCheck,
  soon: false,
};
