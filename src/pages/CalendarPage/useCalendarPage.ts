import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { indexCalendar, yearToSource } from "@/core/calendar";
import { UNDO_TOAST_MS } from "@/constants/vacation";
import { useCalendarYear, useSetCalendarDay } from "@/hooks/useCalendar";
import { useAuthStore } from "@/store/auth.store";
import type { ICalendarDay, ISetCalendarDayDto } from "@/types/calendar.types";
import { formatDay, todayISO } from "@/utils/date";
import { normRows, yearSummary, type PeriodTab } from "@/utils/productionCalendar";

const KIND_TOAST = { workday: "рабочий день", weekend: "выходной", holiday: "праздник" } as const;

const dtoOf = (day: ICalendarDay): ISetCalendarDayDto => ({
  kind: day.kind,
  isShortened: day.isShortened,
  note: day.note,
});

/**
 * Производственный календарь: год в URL (?year=2027). Правка дней и импорт — только админ,
 * остальные видят тот же экран для чтения.
 */
export const useCalendarPage = () => {
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const rawYear = Number(params.get("year"));
  const year =
    Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : currentYear;
  const query = useCalendarYear(year);
  const setDay = useSetCalendarDay();
  const isAdmin = user?.role === "admin";

  const [period, setPeriod] = useState<PeriodTab>("year");
  const [editing, setEditing] = useState<ICalendarDay | null>(null);
  const [isImportOpen, setImportOpen] = useState(false);

  const data = query.data;
  const calendar = data ? indexCalendar([data]) : null;

  const goToYear = (value: number) =>
    setParams(value === currentYear ? {} : { year: String(value) }, { replace: true });

  const apply = async (day: ICalendarDay, dto: ISetCalendarDayDto) => {
    const previous = dtoOf(day);
    try {
      await setDay.mutateAsync({ date: day.date, dto });
      setEditing(null);
      toast.success(`${formatDay(day.date, today)} — ${KIND_TOAST[dto.kind]}. Сроки пересчитаны`, {
        duration: UNDO_TOAST_MS,
        action: {
          label: "Отменить",
          onClick: () => void setDay.mutate({ date: day.date, dto: previous }),
        },
      });
    } catch {
      // День остаётся прежним — кэш не меняли до ответа сервера
      toast.error("Не удалось сохранить день — повторите");
    }
  };

  const exportYear = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(yearToSource(data), null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `production-calendar-${data.year}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return {
    today,
    year,
    data,
    calendar,
    summary: data && calendar ? yearSummary(calendar, data) : null,
    rows: calendar ? normRows(calendar, year, period) : [],
    period,
    setPeriod,
    isAdmin,
    prevYear: () => goToYear(year - 1),
    nextYear: () => goToYear(year + 1),
    editing,
    startEdit: isAdmin ? (day: ICalendarDay) => setEditing(day) : undefined,
    cancelEdit: () => setEditing(null),
    applyEdit: (dto: ISetCalendarDayDto) => editing && void apply(editing, dto),
    isEditPending: setDay.isPending,
    isImportOpen,
    openImport: () => setImportOpen(true),
    closeImport: () => setImportOpen(false),
    onImported: (imported: number) => {
      setImportOpen(false);
      toast.success(`Календарь ${imported} загружен`);
      goToYear(imported);
    },
    exportYear,
    isLoading: query.isPending,
    isNotLoaded: query.error?.status === 404,
    error: query.error,
    refetch: () => void query.refetch(),
  };
};
