import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DEMO_ACCOUNTS } from "@/constants/mock";
import { ROUTES } from "@/constants/routes";
import { useDemoLogin } from "@/hooks/useDemoLogin";

export const useLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? ROUTES.HOME;

  const { mutate, isPending, variables } = useDemoLogin(({ user }) => {
    toast.success(`Добро пожаловать, ${user.name}`);
    navigate(from, { replace: true });
  });

  return {
    accounts: DEMO_ACCOUNTS,
    onSelect: (employeeId: string) => mutate({ employeeId }),
    pendingId: isPending ? variables?.employeeId : undefined,
  };
};
