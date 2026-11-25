import type { IAvailability, IDeputyResolution } from "@/core/availability";
import type { IAbsence } from "./absence.types";

/** Всё, что нужно показать рядом с именем: статус на дату, скорое отсутствие, кто замещает */
export interface IPersonStatus {
  availability: IAvailability;
  /** Отсутствие, которое начнётся в ближайшие дни — точка warning на аватаре */
  upcoming: IAbsence | null;
  deputy: IDeputyResolution;
}
