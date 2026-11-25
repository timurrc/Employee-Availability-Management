import type { Role } from "@/types/employee.types";

export const ROLE_LABELS: Record<Role, string> = {
  employee: "Сотрудник",
  manager: "Руководитель",
  hr: "Кадровик",
  admin: "Администратор",
};
