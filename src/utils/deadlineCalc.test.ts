import { describe, expect, it } from "vitest";
import { CALENDAR, makeAbsence, makeEmployee } from "@/test/fixtures";
import {
  addWithBreakdown,
  betweenDates,
  daysError,
  deadlineWithAbsence,
  fromNote,
  isCalcMode,
  missingYears,
} from "./deadlineCalc";

describe("калькулятор сроков", () => {
  it("28 дек. + 5 рабочих = 13 янв. 2027, новогодние склеены в один интервал", () => {
    const result = addWithBreakdown(CALENDAR, "2026-12-28", 5);
    expect(result).toMatchObject({ result: "2027-01-13", calendarDays: 16, hasSpecial: true });
    expect(result.items.map((i) => (i.kind === "work" ? i.number : `${i.start}…${i.end}`))).toEqual(
      [1, 2, "2026-12-31…2027-01-10", 3, 4, 5],
    );
  });

  it("только выходные — разбор можно свернуть; отрицательное N — назад", () => {
    const plain = addWithBreakdown(CALENDAR, "2026-11-20", 3);
    expect(plain).toMatchObject({ result: "2026-11-25", hasSpecial: false });
    expect(plain.items.find((i) => i.kind === "off")).toMatchObject({ reason: "выходные" });

    const back = addWithBreakdown(CALENDAR, "2026-11-25", -3);
    expect(back.result).toBe("2026-11-20");
    expect(
      back.items.filter((i) => i.kind === "work").map((i) => i.kind === "work" && i.number),
    ).toEqual([3, 2, 1]);
  });

  it("сокращённый день помечен", () => {
    const result = addWithBreakdown(CALENDAR, "2026-11-02", 1);
    expect(result.items[0]).toMatchObject({ kind: "work", date: "2026-11-03", isShortened: true });
  });

  it("проверка N и режима", () => {
    expect(daysError("5")).toBeNull();
    expect(daysError("-5")).toBeNull();
    expect(daysError("")).toBe("Целое число рабочих дней");
    expect(daysError("1.5")).toBe("Целое число рабочих дней");
    expect(daysError("0")).toBe("Не может быть 0");
    expect(daysError("400")).toBe("Не больше 365");
    expect(isCalcMode("between")).toBe(true);
    expect(isCalcMode(null)).toBe(false);
  });

  it("«От» — нерабочий: отсчёт с первого рабочего", () => {
    expect(fromNote(CALENDAR, "2026-12-31")).toMatchObject({
      isWorking: false,
      firstWorking: "2027-01-11",
    });
    expect(fromNote(CALENDAR, "2026-12-28").isWorking).toBe(true);
  });

  it("между датами: рабочие дни, часы с учётом сокращённого, по месяцам", () => {
    const result = betweenDates(CALENDAR, "2026-11-30", "2026-11-02");
    expect(result.workingDays).toBe(20);
    expect(result.shortened).toEqual(["2026-11-03"]);
    expect(result.hours).toBe(159);
    expect(result.byMonth).toEqual([{ label: "Ноябрь 2026", workingDays: 20, hours: 159 }]);

    const partial = betweenDates(CALENDAR, "2026-11-02", "2026-11-04");
    expect(partial.byMonth[0]).toMatchObject({ workingDays: 2, hours: 15 });
  });

  it("незагруженные годы", () => {
    expect(missingYears(CALENDAR, "2027-12-01", "2028-02-01")).toEqual([2028]);
    expect(missingYears(CALENDAR, "2026-12-01", "2026-11-01")).toEqual([]);
  });

  it("с учётом отсутствия исполнителя: ждать выхода или передать заместителю", () => {
    const employees = [makeEmployee("e1", { deputyId: "e2" }), makeEmployee("e2")];
    const absences = [makeAbsence("v", "e1", "2026-11-23", "2026-12-04")];
    const { plain, waiting } = deadlineWithAbsence(CALENDAR, "e1", "2026-11-25", 2, {
      employees,
      absences,
    });
    expect(plain).toMatchObject({ risk: "delegated", due: "2026-11-27" });
    expect(waiting).toMatchObject({ risk: "waiting", dueIfWaiting: "2026-12-08" });

    const free = deadlineWithAbsence(CALENDAR, "e2", "2026-11-25", 2, { employees, absences });
    expect(free.waiting).toBeNull();
  });
});
