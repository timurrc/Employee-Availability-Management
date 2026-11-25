import type { ISODate } from "./common.types";

export type DocumentType = "contract" | "order" | "memo" | "invoice";
export type ApprovalStatus = "waiting" | "in_progress" | "approved" | "rejected";

export interface IApprovalStep {
  id: string;
  approverId: string;
  /** Срок этапа в рабочих днях */
  durationDays: number;
  status: ApprovalStatus;
  /** Если этап передан заместителю — кто фактически согласует */
  delegatedToId?: string;
  decidedAt?: ISODate;
  /** Инициатор решил ждать выхода отсутствующего согласующего («Оставить») */
  waitForReturn?: boolean;
  /** Причина отказа — у отклонённого этапа */
  comment?: string;
}

/** Статус документа выводится из маршрута — см. utils/document.ts → documentStatus */
export type DocumentStatus = "draft" | "in_progress" | "approved" | "rejected";

export interface ICreateDocumentDto {
  title: string;
  type: DocumentType;
  authorId: string;
}

/** Маршрут черновика: порядок, согласующие, сроки, дата старта */
export interface IRouteDto {
  steps: {
    id?: string;
    approverId: string;
    durationDays: number;
    delegatedToId?: string;
    waitForReturn?: boolean;
  }[];
}

/** Передать этап заместителю (toId) / вернуть (null); «Оставить» — waitForReturn */
export interface IStepPatchDto {
  delegatedToId?: string | null;
  waitForReturn?: boolean;
}

export interface IDecisionDto {
  byId: string;
  decision: "approved" | "rejected";
  reason?: string;
}

export interface IDocument {
  id: string;
  number: string;
  title: string;
  type: DocumentType;
  authorId: string;
  createdAt: ISODate;
  /** Дата старта маршрута — от неё считаются сроки этапов */
  routeStartedAt: ISODate | null;
  steps: IApprovalStep[];
}
