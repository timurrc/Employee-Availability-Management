export type Role = "employee" | "manager" | "hr" | "admin";

export interface IDepartment {
  id: string;
  name: string;
  headId: string;
  /** Минимальная доля доступных сотрудников, % — ниже порога руководитель видит предупреждение */
  coverageThreshold: number;
}

export interface IEmployee {
  id: string;
  fullName: string;
  position: string;
  departmentId: string;
  /** Руководитель; null — у главы организации */
  managerId: string | null;
  /** Постоянный заместитель; null — не назначен */
  deputyId: string | null;
  role: Role;
  /** Норма часов в обычный рабочий день (график 5/2) */
  hoursPerDay: number;
  email: string;
}
