import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/api/axios.api";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { CalendarService } from "@/services/calendar.service";
import type {
  ICalendarYear,
  ICalendarYearSource,
  ISetCalendarDayDto,
} from "@/types/calendar.types";
import type { ISODate } from "@/types/common.types";

export const useCalendarYear = (year: number, enabled = true) =>
  useQuery<ICalendarYear, ApiError>({
    queryKey: QUERY_KEYS.calendar.year(year),
    queryFn: ({ signal }) => CalendarService.getYear(year, signal),
    staleTime: Infinity,
    enabled,
    // 404 — год не загружен: это состояние экрана, а не сбой сети, повторять незачем
    retry: (count, error) => error.status !== 404 && count < 2,
  });

/** Ответ сервера — готовый год: кладём в кэш, сроки и заявки пересчитаются сами */
const usePutYear = () => {
  const queryClient = useQueryClient();
  return (year: ICalendarYear) =>
    queryClient.setQueryData(QUERY_KEYS.calendar.year(year.year), year);
};

export const useSetCalendarDay = () => {
  const putYear = usePutYear();
  return useMutation<ICalendarYear, ApiError, { date: ISODate; dto: ISetCalendarDayDto }>({
    mutationFn: ({ date, dto }) => CalendarService.setDay(date, dto),
    onSuccess: putYear,
  });
};

export const useImportCalendar = () => {
  const putYear = usePutYear();
  return useMutation<ICalendarYear, ApiError, ICalendarYearSource>({
    mutationFn: CalendarService.importYear,
    onSuccess: putYear,
  });
};
