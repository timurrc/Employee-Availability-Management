import { Plus } from "lucide-react";
import AllRequests from "@/components/modules/AllRequests/AllRequests";
import ApprovalQueue from "@/components/modules/ApprovalQueue/ApprovalQueue";
import RejectDialog from "@/components/modules/ApprovalQueue/RejectDialog";
import VacationBalance from "@/components/modules/VacationBalance/VacationBalance";
import VacationForm from "@/components/modules/VacationForm/VacationForm";
import VacationRequests from "@/components/modules/VacationRequests/VacationRequests";
import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import ErrorState from "@/components/ui/ErrorState/ErrorState";
import SegmentedControl from "@/components/ui/SegmentedControl/SegmentedControl";
import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";
import { shortName } from "@/utils/availability";
import { formatPeriod } from "@/utils/date";
import { useVacationsPage } from "./useVacationsPage";

const LoadingState = () => (
  <div role="status" aria-label="Загрузка" className="flex flex-col gap-3">
    <Delayed>
      <Skeleton className="h-28 w-full rounded-[var(--radius-lg)]" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </Delayed>
  </div>
);

const VacationsPage = () => {
  const page = useVacationsPage();
  const { today } = page;

  const content = page.isLoading ? (
    <LoadingState />
  ) : page.isError ? (
    <ErrorState what="заявки на отпуск" onRetry={page.refetch} />
  ) : page.tab === "queue" ? (
    <Card title={`На согласовании · ${page.queue.length}`} flush>
      <ApprovalQueue
        rows={page.queue}
        decided={page.decided}
        calendar={page.calendar}
        employees={page.employees}
        absences={page.absences}
        today={today}
        busyId={page.busyId}
        employeeById={page.employeeById}
        statusOf={page.statusOf}
        summaryOf={page.summaryOf}
        onApprove={page.approve}
        onApproveMany={(rows) => void page.approveMany(rows)}
        onReject={page.startReject}
      />
    </Card>
  ) : page.tab === "all" ? (
    <Card title="Все заявки" flush>
      <AllRequests
        requests={page.allRequests}
        departments={page.departments}
        showDepartmentFilter={page.role !== "manager"}
        today={today}
        employeeById={page.employeeById}
      />
    </Card>
  ) : (
    <div className="flex flex-col gap-4">
      {page.summary && <VacationBalance summary={page.summary} today={today} />}
      <Card title="Заявки" flush>
        <VacationRequests
          requests={page.requests}
          calendar={page.calendar}
          today={today}
          employeeById={page.employeeById}
          managerId={page.me?.managerId ?? null}
          busyId={page.busyId}
          onEdit={page.editRequest}
          onCancel={page.cancelRequest}
          onDelete={page.deleteRequest}
          onCreate={() => page.openForm()}
        />
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Отпуска</h1>
        <Button onClick={() => page.openForm()}>
          <Plus aria-hidden />
          Новая заявка
        </Button>
      </header>

      {page.tabs.length > 1 && (
        <SegmentedControl
          label="Раздел"
          value={page.tab}
          options={page.tabs}
          onChange={page.setTab}
          className="self-start"
        />
      )}

      {content}

      {page.form && <VacationForm init={page.form} onClose={page.closeForm} />}
      {page.rejecting && (
        <RejectDialog
          subject={`${shortName(page.rejecting.employee.fullName)} · ${formatPeriod(page.rejecting.absence.period, today)}`}
          isPending={page.isRejectPending}
          onConfirm={(reason) => void page.confirmReject(reason)}
          onClose={page.cancelReject}
        />
      )}
    </div>
  );
};

export default VacationsPage;
