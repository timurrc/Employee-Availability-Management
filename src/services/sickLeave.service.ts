import { api } from "@/api/axios.api";
import type {
  IAbsence,
  ICloseSickLeaveDto,
  IExtendSickLeaveDto,
  IOpenSickLeaveDto,
} from "@/types/absence.types";

/** Больничные — отдельные эндпоинты: их регистрирует HR, согласования нет */
export const SickLeaveService = {
  open: async (dto: IOpenSickLeaveDto) => {
    const { data } = await api.post<IAbsence>("/sick-leaves", dto);
    return data;
  },

  extend: async (id: string, dto: IExtendSickLeaveDto) => {
    const { data } = await api.patch<IAbsence>(`/sick-leaves/${id}/extend`, dto);
    return data;
  },

  close: async (id: string, dto: ICloseSickLeaveDto) => {
    const { data } = await api.patch<IAbsence>(`/sick-leaves/${id}/close`, dto);
    return data;
  },
};
