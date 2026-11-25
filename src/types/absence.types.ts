import type { z } from "zod";
import type { sickLeaveSchema } from "@/schemas/sickLeave.schema";
import type { rejectSchema, vacationRequestSchema } from "@/schemas/vacation.schema";
import type { IPeriod, ISODate } from "./common.types";

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
  /** Отпуск продлён из-за больничного (ст. 124 ТК РФ) — пересечение решено */
  extension?: IVacationExtension;
  /** История листков больничного: каждый ЭЛН со своим периодом (первый — исходный) */
  elnHistory?: IElnRecord[];
}

export interface IVacationExtension {
  sickLeaveId: string;
  /** Окончание отпуска до продления — для «Отменить» */
  previousEnd: ISODate;
  days: number;
}

export interface IElnRecord {
  number: string;
  start: ISODate;
  /** null — дата окончания на момент продления неизвестна */
  end: ISODate | null;
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

/** HR регистрирует больничный: он не согласуется */
export interface IOpenSickLeaveDto {
  employeeId: string;
  start: ISODate;
  /** null — дата окончания неизвестна */
  end: ISODate | null;
  elnNumber: string;
}

/** Продление: новый ЭЛН (необязательно) и новая ожидаемая дата окончания или «неизвестна» */
export interface IExtendSickLeaveDto {
  end: ISODate | null;
  elnNumber?: string;
}

export interface ICloseSickLeaveDto {
  end: ISODate;
}

/** Продлить отпуск на дни больничного (ст. 124) или отменить продление (sickLeaveId = null) */
export interface IExtendVacationDto {
  end: ISODate;
  sickLeaveId: string | null;
  days: number;
}

export interface IDelegation {
  id: string;
  fromId: string;
  toId: string;
  period: IPeriod;
  reason: "absence" | "manual";
  /** Типы документов; пусто — все */
  documentTypes: string[];
  /** Кто назначил — в демо без авторизации передаём явно */
  createdById?: string;
}

export type ICreateDelegationDto = Omit<IDelegation, "id" | "reason" | "period"> & {
  period: { start: ISODate; end: ISODate };
};

/** Значения полей формы (период может быть ещё не выбран) */
export type IVacationRequestForm = z.input<typeof vacationRequestSchema>;
/** После валидации: период выбран */
export type IVacationRequestValues = z.output<typeof vacationRequestSchema>;
export type IRejectForm = z.infer<typeof rejectSchema>;
export type ISickLeaveForm = z.input<typeof sickLeaveSchema>;
export type ISickLeaveValues = z.output<typeof sickLeaveSchema>;
