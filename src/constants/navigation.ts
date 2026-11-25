import {
  CalendarDays,
  CalendarRange,
  FileText,
  HeartPulse,
  Palmtree,
  Sun,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/employee.types";
import { ROUTES } from "./routes";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Кому показывать; не задано — всем авторизованным */
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Сегодня", to: ROUTES.HOME, icon: Sun },
  { label: "Команда", to: ROUTES.TEAM, icon: CalendarRange },
  { label: "Отпуска", to: ROUTES.VACATIONS, icon: Palmtree },
  { label: "Больничные", to: ROUTES.SICK_LEAVES, icon: HeartPulse, roles: ["hr", "admin"] },
  { label: "Документы", to: ROUTES.DOCUMENTS, icon: FileText },
  { label: "Календарь", to: ROUTES.CALENDAR, icon: CalendarDays },
  { label: "Сроки", to: ROUTES.DEADLINES, icon: Timer },
];

export const canSee = (item: Pick<NavItem, "roles">, role: Role | undefined) =>
  !item.roles || (role !== undefined && item.roles.includes(role));
