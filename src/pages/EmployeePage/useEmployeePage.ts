import { useParams } from "react-router-dom";
import { useEmployee } from "@/hooks/useEmployees";

export const useEmployeePage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: employee, isPending, error } = useEmployee(id);
  return { employee, isPending, error };
};
