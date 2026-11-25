import type { z } from "zod";
import type { rejectSchema, vacationRequestSchema } from "@/schemas/vacation.schema";
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
  /** Решение руководителя по заявке: кто, когда, причина отказа */
  decision?: IAbsenceDecision;
}

export interface IAbsenceDecision {
  byId: string;
  at: string;
  reason?: string;
}

/** Типы, которые сотрудник оформляет заявкой сам (больничный регистрирует HR) */
export type RequestType = Extract<AbsenceType, "vacation" | "unpaid" | "study">;

export interface ICreateAbsenceDto {
  employeeId: string;
  type: RequestType;
  period: { start: string; end: string };
  deputyId: string | null;
  comment?: string;
  /** draft — сохранить черновик, pending — отправить руководителю */
  status: "draft" | "pending";
}

export type IUpdateAbsenceDto = Omit<ICreateAbsenceDto, "employeeId">;

/** Смена статуса заявки: согласовать, отклонить, отменить, вернуть на согласование */
export interface IAbsenceStatusDto {
  status: Extract<VacationStatus, "pending" | "approved" | "rejected" | "cancelled">;
  /** Кто принимает решение — в демо без сервера авторизации передаём явно */
  byId: string;
  reason?: string;
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

/** Значения полей формы (период может быть ещё не выбран) */
export type IVacationRequestForm = z.input<typeof vacationRequestSchema>;
/** После валидации: период выбран */
export type IVacationRequestValues = z.output<typeof vacationRequestSchema>;
export type IRejectForm = z.infer<typeof rejectSchema>;
