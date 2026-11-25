import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "@/api/axios.api";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { DocumentService } from "@/services/document.service";
import type { IDocument } from "@/types/document.types";

export const useDocuments = () =>
  useQuery<IDocument[], ApiError>({
    queryKey: QUERY_KEYS.documents.all,
    queryFn: ({ signal }) => DocumentService.getAll(signal),
  });

export const useDocument = (id: string | undefined) =>
  useQuery<IDocument, ApiError>({
    queryKey: QUERY_KEYS.documents.byId(id ?? ""),
    queryFn: ({ signal }) => DocumentService.getById(id!, signal),
    enabled: Boolean(id),
  });
