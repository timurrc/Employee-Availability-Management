import PagePlaceholder from "@/components/ui/PagePlaceholder/PagePlaceholder";
import { useEmployeePage } from "./useEmployeePage";

const EmployeePage = () => {
  const { employee, isPending, error } = useEmployeePage();

  if (isPending) return <p className="text-[var(--color-text-muted)]">Загрузка…</p>;
  if (error || !employee) return <p className="text-[var(--color-danger)]">{error?.message}</p>;

  return (
    <PagePlaceholder
      title={employee.fullName}
      stage={3}
      description={`${employee.position}. Статус сейчас, план отсутствий, заместитель.`}
    />
  );
};

export default EmployeePage;
