import { api } from "@/api/axios.api";
import type { IDocument } from "@/types/document.types";

export const DocumentService = {
  getAll: async (signal?: AbortSignal) => {
    const { data } = await api.get<IDocument[]>("/documents", { signal });
    return data;
  },

  getById: async (id: string, signal?: AbortSignal) => {
    const { data } = await api.get<IDocument>(`/documents/${id}`, { signal });
    return data;
  },
};
