import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { buildPath, ROUTES } from "@/constants/routes";
import { useAvailability } from "@/hooks/useAvailability";
import { useCreateDocument, useDocuments } from "@/hooks/useDocuments";
import { useAuthStore } from "@/store/auth.store";
import type { DocumentStatus, DocumentType } from "@/types/document.types";
import { todayISO } from "@/utils/date";
import {
  DOCUMENT_STATUS_META,
  DOCUMENT_TYPE_LABELS,
  documentRows,
  filterDocumentRows,
  isDocumentTab,
  type DocumentTab,
} from "@/utils/document";

/** «Документы»: вкладка, статус и тип — в URL; поиск по номеру и названию — локально */
export const useDocumentsPage = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const documentsQuery = useDocuments();
  const availability = useAvailability();
  const create = useCreateDocument();
  const { calendar, employees, absences, delegations, employeeById, statusOf } = availability;
  const today = todayISO();
  const viewerId = user?.id ?? "";

  const rawTab = params.get("tab");
  const tab: DocumentTab = isDocumentTab(rawTab) ? rawTab : "mine";
  const rawStatus = params.get("status") ?? "";
  const status = (rawStatus in DOCUMENT_STATUS_META ? rawStatus : "") as DocumentStatus | "";
  const rawType = params.get("type") ?? "";
  const type = (rawType in DOCUMENT_TYPE_LABELS ? rawType : "") as DocumentType | "";
  const [query, setQuery] = useState("");
  const [isCreating, setCreating] = useState(false);

  const allRows = documentRows(documentsQuery.data ?? [], {
    calendar,
    employees,
    absences,
    delegations,
  });
  const rows = filterDocumentRows(allRows, { tab, status, type, query }, viewerId);
  const waitingCount = allRows.filter((row) => row.currentId === viewerId).length;

  const setParam = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  return {
    today,
    rows,
    tab,
    setTab: (value: DocumentTab) => setParam("tab", value === "mine" ? "" : value),
    waitingCount,
    status,
    setStatus: (value: string) => setParam("status", value),
    type,
    setType: (value: string) => setParam("type", value),
    query,
    setQuery,
    hasFilters: Boolean(status || type || query),
    resetFilters: () => {
      setQuery("");
      setParams(tab === "mine" ? {} : { tab }, { replace: true });
    },
    employeeById,
    statusOf,
    open: (id: string) => navigate(buildPath(ROUTES.DOCUMENT, { id })),
    isCreating,
    startCreate: () => {
      create.reset();
      setCreating(true);
    },
    cancelCreate: () => setCreating(false),
    createDocument: (dto: { title: string; type: DocumentType }) =>
      void create
        .mutateAsync({ ...dto, authorId: viewerId })
        .then((document) => navigate(buildPath(ROUTES.DOCUMENT, { id: document.id })))
        .catch(() => undefined),
    isCreatePending: create.isPending,
    createError: create.error?.message,
    isLoading: documentsQuery.isPending || availability.isLoading,
    isError: documentsQuery.isError,
    refetch: () => void documentsQuery.refetch(),
  };
};
