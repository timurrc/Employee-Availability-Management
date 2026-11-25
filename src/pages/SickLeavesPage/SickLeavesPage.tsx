import { HeartPulse, Plus, Search } from "lucide-react";
import DeputyDialog from "@/components/modules/DeputyDialog/DeputyDialog";
import CloseSickDialog from "@/components/modules/SickLeaveDialogs/CloseSickDialog";
import ExtendSickDialog from "@/components/modules/SickLeaveDialogs/ExtendSickDialog";
import SickLeaveForm from "@/components/modules/SickLeaveForm/SickLeaveForm";
import SickLeaveList from "@/components/modules/SickLeaveList/SickLeaveList";
import Alert from "@/components/ui/Alert/Alert";
import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import ErrorState from "@/components/ui/ErrorState/ErrorState";
import Input from "@/components/ui/Input/Input";
import SegmentedControl from "@/components/ui/SegmentedControl/SegmentedControl";
import Select from "@/components/ui/Select/Select";
import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";
import { plural } from "@/utils/date";
import { SICK_TABS } from "@/utils/sickLeave";
import { useSickLeavesPage } from "./useSickLeavesPage";

const LoadingState = () => (
  <div role="status" aria-label="Загрузка" className="flex flex-col gap-3">
    <Delayed>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </Delayed>
  </div>
);

/** Больничные (HR) — docs/design/screens/04-sick-leaves.md */
const SickLeavesPage = () => {
  const page = useSickLeavesPage();
  const { today } = page;

  const list = page.isLoading ? (
    <LoadingState />
  ) : page.isError ? (
    <ErrorState what="больничные" onRetry={page.refetch} />
  ) : page.rows.length === 0 ? (
    page.hasFilters ? (
      <EmptyState
        icon={Search}
        title="Ничего не найдено"
        description="Попробуйте изменить поиск или подразделение."
        action={
          <Button variant="secondary" onClick={page.resetFilters}>
            Сбросить фильтры
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={HeartPulse}
        title={page.tab === "open" ? "Открытых больничных нет" : "Больничных нет"}
        action={
          page.tab === "open" && (
            <Button onClick={page.openForm}>
              <Plus aria-hidden />
              Открыть больничный
            </Button>
          )
        }
      />
    )
  ) : (
    <Card flush>
      <SickLeaveList
        rows={page.rows}
        today={today}
        employeeById={page.employeeById}
        stepsOf={page.stepsOf}
        busyVacationId={page.busyVacationId}
        onExtend={page.startExtend}
        onClose={page.startClose}
        onAssign={(row) => page.assign(row.employee)}
        onExtendVacation={page.extendVacationBy}
      />
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Больничные</h1>
        <Button onClick={page.openForm}>
          <Plus aria-hidden />
          Открыть больничный
        </Button>
      </header>

      {page.overlapTotal > 0 && !page.onlyOverlaps && (
        <Alert
          tone="warning"
          title={`${page.overlapTotal} ${plural(page.overlapTotal, ["пересечение", "пересечения", "пересечений"])} с отпуском ${plural(page.overlapTotal, ["ждёт", "ждут", "ждут"])} решения`}
          actions={
            <Button size="sm" variant="secondary" onClick={page.showOverlaps}>
              Показать
            </Button>
          }
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          label="Больничные"
          value={page.tab}
          options={SICK_TABS.map((tab) =>
            tab.value === "open" ? { ...tab, label: `${tab.label} · ${page.openCount}` } : tab,
          )}
          onChange={page.setTab}
        />
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <Input
            type="search"
            aria-label="Поиск по ФИО"
            placeholder="Поиск по ФИО"
            value={page.query}
            onChange={(event) => page.setQuery(event.target.value)}
            className="w-56"
          />
          <Select
            aria-label="Подразделение"
            value={page.departmentId}
            onChange={(event) => page.setDepartmentId(event.target.value)}
          >
            <option value="">Все подразделения</option>
            {page.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {page.onlyOverlaps && (
        <p className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          Показаны только пересечения с отпуском.
          <Button size="sm" variant="ghost" onClick={page.resetFilters}>
            Показать все
          </Button>
        </p>
      )}

      {list}

      {page.isFormOpen && <SickLeaveForm onClose={page.closeForm} onAssignDeputy={page.assign} />}
      {page.extending && (
        <ExtendSickDialog
          leave={page.extending.leave}
          name={page.nameOf(page.extending)}
          today={today}
          isPending={page.isExtendPending}
          error={page.extendError}
          onConfirm={page.confirmExtend}
          onClose={page.cancelExtend}
        />
      )}
      {page.closing && (
        <CloseSickDialog
          leave={page.closing.leave}
          name={page.nameOf(page.closing)}
          calendar={page.calendar}
          absences={page.absences}
          today={today}
          isPending={page.isClosePending}
          error={page.closeError}
          onConfirm={page.confirmClose}
          onClose={page.cancelClose}
        />
      )}
      {page.assigning && (
        <DeputyDialog
          employee={page.assigning}
          employees={page.employees}
          onClose={page.cancelAssign}
        />
      )}
    </div>
  );
};

export default SickLeavesPage;
