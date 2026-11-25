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
