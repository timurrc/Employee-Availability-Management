import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DEMO_ACCOUNTS } from "@/constants/mock";
import { ROUTES } from "@/constants/routes";
import { useDemoLogin } from "@/hooks/useDemoLogin";
import { useAuthStore } from "@/store/auth.store";

/** Переключатель демо-роли: перелогин под другой учётной записью без выхода */
const AccountSwitcher = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useDemoLogin(({ user: next }) => {
    // Данные зависят от того, кто смотрит, — сбрасываем кэш прошлой роли
    queryClient.clear();
    toast.success(`Вы вошли как ${next.name}`);
    navigate(ROUTES.HOME);
  });

  if (!user) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-[var(--color-muted)] sm:inline">Роль</span>
      <select
        value={user.id}
        disabled={isPending}
        onChange={(event) => mutate({ employeeId: event.target.value })}
        aria-label="Демо-роль"
        className="h-8 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 disabled:opacity-50"
      >
        {DEMO_ACCOUNTS.map(({ employeeId, label }) => (
          <option key={employeeId} value={employeeId}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default AccountSwitcher;
