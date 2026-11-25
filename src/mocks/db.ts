import {
  MOCK_ABSENCES,
  MOCK_DELEGATIONS,
  MOCK_DEPARTMENTS,
  MOCK_DOCUMENTS,
  MOCK_EMPLOYEES,
} from "@/constants/mock";
import { PRODUCTION_CALENDAR_SOURCES } from "@/constants/productionCalendar";
import type { IAbsence, IDelegation } from "@/types/absence.types";
import type { ICalendarYearSource } from "@/types/calendar.types";
import type { IDocument } from "@/types/document.types";
import type { IDepartment, IEmployee } from "@/types/employee.types";

/**
 * In-memory «база» мок-API. Изменения сохраняются в localStorage, чтобы демо
 * переживало перезагрузку. Знают о ней только хендлеры MSW — сервисы и UI нет.
 * Поменял форму данных — подними версию в ключе, старый снимок будет проигнорирован.
 */
const STORAGE_KEY = "eam:db:v4";

export interface IDb {
  departments: IDepartment[];
  employees: IEmployee[];
  absences: IAbsence[];
  delegations: IDelegation[];
  documents: IDocument[];
  calendars: ICalendarYearSource[];
}

const seed = (): IDb =>
  structuredClone({
    departments: MOCK_DEPARTMENTS,
    employees: MOCK_EMPLOYEES,
    absences: MOCK_ABSENCES,
    delegations: MOCK_DELEGATIONS,
    documents: MOCK_DOCUMENTS,
    calendars: PRODUCTION_CALENDAR_SOURCES,
  });

const load = (): IDb => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as IDb) : seed();
  } catch {
    return seed();
  }
};

let state = load();

export const db = {
  get: (): IDb => state,

  /** Изменение через функцию + сохранение снимка */
  update: (recipe: (draft: IDb) => void) => {
    recipe(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // приватный режим или переполнение — работаем только в памяти
    }
  },

  /** Вернуть исходные данные (кнопка «Сбросить демо», тесты) */
  reset: () => {
    state = seed();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // нет доступа к хранилищу — достаточно сброса в памяти
    }
  },
};
