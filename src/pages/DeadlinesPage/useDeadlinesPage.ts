import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { shiftISODate } from "@/core/calendar";
import { useAvailability } from "@/hooks/useAvailability";
import { useCalendarYear } from "@/hooks/useCalendar";
import { formatDayLong, todayISO } from "@/utils/date";
import {
  addWithBreakdown,
  betweenDates,
  daysError,
  deadlineWithAbsence,
  fromNote,
  isCalcMode,
  missingYears,
  type CalcMode,
} from "@/utils/deadlineCalc";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DAYS = "5";

/**
 * Калькулятор сроков. Все параметры — в URL (?mode=add&from=2026-12-28&days=5&employee=e06),
 * чтобы ссылкой можно было поделиться. Пересчёт мгновенный, без кнопки «Посчитать».
 */
export const useDeadlinesPage = () => {
  const [params, setParams] = useSearchParams();
  const availability = useAvailability();
  const today = todayISO();
  const rawMode = params.get("mode");
  const mode: CalcMode = isCalcMode(rawMode) ? rawMode : "add";
  const from = params.get("from") ?? today;
  const daysRaw = params.get("days") ?? DEFAULT_DAYS;
  const to = params.get("to") ?? shiftISODate(today, 30);
  const employeeId = params.get("employee") ?? "";

  // Календарь на годы за пределами текущего/следующего — подгружаем по требованию
  const fromYear = ISO.test(from) ? Number(from.slice(0, 4)) : Number(today.slice(0, 4));
  const extra = useCalendarYear(fromYear + 1, fromYear + 1 > Number(today.slice(0, 4)) + 1);
  const { calendar: baseCalendar, employees, absences, delegations, employeeById } = availability;
  const calendar = extra.data
    ? new Map([...baseCalendar, ...extra.data.days.map((d) => [d.date, d] as const)])
    : baseCalendar;

  const set = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const fromError = ISO.test(from) ? null : "Укажите дату";
  const toError = ISO.test(to) ? null : "Укажите дату";
  const nError = daysError(daysRaw);
  const days = Number(daysRaw);

  const add =
    mode === "add" && !fromError && !nError ? addWithBreakdown(calendar, from, days) : null;
  const between =
    mode === "between" && !fromError && !toError ? betweenDates(calendar, from, to) : null;
  const missing = add
    ? missingYears(calendar, from, add.result)
    : between
      ? missingYears(calendar, from, to)
      : [];
  const withAbsence =
    add && employeeId && days > 0
      ? deadlineWithAbsence(calendar, employeeId, from, days, { employees, absences, delegations })
      : null;

  return {
    today,
    mode,
    setMode: (value: CalcMode) => set("mode", value === "add" ? "" : value),
    from,
    setFrom: (value: string) => set("from", value),
    fromError,
    fromInfo: !fromError ? fromNote(calendar, from) : null,
    daysRaw,
    // Пустое значение тоже храним в URL — иначе поле нельзя очистить (вернётся 5)
    setDays: (value: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("days", value);
          return next;
        },
        { replace: true },
      ),
    nError,
    to,
    setTo: (value: string) => set("to", value),
    toError,
    employeeId,
    setEmployeeId: (value: string) => set("employee", value),
    employees: [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru")),
    employeeById,
    add,
    between,
    missing,
    withAbsence,
    copy: () => {
      if (!add) return;
      void navigator.clipboard
        ?.writeText(formatDayLong(add.result))
        .then(() => toast.success("Дата скопирована"))
        .catch(() => toast.error("Не удалось скопировать"));
    },
    isLoading: availability.isLoading,
  };
};
