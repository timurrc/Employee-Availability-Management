import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "@/api/axios.api";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { EmployeeService } from "@/services/employee.service";
import type { IDepartment, IEmployee } from "@/types/employee.types";

// Справочники меняются редко — держим их свежими дольше обычного
const DIRECTORY_STALE_TIME = 5 * 60_000;

export const useEmployees = () =>
  useQuery<IEmployee[], ApiError>({
    queryKey: QUERY_KEYS.employees.all,
    queryFn: ({ signal }) => EmployeeService.getAll(signal),
    staleTime: DIRECTORY_STALE_TIME,
  });

export const useEmployee = (id: string | undefined) =>
  useQuery<IEmployee, ApiError>({
    queryKey: QUERY_KEYS.employees.byId(id ?? ""),
    queryFn: ({ signal }) => EmployeeService.getById(id!, signal),
    enabled: Boolean(id),
  });

export const useDepartments = () =>
  useQuery<IDepartment[], ApiError>({
    queryKey: QUERY_KEYS.departments.all,
    queryFn: ({ signal }) => EmployeeService.getDepartments(signal),
    staleTime: DIRECTORY_STALE_TIME,
  });
