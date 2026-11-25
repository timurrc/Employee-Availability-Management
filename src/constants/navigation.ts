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
import { matchPath } from "react-router-dom";
import type { Role } from "@/types/employee.types";
import { ROUTES } from "./routes";

export type NavGroup = "work" | "people" | "settings";

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: "work", label: "Работа" },
  { id: "people", label: "Люди" },
  { id: "settings", label: "Настройки" },
];

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Кому показывать; не задано — всем авторизованным */
  roles?: Role[];
  /** Вложенные пути раздела: /documents/:id подсвечивает «Документы» */
  match?: string[];
}

/** Навигация по рабочим задачам — docs/design/02-journeys.md */
export const NAV_ITEMS: NavItem[] = [
  { label: "Сегодня", to: ROUTES.HOME, icon: Sun, group: "work" },
  {
    label: "Документы",
    to: ROUTES.DOCUMENTS,
    icon: FileText,
    group: "work",
    match: [ROUTES.DOCUMENT],
  },
  { label: "Сроки", to: ROUTES.DEADLINES, icon: Timer, group: "work" },
  {
    label: "Команда",
    to: ROUTES.TEAM,
    icon: CalendarRange,
    group: "people",
    match: [ROUTES.EMPLOYEE],
  },
  { label: "Отпуска", to: ROUTES.VACATIONS, icon: Palmtree, group: "people" },
  {
    label: "Больничные",
    to: ROUTES.SICK_LEAVES,
    icon: HeartPulse,
    group: "people",
    roles: ["hr", "admin"],
  },
  { label: "Календарь", to: ROUTES.CALENDAR, icon: CalendarDays, group: "settings" },
];

export const canSee = (item: Pick<NavItem, "roles">, role: Role | undefined) =>
  !item.roles || (role !== undefined && item.roles.includes(role));

/** Раздел, к которому относится путь: /documents/d1 → «Документы» */
export const findNavItem = (pathname: string) =>
  NAV_ITEMS.find((item) =>
    [item.to, ...(item.match ?? [])].some((pattern) => matchPath({ path: pattern }, pathname)),
  );
