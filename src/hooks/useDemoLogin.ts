import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiError } from "@/api/axios.api";
import { AuthService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import type { IAuthResponse, ILoginDto } from "@/types/auth.types";

/**
 * Вход под демо-учётной записью. Нужен и странице входа, и переключателю роли в шапке.
 * Куда вести после входа, решает вызывающий через onSuccess.
 */
export const useDemoLogin = (onSuccess?: (data: IAuthResponse) => void) => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation<IAuthResponse, ApiError, ILoginDto>({
    mutationFn: AuthService.login,
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
      onSuccess?.(data);
    },
    onError: (error) => toast.error(error.message),
  });
};
