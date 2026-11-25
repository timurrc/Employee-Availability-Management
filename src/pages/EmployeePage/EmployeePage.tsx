import { ChevronLeft, Mail, UserRoundSearch } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AbsenceHistory from "@/components/modules/AbsenceHistory/AbsenceHistory";
import DelegationDialog from "@/components/modules/DelegationDialog/DelegationDialog";
import DeputyDialog from "@/components/modules/DeputyDialog/DeputyDialog";
import EmployeeNow from "@/components/modules/EmployeeNow/EmployeeNow";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import VacationBalance from "@/components/modules/VacationBalance/VacationBalance";
import Avatar from "@/components/ui/Avatar/Avatar";
import Badge from "@/components/ui/Badge/Badge";
import Card from "@/components/ui/Card/Card";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import ErrorState from "@/components/ui/ErrorState/ErrorState";
import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";
import { APPROVAL_STATUS_META } from "@/constants/absence";
import { buildPath, ROUTES } from "@/constants/routes";
import { describeStatus } from "@/utils/availability";
import { formatDay } from "@/utils/date";
import { useEmployeePage } from "./useEmployeePage";

const LoadingState = () => (
  <div role="status" aria-label="Загрузка" className="flex flex-col gap-6">
    <Delayed>
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-36 w-full rounded-[var(--radius-lg)]" />
    </Delayed>
  </div>
);

const EmployeePage = () => {
  const page = useEmployeePage();
  const navigate = useNavigate();
  const { employee, today } = page;

  const back = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(ROUTES.TEAM))}
      className="inline-flex cursor-pointer items-center gap-1 self-start text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Назад
    </button>
  );

  if (page.isLoading) return <LoadingState />;

  if (page.isNotFound || !employee) {
    if (page.error && !page.isNotFound) {
      return (
        <ErrorState what="карточку сотрудника" reason={page.error.message} onRetry={page.refetch} />
      );
    }
    return (
      <EmptyState
        icon={UserRoundSearch}
        title="Сотрудник не найден"
        description="Возможно, ссылка устарела или сотрудник уволен."
        action={
          <Link
            to={ROUTES.TEAM}
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            К списку команды
          </Link>
        }
      />
    );
  }

  const view = page.status ? describeStatus(page.status, today) : null;

  return (
    <div className="flex flex-col gap-6">
      {back}

      <header className="flex flex-wrap items-start gap-4">
        <Avatar name={employee.fullName} size="xl" ring={view?.ring} soon={view?.soon} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{employee.fullName}</h1>
          <p className="flex flex-wrap items-baseline gap-x-1 text-[var(--color-text-muted)]">
            {employee.position}
            {page.department && <> · {page.department.name}</>}
            {page.manager && (
              <>
                {" "}
                · Руководитель: <PersonChip person={page.manager} variant="inline" />
              </>
            )}
          </p>
        </div>
        <a
          href={`mailto:${employee.email}`}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3.5 font-medium hover:bg-[var(--color-surface-2)]"
        >
          <Mail className="size-4" aria-hidden />
          Написать
        </a>
      </header>

      {page.isStatusError || !page.status ? (
        <Card title="Сейчас">
          <ErrorState compact what="статус сотрудника" onRetry={page.refetch} />
        </Card>
      ) : (
        <EmployeeNow
          status={page.status}
          today={today}
          day={page.day}
          statusDate={page.statusDate}
          returnsOn={page.returnsOn}
          permanentDeputy={page.permanentDeputy}
          permanentDeputyStatus={page.permanentDeputyStatus}
          next={page.next}
          employeeById={page.employeeById}
          canSeeEln={page.canSeeEln}
          delegations={page.delegations}
          onChangeDeputy={page.openDeputy}
          onDelegate={page.openDelegation}
          onRemoveDelegation={page.removeDelegation}
          removingId={page.removingId}
        />
      )}

      <Card>
        <AbsenceHistory plan={page.plan} history={page.history} today={today} />
      </Card>

      {page.balance && <VacationBalance summary={page.balance} today={today} compact />}

      {page.documents.length > 0 && (
        <Card title="Документы на нём" flush>
          <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {page.documents.map(({ document, step, deadline }) => {
              const status = APPROVAL_STATUS_META[step.status];
              const atRisk = deadline && deadline.risk !== "none";
              return (
                <li
                  key={`${document.id}-${step.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                >
                  <Link
                    to={buildPath(ROUTES.DOCUMENT, { id: document.id })}
                    className="min-w-0 flex-1 hover:text-[var(--color-primary)] hover:underline"
                  >
                    <span className="font-mono text-sm text-[var(--color-text-muted)]">
                      {document.number}
                    </span>{" "}
                    {document.title}
                  </Link>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {deadline && step.status === "in_progress" && (
                    <span
                      className={
                        atRisk
                          ? "text-sm text-[var(--color-warning)]"
                          : "text-sm text-[var(--color-text-muted)]"
                      }
                    >
                      срок {formatDay(deadline.due, today)}
                      {atRisk && " · риск"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {page.documentsState.isError && <ErrorState compact what="документы" />}

      {page.dialog === "deputy" && (
        <DeputyDialog employee={employee} employees={page.employees} onClose={page.closeDialog} />
      )}
      {page.dialog === "delegation" && (
        <DelegationDialog
          employee={employee}
          employees={page.employees}
          createdById={page.viewerId}
          today={today}
          initial={page.delegationInitial}
          onClose={page.closeDialog}
        />
      )}
    </div>
  );
};

export default EmployeePage;
