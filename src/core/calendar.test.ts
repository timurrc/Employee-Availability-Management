import { describe, expect, it } from "vitest";
import { PRODUCTION_CALENDAR_SOURCES } from "@/constants/productionCalendar";
import { buildCalendarYear, fromISODate, toISODate } from "./calendar";

const year = (value: number) => {
  const source = PRODUCTION_CALENDAR_SOURCES.find((item) => item.year === value);
  if (!source) throw new Error(`Нет календаря на ${value}`);
  return buildCalendarYear(source);
};

const dayOf = (date: string) => year(Number(date.slice(0, 4))).days.find((d) => d.date === date)!;

describe("buildCalendarYear", () => {
  it.each([2026, 2027])("%i: 247 рабочих и 118 нерабочих дней (по постановлению)", (value) => {
    const { days } = year(value);
    expect(days).toHaveLength(365);
    expect(days.filter((d) => d.kind === "workday")).toHaveLength(247);
    expect(days.filter((d) => d.kind !== "workday")).toHaveLength(118);
  });

  it("праздник помечается как holiday с названием", () => {
    expect(dayOf("2026-11-04")).toMatchObject({ kind: "holiday", note: "День народного единства" });
  });

  it("перенесённый выходной — weekend с флагом переноса", () => {
    expect(dayOf("2026-12-31")).toMatchObject({ kind: "weekend", isTransfer: true });
  });

  it("рабочая суббота 20.02.2027 — рабочий и сокращённый день", () => {
    expect(dayOf("2027-02-20")).toMatchObject({
      kind: "workday",
      isTransfer: true,
      isShortened: true,
    });
  });

  it("предпраздничный день сокращён, но остаётся рабочим", () => {
    expect(dayOf("2026-04-30")).toMatchObject({ kind: "workday", isShortened: true });
  });
});

describe("toISODate / fromISODate", () => {
  it("туда и обратно без сдвига дня", () => {
    expect(toISODate(fromISODate("2026-03-29"))).toBe("2026-03-29");
  });
});
