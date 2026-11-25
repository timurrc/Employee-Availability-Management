import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { indexCalendar } from "@/core/calendar";
import { ABSENCE_META } from "@/constants/absence";
import { useAvailability } from "@/hooks/useAvailability";
import { useCalendarYear } from "@/hooks/useCalendar";
import { useDepartments } from "@/hooks/useEmployees";
import { useAuthStore } from "@/store/auth.store";
import type { AbsenceType } from "@/types/absence.types";
import { todayISO } from "@/utils/date";
import { matchesQuery } from "@/utils/text";
import {
  belowThresholdRanges,
  isTimelineScale,
  isVisibleOnTimeline,
  shiftTimeline,
  timelineColumns,
  timelineCoverage,
  timelineGroups,
  timelinePeriod,
  timelineTitle,
  type TimelineScale,
} from "@/utils/timeline";

export const ALL_DEPARTMENTS = "all";
const ALL_TYPES = Object.keys(ABSENCE_META) as AbsenceType[];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Календарь команды. Фильтры и период живут в URL (?dept=d-it&from=2026-12-01&scale=month),
 * чтобы ссылку можно было переслать. Сотрудник видит только свой отдел.
 */
export const useTeamPage = () => {
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams();
  const availability = useAvailability();
  const departmentsQuery = useDepartments();
  const { employees, absences, statusOf, employeeById } = availability;
  const today = todayISO();

  const me = user ? employeeById(user.id) : undefined;
  const role = user?.role ?? "employee";
  const isWide = role !== "employee";

  const allDepartments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  // Нет доступа к отделу — его просто нет в фильтре
  const departments = useMemo(
    () => (isWide ? allDepartments : allDepartments.filter((d) => d.id === me?.departmentId)),
    [allDepartments, isWide, me],
  );

  const defaultDept = role === "hr" || role === "admin" ? ALL_DEPARTMENTS : me?.departmentId;
  const rawDept = params.get("dept") ?? defaultDept ?? ALL_DEPARTMENTS;
  const dept =
    rawDept === ALL_DEPARTMENTS && isWide
      ? ALL_DEPARTMENTS
      : departments.some((d) => d.id === rawDept)
        ? rawDept
        : (me?.departmentId ?? ALL_DEPARTMENTS);

  const rawScale = params.get("scale");
  const scale: TimelineScale = isTimelineScale(rawScale) ? rawScale : "month";
  const rawFrom = params.get("from");
  const anchor = rawFrom && ISO_DATE.test(rawFrom) ? rawFrom : today;
  const period = useMemo(() => timelinePeriod(scale, anchor), [scale, anchor]);

  const types = useMemo(() => {
    const raw = params.get("types");
    if (!raw) return ALL_TYPES;
    const picked = raw.split(",").filter((t): t is AbsenceType => t in ABSENCE_META);
    return picked.length > 0 ? picked : ALL_TYPES;
  }, [params]);
  const query = params.get("q") ?? "";
  const onlyFound = params.get("only") === "1";

  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, value]) =>
            value === null ? next.delete(key) : next.set(key, value),
          );
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  // Период может захватить два года (квартал не пересекает год, 2 недели — могут)
  const startYear = Number(period.start.slice(0, 4));
  const endYear = Number(period.end.slice(0, 4));
  const startCalendar = useCalendarYear(startYear);
  const endCalendar = useCalendarYear(endYear);
  const calendar = useMemo(
    () => indexCalendar([startCalendar.data, endCalendar.data].filter((y) => y !== undefined)),
    [startCalendar.data, endCalendar.data],
  );
  const missingYears = [
    ...new Set(
      [startCalendar.isError ? startYear : null, endCalendar.isError ? endYear : null].filter(
        (y): y is number => y !== null,
      ),
    ),
  ];

  const columns = useMemo(() => timelineColumns(calendar, period), [calendar, period]);

  const visibleAbsences = useMemo(
    () => absences.filter((a) => isVisibleOnTimeline(a, user?.id) && types.includes(a.type)),
    [absences, user?.id, types],
  );

  const groups = useMemo(() => {
    const picked =
      dept === ALL_DEPARTMENTS ? departments : departments.filter((d) => d.id === dept);
    const people =
      onlyFound && query.trim()
        ? employees.filter((e) => matchesQuery(`${e.fullName} ${e.position}`, query))
        : employees;
    return timelineGroups(picked, people).map((group) => ({
      ...group,
      // Покрытие — по всем действующим отсутствиям отдела, независимо от фильтра типов
      coverage: timelineCoverage(columns, group.department, employees, absences),
    }));
  }, [dept, departments, employees, absences, columns, onlyFound, query]);

  const risk = useMemo(
    () =>
      groups
        .map((group) => ({
          department: group.department,
          ranges: belowThresholdRanges(group.coverage),
          days: group.coverage.filter((day) => day?.isBelow).length,
        }))
        .filter((item) => item.days > 0),
    [groups],
  );

  const hasAbsences = useMemo(() => {
    const ids = new Set(groups.flatMap((g) => g.employees.map((e) => e.id)));
    return visibleAbsences.some(
      (a) =>
        ids.has(a.employeeId) &&
        a.period.start <= period.end &&
        (a.period.end === null || a.period.end >= period.start),
    );
  }, [groups, visibleAbsences, period]);

  const selectedDepartmentEmpty =
    dept !== ALL_DEPARTMENTS && !employees.some((e) => e.departmentId === dept);

  return {
    user,
    role,
    today,
    scale,
    period,
    title: timelineTitle(scale, period, today),
    columns,
    groups,
    absences: visibleAbsences,
    risk,
    hasAbsences,
    missingYears,
    departments,
    dept,
    canSeeAll: isWide,
    types,
    allTypes: ALL_TYPES,
    query,
    onlyFound,
    statusOf,
    employeeById,
    selectedDepartmentEmpty,
    isLoading: availability.isLoading || departmentsQuery.isLoading,
    isError: availability.isError || departmentsQuery.isError,
    refetch: () => {
      availability.refetch();
      if (departmentsQuery.isError) void departmentsQuery.refetch();
    },
    setDept: (value: string) => update({ dept: value }),
    setScale: (value: TimelineScale) => update({ scale: value }),
    goPrev: () => update({ from: shiftTimeline(scale, period.start, -1) }),
    goNext: () => update({ from: shiftTimeline(scale, period.start, 1) }),
    goToday: () => update({ from: null }),
    toggleType: (type: AbsenceType) => {
      const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
      update({
        types: next.length === 0 || next.length === ALL_TYPES.length ? null : next.join(","),
      });
    },
    setQuery: (value: string) => update({ q: value || null }),
    setOnlyFound: (value: boolean) => update({ only: value ? "1" : null }),
    resetFilters: () => update({ types: null, q: null, only: null, dept: null }),
  };
};
