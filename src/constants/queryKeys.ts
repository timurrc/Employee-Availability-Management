import type { IAbsenceFilter } from "@/services/absence.service";

/** Ключи TanStack Query. Все ключи только отсюда, чтобы инвалидация была предсказуемой. */
export const QUERY_KEYS = {
  departments: {
    all: ["departments"] as const,
  },
  employees: {
    all: ["employees"] as const,
    byId: (id: string) => ["employees", id] as const,
  },
  absences: {
    all: ["absences"] as const,
    list: (filter: IAbsenceFilter) => ["absences", filter] as const,
  },
  calendar: {
    year: (year: number) => ["calendar", year] as const,
  },
  documents: {
    all: ["documents"] as const,
    byId: (id: string) => ["documents", id] as const,
  },
};
