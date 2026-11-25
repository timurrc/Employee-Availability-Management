import { api } from "@/api/axios.api";
import type { ICalendarYear } from "@/types/calendar.types";

export const CalendarService = {
  getYear: async (year: number, signal?: AbortSignal) => {
    const { data } = await api.get<ICalendarYear>(`/calendar/${year}`, { signal });
    return data;
  },
};
