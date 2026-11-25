import { resolveDeputy } from "@/core/availability";
import type { CalendarIndex } from "@/core/calendar";
import { routeDeadlines, type IRouteStepDeadline } from "@/core/deadline";
import type { Tone } from "@/constants/tones";
import type { IAbsence, IDelegation } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import type {
  DocumentStatus,
  DocumentType,
  IApprovalStep,
  IDocument,
} from "@/types/document.types";
import type { IEmployee } from "@/types/employee.types";
import { matchesQuery } from "./text";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: "Договор",
  order: "Приказ",
  memo: "Служебная записка",
  invoice: "Счёт",
};

export const DOCUMENT_STATUS_META: Record<DocumentStatus, { label: string; tone: Tone }> = {
  draft: { label: "Черновик", tone: "neutral" },
  in_progress: { label: "На согласовании", tone: "info" },
  approved: { label: "Согласован", tone: "success" },
  rejected: { label: "Отклонён", tone: "danger" },
};

/** Срок этапа по умолчанию при добавлении согласующего, рабочих дней */
export const DEFAULT_STEP_DAYS = 2;
export const MAX_STEP_DAYS = 30;

export const documentStatus = (document: IDocument): DocumentStatus => {
  if (!document.routeStartedAt) return "draft";
  if (document.steps.some((s) => s.status === "rejected")) return "rejected";
  if (document.steps.length > 0 && document.steps.every((s) => s.status === "approved")) {
    return "approved";
  }
  return "in_progress";
};

export const currentStepIndex = (document: IDocument) =>
  document.steps.findIndex((s) => s.status === "in_progress");

/** Кто сейчас решает по этапу: заместитель, если этап передан, иначе согласующий */
export const actorOf = (step: IApprovalStep) => step.delegatedToId ?? step.approverId;

export const isOpenStep = (step: IApprovalStep) =>
  step.status === "waiting" || step.status === "in_progress";

/** Документ считается от даты старта; у черновика — от выбранной в форме даты */
export interface IRouteContext {
  calendar: CalendarIndex;
  employees: IEmployee[];
  absences: IAbsence[];
  delegations?: IDelegation[];
}

export const documentDeadlines = (
  document: IDocument,
  { calendar, employees, absences, delegations }: IRouteContext,
  draftStart?: ISODate,
): IRouteStepDeadline[] =>
  routeDeadlines(
    calendar,
    draftStart && !document.routeStartedAt ? { ...document, routeStartedAt: draftStart } : document,
    { employees, absences, delegations },
  );

export interface IRouteIssue {
  step: IApprovalStep;
  index: number;
  deadline: IRouteStepDeadline;
  /** Кому можно передать; null — некому (нет замещающего / цикл / открытый больничный) */
  deputyId: string | null;
}

/**
 * Проблемы маршрута: открытые этапы, где согласующий отсутствует на старте или уйдёт
 * до окончания срока, и инициатор ещё ничего не решил (не передал и не «оставил»).
 */
export const routeIssues = (
  document: IDocument,
  deadlines: IRouteStepDeadline[],
  context: IRouteContext,
): IRouteIssue[] =>
  document.steps.flatMap((step, index) => {
    const deadline = deadlines[index];
    if (!deadline || !isOpenStep(step) || step.delegatedToId || step.waitForReturn) return [];
    if (deadline.risk === "none" || deadline.risk === "waiting") return [];
    let deputyId = deadline.resolution.status === "deputy" ? deadline.resolution.actorId : null;
    if (deadline.risk === "absent_in_window" && deadline.absence) {
      // На старте на месте — заместитель тот, кто замещает с первого дня отсутствия
      const later = resolveDeputy(step.approverId, deadline.absence.period.start, {
        employees: context.employees,
        absences: context.absences,
        delegations: context.delegations,
      });
      deputyId = later.status === "deputy" ? later.actorId : null;
    }
    return [{ step, index, deadline, deputyId }];
  });

/** Дата вне загруженного календаря — срок посчитан только по выходным */
export const isBeyondCalendar = (calendar: CalendarIndex, date: ISODate) =>
  calendar.size > 0 && !calendar.has(date);

export type DocumentTab = "mine" | "waiting" | "all";

export const DOCUMENT_TABS: { value: DocumentTab; label: string }[] = [
  { value: "mine", label: "Мои" },
  { value: "waiting", label: "Жду моего решения" },
  { value: "all", label: "Все" },
];

export const isDocumentTab = (value: string | null): value is DocumentTab =>
  DOCUMENT_TABS.some((tab) => tab.value === value);

export interface IDocumentRow {
  document: IDocument;
  status: DocumentStatus;
  /** Номер текущего этапа с 1; null — маршрут не идёт */
  stepNumber: number | null;
  /** У кого документ сейчас (с учётом передачи) */
  currentId: string | null;
  currentDeadline: IRouteStepDeadline | null;
  /** Есть нерешённая проблема в маршруте — «Риск срока» */
  atRisk: boolean;
  /** Ожидаемая дата решения — срок последнего этапа */
  decisionDate: ISODate | null;
  /** Дата последнего решения — для согласованных и отклонённых */
  decidedAt: ISODate | null;
}

export const documentRows = (documents: IDocument[], context: IRouteContext): IDocumentRow[] =>
  documents.map((document) => {
    const status = documentStatus(document);
    const deadlines = documentDeadlines(document, context);
    const index = currentStepIndex(document);
    const step = document.steps[index];
    const issues = status === "in_progress" ? routeIssues(document, deadlines, context) : [];
    const decided = document.steps.map((s) => s.decidedAt).filter(Boolean) as ISODate[];
    return {
      document,
      status,
      stepNumber: step ? index + 1 : null,
      currentId: step ? actorOf(step) : null,
      currentDeadline: deadlines[index] ?? null,
      atRisk: issues.length > 0,
      decisionDate: status === "in_progress" ? (deadlines.at(-1)?.due ?? null) : null,
      decidedAt:
        status === "approved" || status === "rejected" ? (decided.sort().at(-1) ?? null) : null,
    };
  });

export interface IDocumentFilter {
  tab: DocumentTab;
  status: DocumentStatus | "";
  type: DocumentType | "";
  query: string;
}

export const filterDocumentRows = (
  rows: IDocumentRow[],
  filter: IDocumentFilter,
  viewerId: string,
) =>
  rows.filter(({ document, status, currentId }) => {
    if (filter.tab === "mine" && document.authorId !== viewerId) return false;
    if (filter.tab === "waiting" && currentId !== viewerId) return false;
    if (filter.status && status !== filter.status) return false;
    if (filter.type && document.type !== filter.type) return false;
    return matchesQuery(`${document.number} ${document.title}`, filter.query);
  });
