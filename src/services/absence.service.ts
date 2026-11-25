import { api } from "@/api/axios.api";
import type {
  IAbsence,
  IAbsenceStatusDto,
  ICreateAbsenceDto,
  IExtendVacationDto,
  IUpdateAbsenceDto,
} from "@/types/absence.types";
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

  create: async (dto: ICreateAbsenceDto) => {
    const { data } = await api.post<IAbsence>("/absences", dto);
    return data;
  },

  /** Изменить черновик или отправить его на согласование */
  update: async (id: string, dto: IUpdateAbsenceDto) => {
    const { data } = await api.patch<IAbsence>(`/absences/${id}`, dto);
    return data;
  },

  setStatus: async (id: string, dto: IAbsenceStatusDto) => {
    const { data } = await api.patch<IAbsence>(`/absences/${id}/status`, dto);
    return data;
  },

  /** Продлить отпуск на дни больничного (ст. 124) или вернуть прежнюю дату */
  extendVacation: async (id: string, dto: IExtendVacationDto) => {
    const { data } = await api.patch<IAbsence>(`/absences/${id}/extend`, dto);
    return data;
  },

  /** Удалить черновик */
  remove: async (id: string) => {
    await api.delete(`/absences/${id}`);
  },
};
