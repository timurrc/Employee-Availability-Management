import { api } from "@/api/axios.api";
import type { IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";

export interface IAbsenceFilter {
  from?: ISODate;
  to?: ISODate;
  employeeId?: string;
}

export const AbsenceService = {
  getAll: async (filter: IAbsenceFilter = {}, signal?: AbortSignal) => {
    const { data } = await api.get<IAbsence[]>("/absences", { params: filter, signal });
    return data;
  },
};
