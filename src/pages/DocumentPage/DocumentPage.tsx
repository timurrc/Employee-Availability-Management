import { ChevronLeft, FileQuestion, Send, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import AddApprover from "@/components/modules/ApprovalRoute/AddApprover";
import RouteStep from "@/components/modules/ApprovalRoute/RouteStep";
import RejectDialog from "@/components/modules/ApprovalQueue/RejectDialog";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Alert from "@/components/ui/Alert/Alert";
import Badge from "@/components/ui/Badge/Badge";
import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import ErrorState from "@/components/ui/ErrorState/ErrorState";
import Input from "@/components/ui/Input/Input";
import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";
import { ROUTES } from "@/constants/routes";
import { formatDay, formatDays, plural } from "@/utils/date";
import { DOCUMENT_STATUS_META, DOCUMENT_TYPE_LABELS } from "@/utils/document";
import { useDocumentPage } from "./useDocumentPage";

const LoadingState = () => (
  <div role="status" aria-label="Загрузка" className="flex flex-col gap-4">
    <Delayed>
      <Skeleton className="h-8 w-96 max-w-full" />
      <Skeleton className="h-4 w-64" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </Delayed>
  </div>
);

const back = (
  <Link
    to={ROUTES.DOCUMENTS}
    className="inline-flex items-center gap-1 self-start text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
  >
    <ChevronLeft className="size-4" aria-hidden />
    Документы
  </Link>
);

/** Документ и маршрут согласования — docs/design/screens/07-document-route.md */
const DocumentPage = () => {
  const page = useDocumentPage();
  const { document, today } = page;

  if (page.isLoading) return <LoadingState />;
  if (!document) {
    return page.isNotFound || !page.error ? (
      <EmptyState
        icon={FileQuestion}
        title="Документ не найден"
        description="Возможно, ссылка устарела или документ удалён."
        action={
          <Link
            to={ROUTES.DOCUMENTS}
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            К документам
          </Link>
        }
      />
    ) : (
      <ErrorState what="документ" reason={page.error.message} onRetry={page.refetch} />
    );
  }

  const statusMeta = DOCUMENT_STATUS_META[page.status];
  const current = page.currentStep;
  const currentDeadline = page.deadlines[page.currentIndex];
  const delegatable = page.issues.filter((issue) => issue.deputyId);
  const handlers = {
    onDelegate: page.delegateStep,
    onReturn: page.returnStep,
    onWait: page.waitStep,
    onMove: page.moveStep,
    onRemove: page.removeStep,
    onDuration: page.setDuration,
  };

  return (
    <div className="flex flex-col gap-6">
      {back}

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">
            <span className="font-mono text-[var(--color-text-muted)]">{document.number}</span> ·{" "}
            {document.title}
          </h1>
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-1 text-[var(--color-text-muted)]">
          {DOCUMENT_TYPE_LABELS[document.type]} · Автор{" "}
          {page.author ? <PersonChip person={page.author} variant="inline" /> : "—"} · создан{" "}
          {formatDay(document.createdAt, today)}
        </p>
        {page.status === "in_progress" && current && (
          <p>
            Сейчас у{" "}
            <span className="font-medium">
              {page.nameOf(current.delegatedToId ?? current.approverId)}
            </span>{" "}
            · этап {page.currentIndex + 1} из {page.steps.length}
            {currentDeadline && ` · до ${formatDay(currentDeadline.due, today)}`}
          </p>
        )}
        {page.status === "rejected" && page.rejectedStep && (
          <Alert
            tone="danger"
            title={`Отклонил ${page.nameOf(page.rejectedStep.delegatedToId ?? page.rejectedStep.approverId)}`}
          >
            {page.rejectedStep.comment ? `«${page.rejectedStep.comment}»` : "Причина не указана"}
          </Alert>
        )}
        {page.status === "approved" && page.lastDue && (
          <Alert tone="success">Документ согласован всеми участниками маршрута.</Alert>
        )}
      </header>

      {page.canDecide && (
        <Card title="Ваше решение">
          <div className="flex flex-wrap gap-2">
            <Button isLoading={page.isDeciding} onClick={page.approve}>
              Согласовать
            </Button>
            <Button variant="secondary" onClick={page.startReject}>
              Отклонить
            </Button>
          </div>
        </Card>
      )}

      {page.issues.length > 0 && (
        <Alert
          tone="warning"
          title={`${page.issues.length} ${plural(page.issues.length, ["согласующий отсутствует", "согласующих отсутствуют", "согласующих отсутствуют"])} в даты своего этапа`}
          actions={
            page.canDelegate &&
            delegatable.length > 0 && (
              <Button size="sm" variant="secondary" onClick={page.delegateAll}>
                Передать заместителям ({delegatable.length})
              </Button>
            )
          }
        >
          <ul className="flex flex-col gap-0.5">
            {page.issues.map(({ step, deputyId, deadline }) => (
              <li key={step.id}>
                {page.nameOf(step.approverId)}
                {deadline.risk === "absent_in_window"
                  ? " уйдёт до окончания срока"
                  : " отсутствует"}
                {deputyId ? ` — замещает ${page.nameOf(deputyId)}` : " — нет замещающего"}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <Card
        title="Маршрут согласования"
        flush
        aside={
          page.canEdit ? (
            <Input
              type="date"
              aria-label="Дата старта"
              value={page.start}
              onChange={(event) => page.setStart(event.target.value)}
              className="h-8"
            />
          ) : document.routeStartedAt ? (
            <span className="text-sm text-[var(--color-text-muted)]">
              Старт {formatDay(document.routeStartedAt, today)}
            </span>
          ) : null
        }
      >
        {page.steps.length === 0 ? (
          <div className="border-t border-[var(--color-border)] px-4 py-6">
            <EmptyState
              icon={UserPlus}
              title="Маршрут пуст"
              description={
                page.canEdit
                  ? "Добавьте согласующих — мы покажем, кто из них на месте."
                  : "Автор ещё не добавил согласующих."
              }
            />
          </div>
        ) : (
          <ol
            className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]"
            aria-label="Этапы"
          >
            {page.steps.map((step, index) => (
              <RouteStep
                key={step.id}
                step={step}
                index={index}
                total={page.steps.length}
                deadline={page.deadlines[index]}
                issue={page.issues.find((issue) => issue.step.id === step.id)}
                calendar={page.calendar}
                today={today}
                employees={page.employees}
                employeeById={page.employeeById}
                canEdit={page.canEdit}
                canDelegate={page.canDelegate}
                isCurrent={index === page.currentIndex}
                isBusy={page.busyStepId === step.id}
                {...handlers}
              />
            ))}
          </ol>
        )}

        {page.canEdit && (
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <AddApprover
              employees={page.employees}
              excludeIds={page.steps.map((s) => s.approverId)}
              date={page.nextStepStart}
              statusOf={page.statusOf}
              employeeById={page.employeeById}
              onAdd={page.addApprover}
            />
          </div>
        )}

        {page.lastDue && page.status !== "approved" && page.status !== "rejected" && (
          <p className="border-t border-[var(--color-border)] px-4 py-3">
            Итог: решение ожидается{" "}
            <span className="font-semibold">{formatDay(page.lastDue, today)}</span> ·{" "}
            {formatDays(page.totalWorkingDays, "working", true)}
          </p>
        )}
      </Card>

      {page.canEdit && (
        <div className="flex flex-col items-end gap-2">
          {page.sendError && (
            <Alert
              tone="danger"
              className="w-full"
              actions={
                <Button size="sm" variant="secondary" onClick={page.send}>
                  Повторить
                </Button>
              }
            >
              {page.sendError}
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              isLoading={page.isSaving && !page.isSending}
              disabled={!page.isDirty}
              onClick={page.save}
            >
              Сохранить
            </Button>
            <Button
              isLoading={page.isSending}
              disabled={page.steps.length === 0}
              title={page.steps.length === 0 ? "Добавьте согласующих" : undefined}
              onClick={page.send}
            >
              <Send aria-hidden />
              Отправить на согласование
            </Button>
          </div>
        </div>
      )}

      {page.isRejecting && (
        <RejectDialog
          title="Отклонить документ"
          subject={`${document.number} · ${document.title}`}
          isPending={page.isDeciding}
          onConfirm={page.confirmReject}
          onClose={page.cancelReject}
        />
      )}
    </div>
  );
};

export default DocumentPage;
