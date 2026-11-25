import { describe, expect, it } from "vitest";
import { CALENDAR, makeAbsence } from "@/test/fixtures";
import {
  accruedVacationDays,
  isActiveAbsence,
  isPlannedAbsence,
  sickLeaveVacationOverlaps,
  usedVacationDays,
  vacationBalance,
  vacationDuration,
  vacationEndFor,
  validateVacationRequest,
} from "./absence";

describe("статусы", () => {
  it("активные — согласованные и больничные, заявка на согласовании — только запланирована", () => {
    expect(isActiveAbsence(makeAbsence("a", "e1", "2026-11-01", "2026-11-02"))).toBe(true);
    expect(
      isActiveAbsence(makeAbsence("a", "e1", "2026-11-01", null, { type: "sick", status: "open" })),
    ).toBe(true);
    const pending = makeAbsence("a", "e1", "2026-11-01", "2026-11-02", { status: "pending" });
    expect(isActiveAbsence(pending)).toBe(false);
    expect(isPlannedAbsence(pending)).toBe(true);
    expect(isPlannedAbsence({ ...pending, status: "cancelled" })).toBe(false);
  });
});

describe("vacationDuration (ст. 120)", () => {
  it("праздник 4 ноября внутри отпуска не входит, выходные входят", () => {
    const result = vacationDuration(CALENDAR, { start: "2026-11-01", end: "2026-11-14" });
    expect(result.calendarDays).toBe(14);
    expect(result.chargeableDays).toBe(13);
    expect(result.holidays.map((d) => d.date)).toEqual(["2026-11-04"]);
  });

  it("через Новый год: 8 праздников не входят, перенесённый выходной 31.12 — входит", () => {
    const result = vacationDuration(CALENDAR, { start: "2026-12-28", end: "2027-01-10" });
    expect(result.calendarDays).toBe(14);
    expect(result.holidays).toHaveLength(8);
    expect(result.chargeableDays).toBe(6);
  });
});

describe("vacationEndFor", () => {
  it("без праздников — ровно N календарных дней", () => {
    expect(vacationEndFor(CALENDAR, "2026-07-06", 14)).toBe("2026-07-19");
  });

  it("праздник продлевает отпуск", () => {
    expect(vacationEndFor(CALENDAR, "2026-11-01", 14)).toBe("2026-11-15");
  });

  it("новогодние каникулы продлевают на 8 дней", () => {
    expect(vacationEndFor(CALENDAR, "2026-12-28", 14)).toBe("2027-01-18");
  });

  it("меньше одного дня — ошибка", () => {
    expect(() => vacationEndFor(CALENDAR, "2026-11-01", 0)).toThrow();
  });
});

describe("accruedVacationDays", () => {
  it("2,33 дня за месяц: полгода — 14 дней", () => {
    expect(accruedVacationDays("2026-01-12", "2026-07-11")).toBe(14);
  });

  it("остаток меньше половины месяца отбрасывается", () => {
    expect(accruedVacationDays("2026-01-12", "2026-07-25")).toBe(14);
  });

  it("остаток от половины месяца округляется до полного", () => {
    expect(accruedVacationDays("2026-01-12", "2026-07-26")).toBe(16.33);
  });

  it("рабочий год — 28 дней, переход года", () => {
    expect(accruedVacationDays("2026-01-12", "2027-01-11")).toBe(28);
  });

  it("до начала работы — 0; другой размер отпуска", () => {
    expect(accruedVacationDays("2026-01-12", "2026-01-01")).toBe(0);
    expect(accruedVacationDays("2026-01-01", "2026-12-31", 36)).toBe(36);
  });
});

const ABSENCES = [
  makeAbsence("v1", "e1", "2026-11-01", "2026-11-14"),
  makeAbsence("v2", "e1", "2026-12-28", "2027-01-10", { status: "pending" }),
  makeAbsence("v3", "e1", "2026-08-01", "2026-08-14", { status: "rejected" }),
  makeAbsence("s1", "e1", "2026-03-02", "2026-03-06", { type: "sick", status: "closed" }),
  makeAbsence("v4", "e2", "2026-06-01", "2026-06-28"),
];

describe("баланс", () => {
  it("usedVacationDays: согласованные и на согласовании, без праздников", () => {
    expect(usedVacationDays(CALENDAR, ABSENCES, "e1")).toBe(19);
    expect(usedVacationDays(CALENDAR, ABSENCES, "e1", "v2")).toBe(13);
  });

  it("vacationBalance: начислено минус использовано", () => {
    expect(
      vacationBalance(CALENDAR, {
        employeeId: "e1",
        workStart: "2026-01-12",
        onDate: "2026-12-11",
        absences: ABSENCES,
      }),
    ).toEqual({ accrued: 25.67, used: 19, available: 6.67 });
  });
});

