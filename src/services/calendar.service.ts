import { api } from "@/api/axios.api";
import type {
  ICalendarYear,
  ICalendarYearSource,
  ISetCalendarDayDto,
} from "@/types/calendar.types";
import type { ISODate } from "@/types/common.types";

export const CalendarService = {
  getYear: async (year: number, signal?: AbortSignal) => {
    const { data } = await api.get<ICalendarYear>(`/calendar/${year}`, { signal });
    return data;
  },

  /** Правка одного дня (админ) — в ответе пересобранный год */
  setDay: async (date: ISODate, dto: ISetCalendarDayDto) => {
    const { data } = await api.put<ICalendarYear>(
      `/calendar/${date.slice(0, 4)}/days/${date}`,
      dto,
    );
    return data;
  },

  /** Загрузить или заменить год целиком */
  importYear: async (source: ICalendarYearSource) => {
    const { data } = await api.put<ICalendarYear>(`/calendar/${source.year}`, source);
    return data;
  },
};
