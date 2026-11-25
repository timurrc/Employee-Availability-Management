import { api } from "@/api/axios.api";
import type { IDepartment, IEmployee } from "@/types/employee.types";

export const EmployeeService = {
  getAll: async (signal?: AbortSignal) => {
    const { data } = await api.get<IEmployee[]>("/employees", { signal });
    return data;
  },

  getById: async (id: string, signal?: AbortSignal) => {
    const { data } = await api.get<IEmployee>(`/employees/${id}`, { signal });
    return data;
  },

  getDepartments: async (signal?: AbortSignal) => {
    const { data } = await api.get<IDepartment[]>("/departments", { signal });
    return data;
  },
};
