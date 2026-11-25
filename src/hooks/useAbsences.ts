import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "@/api/axios.api";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { AbsenceService, type IAbsenceFilter } from "@/services/absence.service";
import type { IAbsence } from "@/types/absence.types";

export const useAbsences = (filter: IAbsenceFilter = {}) =>
  useQuery<IAbsence[], ApiError>({
    queryKey: QUERY_KEYS.absences.list(filter),
    queryFn: ({ signal }) => AbsenceService.getAll(filter, signal),
  });
