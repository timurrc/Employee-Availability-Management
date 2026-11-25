import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DEMO_ACCOUNTS } from "@/constants/mock";
import { ROUTES } from "@/constants/routes";
import { useDemoLogin } from "@/hooks/useDemoLogin";
import { useEmployees } from "@/hooks/useEmployees";

export const useLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? ROUTES.HOME;
  const employees = useEmployees();

  const { mutate, isPending, variables } = useDemoLogin(({ user }) => {
    toast.success(`Добро пожаловать, ${user.name}`);
    navigate(from, { replace: true });
  });

  // ФИО и должность — из справочника; пока он грузится, строки показываются скелетоном
  const accounts = DEMO_ACCOUNTS.map((account) => {
    const employee = employees.data?.find((e) => e.id === account.employeeId);
    return { ...account, name: employee?.fullName, position: employee?.position };
  });

  return {
    accounts,
    isLoading: employees.isLoading,
    onSelect: (employeeId: string) => mutate({ employeeId }),
    pendingId: isPending ? variables?.employeeId : undefined,
  };
};
