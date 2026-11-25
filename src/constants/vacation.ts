import type { AbsenceType, RequestType } from "@/types/absence.types";
import type { Role } from "@/types/employee.types";

export type VacationTab = "mine" | "queue" | "all";

export const VACATION_TAB_LABELS: Record<VacationTab, string> = {
  mine: "Мои отпуска",
  queue: "На согласовании",
  all: "Все заявки",
};

/** Какие вкладки видит роль — docs/design/screens/03-vacations.md */
export const VACATION_TABS_BY_ROLE: Record<Role, VacationTab[]> = {
  employee: ["mine"],
  manager: ["mine", "queue", "all"],
  hr: ["mine", "all"],
  admin: ["mine", "all"],
};

/** Типы в форме заявки — по порядку переключателя */
export const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: "vacation", label: "Ежегодный оплачиваемый" },
  { value: "unpaid", label: "Без сохранения" },
  { value: "study", label: "Учебный" },
];

/** Заявку можно подать не дальше чем на год вперёд */
export const MAX_REQUEST_AHEAD_DAYS = 365;

/** «Пересекается с вашим отпуском 3–9 авг.» — творительный падеж по типу */
export const OVERLAP_PHRASE: Record<AbsenceType, string> = {
  vacation: "вашим отпуском",
  unpaid: "вашим отпуском без сохранения",
  sick: "вашим больничным",
  trip: "вашей командировкой",
  study: "вашим учебным отпуском",
  dayoff: "вашим отгулом",
};

/** Быстрые причины отказа — docs/design/screens/03-vacations.md */
export const REJECT_REASONS = ["Пересечение с отпусками команды", "Проектный срок"];

/** Тост «Согласовано» с кнопкой «Отменить» живёт столько миллисекунд */
export const UNDO_TOAST_MS = 5000;

/** Мини-таймлайн в раскрытой строке очереди: период заявки ± столько дней */
export const QUEUE_TIMELINE_PADDING_DAYS = 3;
