import { describe, expect, it } from "vitest";
import { PRODUCTION_CALENDAR_SOURCES } from "@/constants/productionCalendar";
import { buildCalendarYear, indexCalendar } from "@/core/calendar";
import { calendarSourceSchema } from "@/schemas/calendar.schema";
import {
  dayLabel,
  formatHours,
  importErrorText,
  initialFocusDate,
  MONTH_NAMES,
  monthWeeks,
  normRows,
  yearSummary,
} from "./productionCalendar";

const year2027 = buildCalendarYear(PRODUCTION_CALENDAR_SOURCES.find((s) => s.year === 2027)!);
const calendar = indexCalendar([year2027]);

describe("productionCalendar", () => {
  it("сводка года: 247 рабочих, сходится с постановлением; без суммы — не проверяем", () => {
    const summary = yearSummary(calendar, year2027);
    expect(summary).toMatchObject({ workingDays: 247, expected: 247, mismatch: false });
    expect(summary.daysOff).toBe(365 - 247);
    expect(summary.hours[40]).toBeGreaterThan(summary.hours[36]);
    expect(yearSummary(calendar, { ...year2027, expectedWorkingDays: 246 }).mismatch).toBe(true);
    expect(yearSummary(calendar, { ...year2027, expectedWorkingDays: undefined }).mismatch).toBe(
      false,
    );
  });

  it("таблица норм: год — 4 квартала, квартал — 3 месяца", () => {
    const quarters = normRows(calendar, 2027, "year");
    expect(quarters.map((r) => r.label)).toEqual([
      "I квартал",
      "II квартал",
      "III квартал",
      "IV квартал",
    ]);
    expect(quarters.reduce((sum, r) => sum + r.workingDays, 0)).toBe(247);
    const first = normRows(calendar, 2027, "1");
    expect(first.map((r) => r.label)).toEqual(["Январь", "Февраль", "Март"]);
    expect(first[0]).toMatchObject({ calendarDays: 31, workingDays: 15, hours: { 40: 120 } });
  });

  it("сетка месяца с понедельника, пустые клетки по краям", () => {
    const weeks = monthWeeks(year2027, 2); // 1 февраля 2027 — понедельник
    expect(weeks[0]?.[0]?.date).toBe("2027-02-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    const march = monthWeeks(year2027, 3).flat();
    expect(march.filter(Boolean)).toHaveLength(31);
    expect(MONTH_NAMES[11]).toBe("Декабрь");
  });

  it("подпись дня: тип, перенос, сокращённый, примечание", () => {
    const day = (date: string) => year2027.days.find((d) => d.date === date)!;
    expect(dayLabel(day("2027-02-23"))).toMatch(/23 февраля 2027, вторник, праздник — День/);
    expect(dayLabel(year2027.days.find((d) => d.isShortened)!)).toMatch(
      /рабочий( \(перенос\))?, сокращённый на 1 ч/,
    );
    const transfers = year2027.days.filter((d) => d.isTransfer);
    expect(transfers.map(dayLabel).join()).toMatch(/перенесённый|перенос/);
    expect(dayLabel({ ...day("2027-03-06"), isTransfer: true, kind: "workday" })).toMatch(
      /рабочий \(перенос\)/,
    );
  });

  it("часы и начальный фокус", () => {
    expect(formatHours(1970)).toMatch(/^1\s970 ч$/);
    expect(formatHours(1772.44)).toMatch(/^1\s772,4 ч$/);
    expect(initialFocusDate(2027, "2027-05-04")).toBe("2027-05-04");
    expect(initialFocusDate(2027, "2026-11-25")).toBe("2027-01-01");
  });

  it("ошибки импорта — по-человечески", () => {
    const text = (value: unknown) => {
      const result = calendarSourceSchema.safeParse(value);
      return result.success ? "ok" : importErrorText(result.error);
    };
    expect(text({ year: 2028, source: "x" })).toBe("Нет поля holidays");
    expect(text({ year: 2028, source: "x", holidays: [{ date: "2028-02-30", note: "" }] })).toBe(
      "holidays[0].date: Такой даты не существует",
    );
    expect(text({ year: 2028, source: "x", holidays: [], shortened: ["2027-01-01"] })).toBe(
      "shortened[0]: Дата 2027-01-01 не из 2028 года",
    );
    expect(text({ year: 2028, source: "x", holidays: [] })).toBe("ok");
  });
});
