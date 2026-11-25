import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { countWorkingDays, shiftISODate } from "@/core/calendar";
import { UNDO_TOAST_MS } from "@/constants/vacation";
import { useAvailability } from "@/hooks/useAvailability";
import {
  useDecideDocument,
  useDocument,
  usePatchStep,
  useSaveRoute,
  useSendDocument,
} from "@/hooks/useDocuments";
import { useAuthStore } from "@/store/auth.store";
import type { IApprovalStep, IDocument, IStepPatchDto } from "@/types/document.types";
import { shortName } from "@/utils/availability";
import { todayISO } from "@/utils/date";
import {
  actorOf,
  currentStepIndex,
  DEFAULT_STEP_DAYS,
  documentDeadlines,
  documentStatus,
  routeIssues,
  type IRouteIssue,
} from "@/utils/document";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
let newStepId = 0;

/**
 * Документ и маршрут. Черновик правится локально (порядок, сроки, передача, «Оставить») и
 * сохраняется целиком; у отправленного передача заместителю — сразу запросом, с «Отменить».
 */
export const useDocumentPage = () => {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const query = useDocument(id);
  const availability = useAvailability();
  const saveRoute = useSaveRoute();
  const sendDocument = useSendDocument();
  const patchStep = usePatchStep();
  const decide = useDecideDocument();
  const { calendar, employees, absences, delegations, employeeById, statusOf } = availability;
  const today = todayISO();

  const document = query.data;
  /** Несохранённый маршрут черновика; null — как на сервере */
  const [draftSteps, setDraftSteps] = useState<IApprovalStep[] | null>(null);
  const [startInput, setStartInput] = useState(today);
  const [busyStepId, setBusyStepId] = useState<string | null>(null);
  const [isRejecting, setRejecting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const status = document ? documentStatus(document) : "draft";
  const isAuthor = Boolean(document && user && document.authorId === user.id);
  const canEdit = isAuthor && status === "draft";
  const canDelegate = isAuthor && (status === "draft" || status === "in_progress");
  const steps = draftSteps ?? document?.steps ?? [];
  const start = ISO.test(startInput) ? startInput : today;
  const view: IDocument | undefined = document ? { ...document, steps } : undefined;
  const context = { calendar, employees, absences, delegations };
  const deadlines = view ? documentDeadlines(view, context, start) : [];
  const issues: IRouteIssue[] =
    view && (status === "draft" || status === "in_progress")
      ? routeIssues(view, deadlines, context)
      : [];
  const currentIndex = view ? currentStepIndex(view) : -1;
  const currentStep = steps[currentIndex];
  const canDecide = Boolean(currentStep && user && actorOf(currentStep) === user.id);
  const lastDue = deadlines.at(-1)?.due ?? null;
  const routeStart = document?.routeStartedAt ?? start;
  const totalWorkingDays = lastDue
    ? countWorkingDays(calendar, shiftISODate(routeStart, 1), lastDue)
    : 0;
  const rejectedStep = steps.find((s) => s.status === "rejected");

  const nameOf = (employeeId: string | null | undefined) => {
    const person = employeeId ? employeeById(employeeId) : undefined;
    return person ? shortName(person.fullName) : "сотрудник";
  };

  const editSteps = (recipe: (current: IApprovalStep[]) => IApprovalStep[]) =>
    setDraftSteps((current) => recipe(current ?? document?.steps ?? []));

  const updateStep = (stepId: string, patch: Partial<IApprovalStep>) =>
    editSteps((current) => current.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));

  /** Изменить этап: в черновике — локально, у отправленного — запросом. Тост с «Отменить» */
  const changeStep = async (step: IApprovalStep, dto: IStepPatchDto, message: string) => {
    const previous: IStepPatchDto = {
      delegatedToId: step.delegatedToId ?? null,
      waitForReturn: step.waitForReturn ?? false,
    };
    const toLocal = (patch: IStepPatchDto): Partial<IApprovalStep> => ({
      ...("delegatedToId" in patch && { delegatedToId: patch.delegatedToId ?? undefined }),
      ...("waitForReturn" in patch && { waitForReturn: patch.waitForReturn }),
      ...(patch.delegatedToId && { waitForReturn: false }),
    });

    if (canEdit) {
      updateStep(step.id, toLocal(dto));
      toast.success(message, {
        duration: UNDO_TOAST_MS,
        action: { label: "Отменить", onClick: () => updateStep(step.id, toLocal(previous)) },
      });
      return true;
    }
    if (!document) return false;
    setBusyStepId(step.id);
    try {
      await patchStep.mutateAsync({ id: document.id, stepId: step.id, dto });
      toast.success(message, {
        duration: UNDO_TOAST_MS,
        action: {
          label: "Отменить",
          onClick: () => void patchStep.mutate({ id: document.id, stepId: step.id, dto: previous }),
        },
      });
      return true;
    } catch {
      toast.error("Не удалось изменить этап — повторите");
      return false;
    } finally {
      setBusyStepId(null);
    }
  };

  const delegateStep = (step: IApprovalStep, toId: string) =>
    void changeStep(step, { delegatedToId: toId }, `Этап передан: ${nameOf(toId)}`);

  /** «Передать заместителям (N)» — все проблемные этапы, где заместитель найден */
  const delegateAll = async () => {
    const targets = issues.filter((issue) => issue.deputyId);
    if (canEdit) {
      editSteps((current) =>
        current.map((s) => {
          const issue = targets.find((t) => t.step.id === s.id);
          return issue ? { ...s, delegatedToId: issue.deputyId!, waitForReturn: false } : s;
        }),
      );
      toast.success(`Передано заместителям: ${targets.length}`);
      return;
    }
    if (!document) return;
    try {
      for (const issue of targets) {
        await patchStep.mutateAsync({
          id: document.id,
          stepId: issue.step.id,
          dto: { delegatedToId: issue.deputyId },
        });
      }
      toast.success(`Передано заместителям: ${targets.length}`);
    } catch {
      toast.error("Передать удалось не всем — повторите");
    }
  };

  const toDto = (list: IApprovalStep[]) => ({
    steps: list.map((s) => ({
      id: s.id.startsWith("new-") ? undefined : s.id,
      approverId: s.approverId,
      durationDays: s.durationDays,
      delegatedToId: s.delegatedToId,
      waitForReturn: s.waitForReturn,
    })),
  });

  const save = async () => {
    if (!document) return false;
    try {
      await saveRoute.mutateAsync({ id: document.id, dto: toDto(steps) });
      setDraftSteps(null);
      return true;
    } catch (error) {
      toast.error(
        `Не удалось сохранить маршрут${error && typeof error === "object" && "message" in error ? `: ${String(error.message)}` : ""}`,
      );
      return false;
    }
  };

  const send = async () => {
    if (!document) return;
    setSendError(null);
    if (draftSteps && !(await save())) return;
    try {
      await sendDocument.mutateAsync({ id: document.id, start });
      toast.success(`Отправлено: сейчас у ${nameOf(steps[0] ? actorOf(steps[0]) : null)}`);
    } catch {
      setSendError("Не удалось отправить — маршрут сохранён");
    }
  };

  const decideAs = async (decision: "approved" | "rejected", reason?: string) => {
    if (!document || !user) return;
    try {
      await decide.mutateAsync({ id: document.id, dto: { byId: user.id, decision, reason } });
      setRejecting(false);
      toast.success(decision === "approved" ? "Согласовано" : "Документ отклонён");
    } catch (error) {
      toast.error(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Не удалось сохранить решение",
      );
    }
  };

  return {
    id,
    document,
    steps,
    deadlines,
    issues,
    status,
    today,
    calendar,
    employees,
    employeeById,
    statusOf,
    author: document ? employeeById(document.authorId) : undefined,
    isAuthor,
    canEdit,
    canDelegate,
    canDecide,
    currentIndex,
    currentStep,
    rejectedStep,
    lastDue,
    totalWorkingDays,
    start: startInput,
    setStart: setStartInput,
    /** Плановая дата старта нового этапа — для статуса в «Добавить согласующего» */
    nextStepStart: lastDue ?? start,
    isDirty: draftSteps !== null,
    busyStepId,
    addApprover: (employeeId: string) =>
      editSteps((current) => [
        ...current,
        {
          id: `new-${++newStepId}`,
          approverId: employeeId,
          durationDays: DEFAULT_STEP_DAYS,
          status: "waiting",
        },
      ]),
    removeStep: (index: number) => {
      const before = steps;
      const removed = steps[index];
      editSteps((current) => current.filter((_, i) => i !== index));
      toast(`Удалён этап: ${nameOf(removed?.approverId)}`, {
        duration: UNDO_TOAST_MS,
        action: { label: "Отменить", onClick: () => setDraftSteps(before) },
      });
    },
    moveStep: (index: number, direction: -1 | 1) =>
      editSteps((current) => {
        const next = [...current];
        const target = index + direction;
        if (target < 0 || target >= next.length) return current;
        [next[index], next[target]] = [next[target]!, next[index]!];
        return next;
      }),
    setDuration: (index: number, days: number) =>
      editSteps((current) =>
        current.map((s, i) => (i === index ? { ...s, durationDays: days } : s)),
      ),
    delegateStep,
    delegateAll: () => void delegateAll(),
    returnStep: (step: IApprovalStep) =>
      void changeStep(step, { delegatedToId: null }, `Этап возвращён: ${nameOf(step.approverId)}`),
    waitStep: (step: IApprovalStep, wait: boolean) =>
      void changeStep(
        step,
        { waitForReturn: wait },
        wait ? `Этап ждёт выхода: ${nameOf(step.approverId)}` : "Этап больше не ждёт выхода",
      ),
    save: () =>
      void save().then((ok) => {
        if (ok) toast.success("Маршрут сохранён");
      }),
    isSaving: saveRoute.isPending,
    send: () => void send(),
    isSending: sendDocument.isPending || saveRoute.isPending,
    sendError,
    approve: () => void decideAs("approved"),
    startReject: () => setRejecting(true),
    cancelReject: () => setRejecting(false),
    confirmReject: (reason: string) => void decideAs("rejected", reason),
    isRejecting,
    isDeciding: decide.isPending,
    nameOf,
    isLoading: query.isPending || availability.isLoading,
    isNotFound: query.error?.status === 404,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
      availability.refetch();
    },
  };
};
