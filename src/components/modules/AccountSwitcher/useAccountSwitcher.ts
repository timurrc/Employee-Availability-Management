import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DEMO_ACCOUNTS } from "@/constants/mock";
import { canSee, findNavItem } from "@/constants/navigation";
import { ROLE_LABELS } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { useDemoLogin } from "@/hooks/useDemoLogin";
import { useEmployees } from "@/hooks/useEmployees";
import { DemoService } from "@/services/demo.service";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";

/**
 * Смена демо-роли без перезагрузки. Если текущий раздел новой роли недоступен —
 * уводим на «Сегодня» и объясняем почему.
 */
export const useAccountSwitcher = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const { data: employees } = useEmployees();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const login = useDemoLogin(({ user: next }) => {
    // Данные зависят от того, кто смотрит, — сбрасываем кэш прошлой роли
    queryClient.clear();
    const section = findNavItem(pathname);
    if (section && !canSee(section, next.role)) {
      const allowed = section.roles?.map((role) => ROLE_LABELS[role]).join(", ");
      toast.info(`Раздел «${section.label}» доступен: ${allowed} — открыли «Сегодня»`);
      navigate(ROUTES.HOME);
      return;
    }
    toast.success(`Вы вошли как ${next.name}`);
  });

  const reset = useMutation({
    mutationFn: DemoService.reset,
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast.success("Демо-данные сброшены к исходным");
    },
    onError: () => toast.error("Не удалось сбросить данные — повторите"),
  });

  const accounts = DEMO_ACCOUNTS.map((account) => ({
    ...account,
    name: employees?.find((e) => e.id === account.employeeId)?.fullName,
  }));

  return {
    user,
    accounts,
    switchTo: (employeeId: string) => {
      if (employeeId !== user?.id) login.mutate({ employeeId });
    },
    pendingId: login.isPending ? login.variables?.employeeId : undefined,
    theme,
    setTheme,
    resetDemo: () => reset.mutate(),
    isResetting: reset.isPending,
    logout: () => {
      logout();
      queryClient.clear();
    },
  };
};
