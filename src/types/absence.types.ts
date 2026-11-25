import type { IPeriod } from "./common.types";

export type AbsenceType = "vacation" | "unpaid" | "sick" | "trip" | "study" | "dayoff";

export type VacationStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";
export type SickLeaveStatus = "open" | "extended" | "closed";
export type AbsenceStatus = VacationStatus | SickLeaveStatus;

export interface IAbsence {
  id: string;
  employeeId: string;
  type: AbsenceType;
  period: IPeriod;
  status: AbsenceStatus;
  /** Кто замещает на время отсутствия; null — не назначен (берётся постоянный заместитель) */
  deputyId: string | null;
  comment?: string;
  /** Номер электронного листка нетрудоспособности — только для больничного */
  elnNumber?: string;
  createdAt: string;
}

export interface IDelegation {
  id: string;
  fromId: string;
  toId: string;
  period: IPeriod;
  reason: "absence" | "manual";
  /** Типы документов; пусто — все */
  documentTypes: string[];
}
