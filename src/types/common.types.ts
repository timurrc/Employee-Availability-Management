/** Дата без времени и часового пояса: "2026-11-25" */
export type ISODate = string;

/** Период включительно с обеих сторон. end = null — дата окончания неизвестна (открытый больничный) */
export interface IPeriod {
  start: ISODate;
  end: ISODate | null;
}
