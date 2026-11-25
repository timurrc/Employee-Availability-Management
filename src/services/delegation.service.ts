import { api } from "@/api/axios.api";
import type { ICreateDelegationDto, IDelegation } from "@/types/absence.types";

export const DelegationService = {
  getAll: async (signal?: AbortSignal) => {
    const { data } = await api.get<IDelegation[]>("/delegations", { signal });
    return data;
  },

  create: async (dto: ICreateDelegationDto) => {
    const { data } = await api.post<IDelegation>("/delegations", dto);
    return data;
  },

  remove: async (id: string) => {
    await api.delete(`/delegations/${id}`);
  },
};
