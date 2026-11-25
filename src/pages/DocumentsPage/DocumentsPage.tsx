import { FileText, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import NewDocumentDialog from "@/components/modules/NewDocumentDialog/NewDocumentDialog";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Badge from "@/components/ui/Badge/Badge";
import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import ErrorState from "@/components/ui/ErrorState/ErrorState";
import Input from "@/components/ui/Input/Input";
import SegmentedControl from "@/components/ui/SegmentedControl/SegmentedControl";
import Select from "@/components/ui/Select/Select";
import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";
import Table, { type TableColumn } from "@/components/ui/Table/Table";
import { buildPath, ROUTES } from "@/constants/routes";
import { formatDay } from "@/utils/date";
import {
  DOCUMENT_STATUS_META,
  DOCUMENT_TABS,
  DOCUMENT_TYPE_LABELS,
  type IDocumentRow,
} from "@/utils/document";
import { useDocumentsPage } from "./useDocumentsPage";

const LoadingState = () => (
  <div role="status" aria-label="Загрузка" className="flex flex-col gap-2">
    <Delayed>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </Delayed>
  </div>
);

/** Документы — docs/design/screens/07-document-route.md, «Список документов» */
const DocumentsPage = () => {
  const page = useDocumentsPage();
  const { today } = page;

  const stateOf = (row: IDocumentRow) => {
    const meta = DOCUMENT_STATUS_META[row.status];
    return (
      <span className="flex flex-col gap-0.5">
        <Badge tone={meta.tone} className="self-start">
          {meta.label}
          {row.decidedAt && ` ${formatDay(row.decidedAt, today)}`}
        </Badge>
        {row.stepNumber && (
          <span className="text-sm text-[var(--color-text-muted)]">
            этап {row.stepNumber} из {row.document.steps.length}
          </span>
        )}
      </span>
    );
  };

  const currentOf = (row: IDocumentRow) => {
    const person = row.currentId ? page.employeeById(row.currentId) : undefined;
    if (!person) return <span className="text-[var(--color-text-subtle)]">—</span>;
    const date = row.currentDeadline?.start ?? today;
    return (
      <span className="flex flex-wrap items-center gap-2">
        <PersonChip
          person={person}
          status={page.statusOf(person.id, date)}
          date={date}
          variant="row"
        />
        {row.atRisk && <Badge tone="warning">Риск срока</Badge>}
      </span>
    );
  };

  const title = (row: IDocumentRow) => (
    <Link
      to={buildPath(ROUTES.DOCUMENT, { id: row.document.id })}
      className="hover:text-[var(--color-primary)] hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="font-mono text-sm text-[var(--color-text-muted)]">
        {row.document.number}
      </span>{" "}
      {row.document.title}
    </Link>
  );

  const columns: TableColumn<IDocumentRow>[] = [
    {
      key: "title",
      header: "Документ",
      cell: title,
      sortValue: (row) => row.document.number,
    },
    { key: "status", header: "Статус", cell: stateOf, sortValue: (row) => row.status },
    { key: "current", header: "Сейчас у", cell: currentOf },
    {
      key: "decision",
      header: "Решение ≈",
      cell: (row) => (row.decisionDate ? formatDay(row.decisionDate, today) : "—"),
      sortValue: (row) => row.decisionDate ?? "9999",
      align: "right",
    },
  ];

  const content = page.isLoading ? (
    <LoadingState />
  ) : page.isError ? (
    <ErrorState what="документы" onRetry={page.refetch} />
  ) : (
    <Card flush>
      <Table
        caption="Документы"
        columns={columns}
        rows={page.rows}
        getRowId={(row) => row.document.id}
        onRowClick={(row) => page.open(row.document.id)}
        renderCard={(row) => (
          <div className="flex flex-col gap-2">
            {title(row)}
            {stateOf(row)}
            {currentOf(row)}
            {row.decisionDate && (
              <span className="text-sm text-[var(--color-text-muted)]">
                Решение ≈ {formatDay(row.decisionDate, today)}
              </span>
            )}
          </div>
        )}
        empty={
          page.hasFilters ? (
            <EmptyState
              icon={Search}
              title="Ничего не найдено"
              action={
                <Button variant="secondary" onClick={page.resetFilters}>
                  Сбросить фильтры
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title={page.tab === "waiting" ? "Вашего решения ничего не ждёт" : "Документов нет"}
              action={
                page.tab !== "all" && (
                  <Button variant="secondary" onClick={() => page.setTab("all")}>
                    Показать все документы
                  </Button>
                )
              }
            />
          )
        }
      />
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Документы</h1>
        <Button onClick={page.startCreate}>
          <Plus aria-hidden />
          Новый документ
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          label="Документы"
          value={page.tab}
          options={DOCUMENT_TABS.map((tab) =>
            tab.value === "waiting" && page.waitingCount > 0
              ? { ...tab, label: `${tab.label} · ${page.waitingCount}` }
              : tab,
          )}
          onChange={page.setTab}
        />
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <Select
            aria-label="Статус"
            value={page.status}
            onChange={(e) => page.setStatus(e.target.value)}
          >
            <option value="">Все статусы</option>
            {Object.entries(DOCUMENT_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Тип" value={page.type} onChange={(e) => page.setType(e.target.value)}>
            <option value="">Все типы</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            type="search"
            aria-label="Номер или название"
            placeholder="Номер, название"
            value={page.query}
            onChange={(event) => page.setQuery(event.target.value)}
            className="w-56"
          />
        </div>
      </div>

      {content}

      {page.isCreating && (
        <NewDocumentDialog
          isPending={page.isCreatePending}
          error={page.createError}
          onCreate={page.createDocument}
          onClose={page.cancelCreate}
        />
      )}
    </div>
  );
};

export default DocumentsPage;
