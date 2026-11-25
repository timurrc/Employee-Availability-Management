import { describe, expect, it } from "vitest";
import { PRODUCTION_CALENDAR_SOURCES } from "@/constants/productionCalendar";
import { CALENDAR } from "@/test/fixtures";
import {
  addWorkingDays,
  buildCalendarYear,
  countWorkingDays,
  eachISODate,
  fromISODate,
  getDay,
  indexCalendar,
  isWorkingDay,
  monthNorm,
  nextWorkingDay,
  quarterNorm,
  shiftISODate,
  specialDaysOffBetween,
  toISODate,
  workingHours,
  yearNorm,
} from "./calendar";

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

describe("даты", () => {
  it("toISODate / fromISODate туда и обратно без сдвига дня (переход на летнее время)", () => {
    expect(toISODate(fromISODate("2026-03-29"))).toBe("2026-03-29");
  });

  it("shiftISODate переходит через год", () => {
    expect(shiftISODate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftISODate("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("eachISODate — включительно, пусто для перевёрнутого периода", () => {
    expect(eachISODate("2026-12-30", "2027-01-01")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
    expect(eachISODate("2026-12-02", "2026-12-01")).toEqual([]);
  });
});

describe("getDay / isWorkingDay", () => {
  it("берёт день из производственного календаря", () => {
    expect(isWorkingDay(CALENDAR, "2026-11-04")).toBe(false);
    expect(isWorkingDay(CALENDAR, "2027-02-20")).toBe(true);
    expect(isWorkingDay(CALENDAR, "2026-12-31")).toBe(false);
  });

  it("за пределами календаря — обычная пятидневка", () => {
    expect(getDay(CALENDAR, "2028-01-01")).toEqual({
      date: "2028-01-01",
      kind: "weekend",
      isShortened: false,
      isTransfer: false,
    });
    expect(isWorkingDay(CALENDAR, "2028-01-03")).toBe(true);
  });
});

describe("addWorkingDays", () => {
  it("день отсчёта не считается: пятница + 3 = среда", () => {
    expect(addWorkingDays(CALENDAR, "2026-11-27", 3)).toBe("2026-12-02");
  });

  it("0 — сама дата", () => {
    expect(addWorkingDays(CALENDAR, "2026-11-28", 0)).toBe("2026-11-28");
  });

  it("перескакивает праздник 4 ноября", () => {
    expect(addWorkingDays(CALENDAR, "2026-11-03", 1)).toBe("2026-11-05");
  });

  it("переход года через новогодние каникулы и перенос 31 декабря", () => {
    expect(addWorkingDays(CALENDAR, "2026-12-30", 1)).toBe("2027-01-11");
  });

  it("назад через переход года", () => {
    expect(addWorkingDays(CALENDAR, "2027-01-11", -1)).toBe("2026-12-30");
  });

  it("рабочая суббота 20.02.2027 считается, перенесённый понедельник — нет", () => {
    expect(addWorkingDays(CALENDAR, "2027-02-19", 1)).toBe("2027-02-20");
    expect(addWorkingDays(CALENDAR, "2027-02-19", 2)).toBe("2027-02-24");
  });

  it("падает понятной ошибкой, если рабочих дней нет", () => {
    const allOff = indexCalendar([
      {
        year: 2026,
        source: "",
        days: eachISODate("2026-01-01", "2030-12-31").map((date) => ({
          date,
          kind: "weekend" as const,
          isShortened: false,
          isTransfer: false,
        })),
      },
    ]);
    expect(() => addWorkingDays(allOff, "2026-01-01", 1)).toThrow("не найдено рабочих дней");
  });
});

describe("nextWorkingDay", () => {
  it("рабочий день — он сам", () => {
    expect(nextWorkingDay(CALENDAR, "2026-11-05")).toBe("2026-11-05");
  });

  it("праздник — следующий рабочий", () => {
    expect(nextWorkingDay(CALENDAR, "2027-01-01")).toBe("2027-01-11");
  });
});

describe("countWorkingDays", () => {
  it("период включительно", () => {
    expect(countWorkingDays(CALENDAR, "2026-11-02", "2026-11-08")).toBe(4);
  });

  it("новогодние каникулы — ни одного рабочего дня", () => {
    expect(countWorkingDays(CALENDAR, "2026-12-31", "2027-01-10")).toBe(0);
  });
});

describe("workingHours", () => {
  it("предпраздничный день короче на час, а рабочих дней столько же", () => {
    const period = { start: "2026-11-02", end: "2026-11-06" };
    expect(countWorkingDays(CALENDAR, period.start, period.end)).toBe(4);
    expect(workingHours(CALENDAR, period)).toBe(31);
  });

  it("учитывает ставку: 4 часа в день", () => {
    expect(workingHours(CALENDAR, { start: "2026-11-02", end: "2026-11-06" }, 4)).toBe(15);
  });
});

describe("specialDaysOffBetween", () => {
  it("праздник между датами", () => {
    expect(specialDaysOffBetween(CALENDAR, "2026-11-03", "2026-11-06").map((d) => d.date)).toEqual([
      "2026-11-04",
    ]);
  });

  it("обычные сб/вс не попадают, перенос 31.12 и каникулы — попадают", () => {
    const days = specialDaysOffBetween(CALENDAR, "2026-12-30", "2027-01-11").map((d) => d.date);
    expect(days).toHaveLength(9);
    expect(days[0]).toBe("2026-12-31");
    expect(days).not.toContain("2027-01-09");
  });

  it("сама начальная дата не входит", () => {
    expect(specialDaysOffBetween(CALENDAR, "2026-11-04", "2026-11-05")).toEqual([]);
  });
});

describe("нормы", () => {
  it.each([
    [2026, 1972],
    [2027, 1970],
  ])("%i: норма часов при 40-часовой неделе — %i", (value, hours) => {
    expect(yearNorm(CALENDAR, value)).toEqual({
      calendarDays: 365,
      workingDays: 247,
      daysOff: 118,
      hours,
    });
  });

  it("ноябрь 2026: 20 рабочих дней, 159 часов", () => {
    expect(monthNorm(CALENDAR, 2026, 11)).toEqual({
      calendarDays: 30,
      workingDays: 20,
      daysOff: 10,
      hours: 159,
    });
  });

  it("I квартал 2026: 55 рабочих дней", () => {
    expect(quarterNorm(CALENDAR, 2026, 1)).toMatchObject({ calendarDays: 90, workingDays: 55 });
  });

  it("сумма кварталов равна году", () => {
    const quarters = [1, 2, 3, 4].map((q) => quarterNorm(CALENDAR, 2027, q, 7));
    expect(quarters.reduce((sum, q) => sum + q.hours, 0)).toBe(yearNorm(CALENDAR, 2027, 7).hours);
  });
});
