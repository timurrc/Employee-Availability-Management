import type { IClosedPeriod, IPeriod, ISODate } from "@/types/common.types";

/** Условная «бесконечность» для открытого периода (больничный без даты закрытия) */
const OPEN_END: ISODate = "9999-12-31";

export const periodEnd = (period: IPeriod): ISODate => period.end ?? OPEN_END;

export const containsDate = (period: IPeriod, date: ISODate): boolean =>
  period.start <= date && date <= periodEnd(period);

/** Пересечение двух периодов включительно; null — не пересекаются */
export const overlapPeriod = (a: IPeriod, b: IPeriod): IPeriod | null => {
  const start = a.start > b.start ? a.start : b.start;
  const endA = periodEnd(a);
  const endB = periodEnd(b);
  const end = endA < endB ? endA : endB;
  if (start > end) return null;
  return { start, end: end === OPEN_END ? null : end };
};

export const periodsOverlap = (a: IPeriod, b: IPeriod): boolean => overlapPeriod(a, b) !== null;

export const isClosedPeriod = (period: IPeriod): period is IClosedPeriod => period.end !== null;
