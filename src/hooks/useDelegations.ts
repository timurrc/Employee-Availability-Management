import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/api/axios.api";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { DelegationService } from "@/services/delegation.service";
import type { ICreateDelegationDto, IDelegation } from "@/types/absence.types";

export const useDelegations = () =>
  useQuery<IDelegation[], ApiError>({
    queryKey: QUERY_KEYS.delegations.all,
    queryFn: ({ signal }) => DelegationService.getAll(signal),
  });

const useInvalidateDelegations = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.delegations.all });
};

export const useCreateDelegation = () => {
  const invalidate = useInvalidateDelegations();
  return useMutation<IDelegation, ApiError, ICreateDelegationDto>({
    mutationFn: DelegationService.create,
    onSuccess: invalidate,
  });
};

export const useDeleteDelegation = () => {
  const invalidate = useInvalidateDelegations();
  return useMutation<void, ApiError, string>({
    mutationFn: DelegationService.remove,
    onSuccess: invalidate,
  });
};
