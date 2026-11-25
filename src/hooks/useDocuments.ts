import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/api/axios.api";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { DocumentService } from "@/services/document.service";
import type { ISODate } from "@/types/common.types";
import type {
  ICreateDocumentDto,
  IDecisionDto,
  IDocument,
  IRouteDto,
  IStepPatchDto,
} from "@/types/document.types";

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

/** Ответ — документ целиком: кладём в кэш карточки и обновляем список */
const usePutDocument = () => {
  const queryClient = useQueryClient();
  return (document: IDocument) => {
    queryClient.setQueryData(QUERY_KEYS.documents.byId(document.id), document);
    return queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all, exact: true });
  };
};

export const useCreateDocument = () => {
  const put = usePutDocument();
  return useMutation<IDocument, ApiError, ICreateDocumentDto>({
    mutationFn: DocumentService.create,
    onSuccess: put,
  });
};

export const useSaveRoute = () => {
  const put = usePutDocument();
  return useMutation<IDocument, ApiError, { id: string; dto: IRouteDto }>({
    mutationFn: ({ id, dto }) => DocumentService.saveRoute(id, dto),
    onSuccess: put,
  });
};

export const useSendDocument = () => {
  const put = usePutDocument();
  return useMutation<IDocument, ApiError, { id: string; start: ISODate }>({
    mutationFn: ({ id, start }) => DocumentService.send(id, start),
    onSuccess: put,
  });
};

export const usePatchStep = () => {
  const put = usePutDocument();
  return useMutation<IDocument, ApiError, { id: string; stepId: string; dto: IStepPatchDto }>({
    mutationFn: ({ id, stepId, dto }) => DocumentService.patchStep(id, stepId, dto),
    onSuccess: put,
  });
};

export const useDecideDocument = () => {
  const put = usePutDocument();
  return useMutation<IDocument, ApiError, { id: string; dto: IDecisionDto }>({
    mutationFn: ({ id, dto }) => DocumentService.decide(id, dto),
    onSuccess: put,
  });
};