describe("validateVacationRequest", () => {
  const context = { today: "2026-11-25", absences: ABSENCES, availableDays: 28 };
  const request = (start: string, end: string, employeeId = "e2") => ({
    employeeId,
    period: { start, end },
  });
  const codes = (result: ReturnType<typeof validateVacationRequest>) =>
    result.issues.map((issue) => issue.code);

  it("корректная заявка на 14 дней", () => {
    const result = validateVacationRequest(CALENDAR, request("2027-07-05", "2027-07-18"), context);
    expect(result).toMatchObject({ isValid: true, issues: [] });
    expect(result.duration?.chargeableDays).toBe(14);
  });

  it("перевёрнутый период — ошибка без расчёта", () => {
    const result = validateVacationRequest(CALENDAR, request("2027-07-18", "2027-07-05"), context);
    expect(result).toMatchObject({ isValid: false, duration: null });
    expect(codes(result)).toEqual(["invalid_period"]);
  });

  it("в прошлом — ошибка", () => {
    const result = validateVacationRequest(CALENDAR, request("2026-11-20", "2026-12-05"), context);
    expect(codes(result)).toEqual(["in_past"]);
    expect(result.isValid).toBe(false);
  });

  it("пересечение со своей заявкой на согласовании — ошибка, отклонённые не мешают", () => {
    const result = validateVacationRequest(
      CALENDAR,
      request("2027-01-05", "2027-01-25", "e1"),
      context,
    );
    expect(result.issues).toEqual([expect.objectContaining({ code: "overlap", absenceId: "v2" })]);
    const rejected = validateVacationRequest(
      CALENDAR,
      request("2027-08-01", "2027-08-14", "e1"),
      context,
    );
    expect(rejected.isValid).toBe(true);
  });

  it("редактирование своей же заявки не пересекается само с собой", () => {
    const result = validateVacationRequest(
      CALENDAR,
      { id: "v2", ...request("2026-12-28", "2027-01-10", "e1") },
      context,
    );
    expect(codes(result)).not.toContain("overlap");
  });

  it("нехватка баланса — предупреждение, не ошибка", () => {
    const result = validateVacationRequest(CALENDAR, request("2027-07-05", "2027-07-18"), {
      ...context,
      availableDays: 10,
    });
    expect(codes(result)).toContain("insufficient_balance");
    expect(result.isValid).toBe(true);
  });

  it("часть < 14 дней, длинной части нет и не останется — предупреждение (ст. 125)", () => {
    const result = validateVacationRequest(CALENDAR, request("2027-07-05", "2027-07-11"), {
      ...context,
      availableDays: 18,
    });
    expect(codes(result)).toEqual(["no_long_part"]);
    expect(result.isValid).toBe(true);
  });

  it("часть < 14 дней, но останется ≥ 14 — без предупреждения", () => {
    const result = validateVacationRequest(CALENDAR, request("2027-07-05", "2027-07-11"), context);
    expect(result.issues).toEqual([]);
  });

  it("часть < 14 дней, длинная часть в этом году уже есть — без предупреждения", () => {
    const longPart = makeAbsence("v5", "e1", "2026-07-06", "2026-07-19");
    const result = validateVacationRequest(CALENDAR, request("2026-12-01", "2026-12-05", "e1"), {
      ...context,
      absences: [...ABSENCES, longPart],
      availableDays: 6,
    });
    expect(result.issues).toEqual([]);
  });

  it("14 календарных дней с праздником — это 13 дней отпуска, часть ≥ 14 не засчитана", () => {
    const result = validateVacationRequest(CALENDAR, request("2026-12-01", "2026-12-05", "e1"), {
      ...context,
      availableDays: 6,
    });
    expect(codes(result)).toEqual(["no_long_part"]);
  });
});

describe("sickLeaveVacationOverlaps (ст. 124)", () => {
  const vacations = [
    makeAbsence("v1", "e1", "2026-11-01", "2026-11-14"),
    makeAbsence("v2", "e1", "2026-12-01", "2026-12-14", { status: "pending" }),
    makeAbsence("v3", "e1", "2027-02-01", "2027-02-14"),
    makeAbsence("v4", "e2", "2026-11-01", "2026-11-14"),
  ];

  it("закрытый больничный: дни переноса без праздника", () => {
    const sick = makeAbsence("s", "e1", "2026-11-03", "2026-11-06", { type: "sick" });
    const [result, ...rest] = sickLeaveVacationOverlaps(CALENDAR, sick, vacations);
    expect(rest).toEqual([]);
    expect(result).toMatchObject({
      overlap: { start: "2026-11-03", end: "2026-11-06" },
      daysToMove: 3,
      isOpen: false,
    });
    expect(result.vacation.id).toBe("v1");
  });

  it("открытый больничный — до конца отпуска и флаг isOpen", () => {
    const sick = makeAbsence("s", "e1", "2026-11-10", null, { type: "sick", status: "open" });
    const result = sickLeaveVacationOverlaps(CALENDAR, sick, vacations);
    expect(result.map((r) => r.vacation.id)).toEqual(["v1", "v3"]);
    expect(result[0]).toMatchObject({
      overlap: { start: "2026-11-10", end: "2026-11-14" },
      daysToMove: 5,
      isOpen: true,
    });
  });
});
