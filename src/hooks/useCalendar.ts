import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "@/api/axios.api";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { CalendarService } from "@/services/calendar.service";
import type { ICalendarYear } from "@/types/calendar.types";

export const useCalendarYear = (year: number) =>
  useQuery<ICalendarYear, ApiError>({
    queryKey: QUERY_KEYS.calendar.year(year),
    queryFn: ({ signal }) => CalendarService.getYear(year, signal),
    staleTime: Infinity,
  });
