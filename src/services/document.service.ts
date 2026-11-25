import { api } from "@/api/axios.api";
import type { ISODate } from "@/types/common.types";
import type {
  ICreateDocumentDto,
  IDecisionDto,
  IDocument,
  IRouteDto,
  IStepPatchDto,
} from "@/types/document.types";

export const DocumentService = {
  getAll: async (signal?: AbortSignal) => {
    const { data } = await api.get<IDocument[]>("/documents", { signal });
    return data;
  },

  getById: async (id: string, signal?: AbortSignal) => {
    const { data } = await api.get<IDocument>(`/documents/${id}`, { signal });
    return data;
  },

  create: async (dto: ICreateDocumentDto) => {
    const { data } = await api.post<IDocument>("/documents", dto);
    return data;
  },

  /** Сохранить маршрут черновика */
  saveRoute: async (id: string, dto: IRouteDto) => {
    const { data } = await api.put<IDocument>(`/documents/${id}/route`, dto);
    return data;
  },

  send: async (id: string, start: ISODate) => {
    const { data } = await api.post<IDocument>(`/documents/${id}/send`, { start });
    return data;
  },

  /** Передать этап заместителю, вернуть или «Оставить и ждать выхода» */
  patchStep: async (id: string, stepId: string, dto: IStepPatchDto) => {
    const { data } = await api.patch<IDocument>(`/documents/${id}/steps/${stepId}`, dto);
    return data;
  },

  decide: async (id: string, dto: IDecisionDto) => {
    const { data } = await api.post<IDocument>(`/documents/${id}/decision`, dto);
    return data;
  },
};
