import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/api/axios.api";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { AbsenceService, type IAbsenceFilter } from "@/services/absence.service";
import { SickLeaveService } from "@/services/sickLeave.service";
import type {
  IAbsence,
  IAbsenceStatusDto,
  ICloseSickLeaveDto,
  ICreateAbsenceDto,
  IExtendSickLeaveDto,
  IExtendVacationDto,
  IOpenSickLeaveDto,
  IUpdateAbsenceDto,
} from "@/types/absence.types";

export const useAbsences = (filter: IAbsenceFilter = {}) =>
  useQuery<IAbsence[], ApiError>({
    queryKey: QUERY_KEYS.absences.list(filter),
    queryFn: ({ signal }) => AbsenceService.getAll(filter, signal),
  });

/** После любой мутации отсутствия пересчитываются все экраны: календарь, «Сегодня», отпуска */
const useInvalidateAbsences = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.absences.all });
};

export const useCreateAbsence = () => {
  const invalidate = useInvalidateAbsences();
  return useMutation<IAbsence, ApiError, ICreateAbsenceDto>({
    mutationFn: AbsenceService.create,
    onSuccess: invalidate,
  });
};

export const useUpdateAbsence = () => {
  const invalidate = useInvalidateAbsences();
  return useMutation<IAbsence, ApiError, { id: string; dto: IUpdateAbsenceDto }>({
    mutationFn: ({ id, dto }) => AbsenceService.update(id, dto),
    onSuccess: invalidate,
  });
};

export const useSetAbsenceStatus = () => {
  const invalidate = useInvalidateAbsences();
  return useMutation<IAbsence, ApiError, { id: string; dto: IAbsenceStatusDto }>({
    mutationFn: ({ id, dto }) => AbsenceService.setStatus(id, dto),
    onSuccess: invalidate,
  });
};

export const useDeleteAbsence = () => {
  const invalidate = useInvalidateAbsences();
  return useMutation<void, ApiError, string>({
    mutationFn: AbsenceService.remove,
    onSuccess: invalidate,
  });
};

export const useOpenSickLeave = () => {
  const invalidate = useInvalidateAbsences();
  return useMutation<IAbsence, ApiError, IOpenSickLeaveDto>({
    mutationFn: SickLeaveService.open,
    onSuccess: invalidate,
  });
};

export const useExtendSickLeave = () => {
  const invalidate = useInvalidateAbsences();
  return useMutation<IAbsence, ApiError, { id: string; dto: IExtendSickLeaveDto }>({
    mutationFn: ({ id, dto }) => SickLeaveService.extend(id, dto),
    onSuccess: invalidate,
  });
};

export const useCloseSickLeave = () => {
  const invalidate = useInvalidateAbsences();
  return useMutation<IAbsence, ApiError, { id: string; dto: ICloseSickLeaveDto }>({
    mutationFn: ({ id, dto }) => SickLeaveService.close(id, dto),
    onSuccess: invalidate,
  });
};

export const useExtendVacation = () => {
  const invalidate = useInvalidateAbsences();
  return useMutation<IAbsence, ApiError, { id: string; dto: IExtendVacationDto }>({
    mutationFn: ({ id, dto }) => AbsenceService.extendVacation(id, dto),
    onSuccess: invalidate,
  });
};
