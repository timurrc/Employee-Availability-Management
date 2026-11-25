import type { ISODate } from "./common.types";

export type DayKind = "workday" | "weekend" | "holiday";

export interface ICalendarDay {
  date: ISODate;
  kind: DayKind;
  /** Предпраздничный день — короче на 1 час */
  isShortened: boolean;
  /** Выходной, ставший рабочим, или рабочий, ставший выходным, по постановлению о переносе */
  isTransfer: boolean;
  /** Название праздника или основание переноса */
  note?: string;
}

/** Исходные данные года: праздники по ст. 112 ТК РФ и переносы по постановлению Правительства */
export interface ICalendarYearSource {
  year: number;
  /** Основание: номер и дата постановления о переносе выходных */
  source: string;
  holidays: { date: ISODate; note: string }[];
  /** Будние дни, ставшие выходными (переносы и праздники, совпавшие с выходными) */
  extraDaysOff: { date: ISODate; note: string }[];
  /** Субботы/воскресенья, ставшие рабочими */
  workingWeekends: { date: ISODate; note: string }[];
  shortened: ISODate[];
}

export interface ICalendarYear {
  year: number;
  source: string;
  days: ICalendarDay[];
}
