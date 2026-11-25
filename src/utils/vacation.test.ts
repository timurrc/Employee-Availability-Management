import { describe, expect, it } from "vitest";
import type { IDepartment } from "@/types/employee.types";
import { CALENDAR, makeAbsence, makeEmployee } from "@/test/fixtures";
import {
  approvalQueue,
  canCancel,
  decidedToday,
  deputyCheck,
  formatBalance,
  myRequests,
  requestCalc,
  requestConflict,
  requestIssues,
  vacationSummary,
  vacationTabsFor,
  workingYear,
} from "./vacation";

const TODAY = "2026-11-25";

describe("workingYear", () => {
  it("от последней годовщины приёма до дня перед следующей", () => {
    expect(workingYear("2023-03-13", TODAY)).toEqual({ start: "2026-03-13", end: "2027-03-12" });
    expect(workingYear("2023-12-01", TODAY)).toEqual({ start: "2025-12-01", end: "2026-11-30" });
  });

  it("в год приёма — с даты приёма; в день годовщины — новый год", () => {
    expect(workingYear("2026-09-01", TODAY)).toEqual({ start: "2026-09-01", end: "2027-08-31" });
    expect(workingYear("2020-11-25", TODAY).start).toBe("2026-11-25");
  });
});

describe("vacationSummary", () => {
  const employee = makeEmployee("e1", { hireDate: "2023-03-13", vacationCarryover: 5 });

  it("начислено за рабочий год + остаток; использовано и запланировано раздельно", () => {
    const absences = [
      makeAbsence("past", "e1", "2026-07-06", "2026-07-19"), // 14 дн., уже прошёл
      makeAbsence("future", "e1", "2026-12-14", "2026-12-18"), // 5 дн., согласован
      makeAbsence("pending", "e1", "2027-02-15", "2027-03-01", { status: "pending" }), // 14 (23 февр.)
      makeAbsence("rejected", "e1", "2026-08-03", "2026-08-09", { status: "rejected" }),
      makeAbsence("old", "e1", "2025-08-04", "2025-08-17"), // прошлый рабочий год
      makeAbsence("unpaid", "e1", "2026-10-01", "2026-10-02", { type: "unpaid" }),
    ];
    const summary = vacationSummary(CALENDAR, employee, absences, TODAY);
    // 13.03 → 25.11: 8 полных месяцев + 13 дней (< 15) → 8 × 2,33 = 18,67
    expect(summary).toMatchObject({
      accrued: 23.67,
      carryover: 5,
      used: 14,
      planned: 19,
      available: -9.33,
      annual: 28,
      hasLongPart: true,
    });
  });

  it("редактируемая заявка не списывается дважды", () => {
    const absences = [
      makeAbsence("draft", "e1", "2026-12-14", "2026-12-18", { status: "pending" }),
    ];
    expect(vacationSummary(CALENDAR, employee, absences, TODAY, "draft").planned).toBe(0);
  });

  it("formatBalance: целые без дробной части, дробные — через запятую", () => {
    expect(formatBalance(12)).toBe("12");
    expect(formatBalance(4.67)).toBe("4,67");
  });
});

describe("requestCalc", () => {
  it("праздник продлевает отпуск, перенесённый выходной входит", () => {
    const calc = requestCalc(CALENDAR, { start: "2027-02-15", end: "2027-03-01" });
    expect(calc.duration.calendarDays).toBe(15);
    expect(calc.duration.chargeableDays).toBe(14);
    expect(calc.returnDate).toBe("2027-03-02");
    expect(calc.notes).toEqual([
      {
        period: { start: "2027-02-22", end: "2027-02-22" },
        kind: "transfer",
        text: "перенесённый выходной, входит в отпуск",
      },
      {
        period: { start: "2027-02-23", end: "2027-02-23" },
        kind: "holiday",
        text: "праздник, в отпуск не входит и продлевает его (ст. 120 ТК РФ)",
      },
    ]);
  });

  it("несколько праздников подряд — одной строкой; выход — после выходных", () => {
    const calc = requestCalc(CALENDAR, { start: "2026-12-28", end: "2027-01-09" });
    expect(calc.notes.map((n) => n.kind)).toEqual(["transfer", "holiday"]);
    expect(calc.notes[1]).toMatchObject({
      period: { start: "2027-01-01", end: "2027-01-08" },
      text: expect.stringContaining("праздники, в отпуск не входят"),
    });
    expect(calc.returnDate).toBe("2027-01-11");
  });
});

describe("requestIssues", () => {
  const summary = vacationSummary(
    CALENDAR,
    makeEmployee("e1", { hireDate: "2023-03-13", vacationCarryover: 0 }),
    [],
    TODAY,
  );
  const base = { employeeId: "e1", type: "vacation" as const };

  it("ошибки ввода: прошлое, больше года вперёд, пересечение со своей заявкой", () => {
    const absences = [makeAbsence("a1", "e1", "2026-12-01", "2026-12-07", { status: "pending" })];
    expect(
      requestIssues(
        { ...base, period: { start: "2026-11-20", end: "2026-12-02" } },
        { today: TODAY, absences, days: 13, summary },
      ).errors,
    ).toEqual(["Отпуск не может начинаться в прошлом", "Пересекается с вашим отпуском 1–7 дек."]);
    expect(
      requestIssues(
        { ...base, period: { start: "2027-12-01", end: "2027-12-14" } },
        { today: TODAY, absences: [], days: 14, summary },
      ).errors,
    ).toEqual(["Заявку можно подать не больше чем на год вперёд"]);
    expect(
      requestIssues(
        { ...base, period: { start: "2026-12-10", end: "2026-12-01" } },
        { today: TODAY, absences: [], days: 0, summary },
      ).errors,
    ).toContain("Дата окончания раньше даты начала");
  });

  it("редактируемая заявка и отклонённые не пересекаются", () => {
    const absences = [
      makeAbsence("self", "e1", "2026-12-01", "2026-12-07", { status: "draft" }),
      makeAbsence("rej", "e1", "2026-12-01", "2026-12-07", { status: "rejected" }),
    ];
    expect(
      requestIssues(
        { ...base, id: "self", period: { start: "2026-12-01", end: "2026-12-07" } },
        { today: TODAY, absences, days: 7, summary },
      ).errors,
    ).toEqual([]);
  });

  it("нехватка баланса — округление вверх; только для ежегодного", () => {
    // accrued 18,67 → не хватает 2 при 21 дне
    const period = { start: "2027-01-11", end: "2027-01-31" };
    expect(
      requestIssues({ ...base, period }, { today: TODAY, absences: [], days: 21, summary })
        .shortage,
    ).toBe(3);
    expect(
      requestIssues(
        { ...base, type: "unpaid", period },
        { today: TODAY, absences: [], days: 21, summary },
      ).shortage,
    ).toBe(0);
  });

  it("часть ≥ 14: info, если ещё успеть; warning, если нет; нет — если часть большая", () => {
    const period = { start: "2027-01-11", end: "2027-01-12" };
    const ctx = { today: TODAY, absences: [], summary };
    expect(requestIssues({ ...base, period }, { ...ctx, days: 2 }).longPart?.level).toBe("info");
    expect(requestIssues({ ...base, period }, { ...ctx, days: 7 }).longPart).toMatchObject({
      level: "warning",
      message: expect.stringContaining("останется 11 дн."),
    });
    expect(requestIssues({ ...base, period }, { ...ctx, days: 14 }).longPart).toBeNull();
    expect(
      requestIssues(
        { ...base, period },
        { ...ctx, days: 7, summary: { ...summary, hasLongPart: true } },
      ).longPart,
    ).toBeNull();
  });
});

describe("конфликты и заместитель", () => {
  const department: IDepartment = { id: "d1", name: "ИТ", headId: "m", coverageThreshold: 60 };
  const employees = [
    makeEmployee("m"),
    makeEmployee("e1", { managerId: "m", deputyId: "e2" }),
    makeEmployee("e2", { managerId: "m", deputyId: "e3" }),
    makeEmployee("e3", { managerId: "m" }),
    makeEmployee("e4", { managerId: "m" }),
    makeEmployee("x", { departmentId: "d2", managerId: "m2" }),
  ];

  it("requestConflict: худший день, диапазоны через выходные, коллеги в отпуске", () => {
    const strict = { ...department, coverageThreshold: 70 };
    const absences = [
      makeAbsence("a2", "e2", "2026-12-03", "2026-12-08", { status: "pending" }),
      makeAbsence("x1", "x", "2026-12-01", "2026-12-10"),
    ];
    const conflict = requestConflict(CALENDAR, strict, employees, absences, {
      employeeId: "e1",
      period: { start: "2026-12-01", end: "2026-12-10" },
    });
    expect(conflict?.ranges).toEqual([{ start: "2026-12-03", end: "2026-12-08" }]);
    expect(conflict?.worst).toMatchObject({ available: 3, total: 5, percent: 60 });
    expect(conflict?.others.map((a) => a.id)).toEqual(["a2"]);
  });

  it("requestConflict: порог не нарушен — null", () => {
    expect(
      requestConflict(CALENDAR, department, employees, [], {
        employeeId: "e1",
        period: { start: "2026-12-01", end: "2026-12-10" },
      }),
    ).toBeNull();
  });

  it("deputyCheck: на месте / нет / отсутствует — кто подхватит по цепочке", () => {
    const request = { employeeId: "e1", period: { start: "2026-12-01", end: "2026-12-10" } };
    expect(deputyCheck(null, request, { employees, absences: [] }).status).toBe("none");
    expect(deputyCheck("e2", request, { employees, absences: [] }).status).toBe("ok");

    const absences = [makeAbsence("a2", "e2", "2026-12-05", "2026-12-20", { status: "pending" })];
    expect(deputyCheck("e2", request, { employees, absences })).toMatchObject({
      status: "absent",
      absence: { id: "a2" },
      fallbackId: "e3",
    });
  });

  it("deputyCheck: цепочка вернулась к самому заявителю — замещающего нет", () => {
    const people = [makeEmployee("e1", { deputyId: "e2" }), makeEmployee("e2", { deputyId: "e1" })];
    const absences = [makeAbsence("a2", "e2", "2026-11-28", "2026-12-20")];
    const request = { employeeId: "e1", period: { start: "2026-12-01", end: "2026-12-10" } };
    expect(deputyCheck("e2", request, { employees: people, absences }).fallbackId).toBeNull();
  });

  it("approvalQueue: только подчинённые на согласовании; ниже порога — сверху", () => {
    const absences = [
      makeAbsence("calm", "e4", "2026-12-14", "2026-12-18", { status: "pending" }),
      makeAbsence("e3busy", "e3", "2026-12-21", "2026-12-25"),
      makeAbsence("e2busy", "e2", "2026-12-21", "2026-12-25", { status: "pending" }),
      makeAbsence("risky", "e1", "2026-12-21", "2026-12-25", {
        status: "pending",
        type: "unpaid",
      }),
      makeAbsence("other", "x", "2026-12-01", "2026-12-05", { status: "pending" }),
      makeAbsence("open", "e4", "2026-12-01", null, { status: "pending" }),
    ];
    const rows = approvalQueue(CALENDAR, {
      managerId: "m",
      employees,
      departments: [department],
      absences,
    });
    expect(rows.map((r) => r.absence.id)).toEqual(["e2busy", "risky", "calm"]);
    expect(rows[1]).toMatchObject({
      days: 5,
      isBelow: true,
      // e1 (заявка), e2 и e3 в эти дни, у e4 — заявка без даты окончания
      minCoverage: { available: 1 },
      deputy: { deputyId: "e2", status: "absent" },
    });
    expect(rows[2]?.deputy).toMatchObject({ deputyId: null, status: "none" });
  });

  it("approvalQueue: подчинённый вне известных отделов — без покрытия", () => {
    const rows = approvalQueue(CALENDAR, {
      managerId: "m",
      employees,
      departments: [],
      absences: [makeAbsence("a", "e4", "2026-12-14", "2026-12-18", { status: "pending" })],
    });
    expect(rows[0]).toMatchObject({ minCoverage: null, isBelow: false, days: 5 });
  });
});

describe("вкладки и списки", () => {
  it("vacationTabsFor: по ролям; у руководителя очередь по умолчанию, если не пуста", () => {
    expect(vacationTabsFor("employee", 0)).toEqual({ tabs: ["mine"], fallback: "mine" });
    expect(vacationTabsFor("manager", 2).fallback).toBe("queue");
    expect(vacationTabsFor("manager", 0).fallback).toBe("mine");
    expect(vacationTabsFor("hr", 0).tabs).toEqual(["mine", "all"]);
  });

  it("myRequests: без больничных и командировок, новые сверху", () => {
    const absences = [
      makeAbsence("a", "e1", "2026-06-01", "2026-06-05"),
      makeAbsence("b", "e1", "2027-02-15", "2027-03-01", { status: "pending" }),
      makeAbsence("s", "e1", "2026-10-01", "2026-10-05", { type: "sick", status: "closed" }),
      makeAbsence("t", "e1", "2026-10-11", "2026-10-12", { type: "trip" }),
      makeAbsence("x", "e2", "2026-10-11", "2026-10-12"),
    ];
    expect(myRequests(absences, "e1").map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("canCancel: на согласовании или согласованная будущая", () => {
    expect(canCancel(makeAbsence("a", "e1", "2026-12-01", "2026-12-05"), TODAY)).toBe(true);
    expect(canCancel(makeAbsence("a", "e1", "2026-11-20", "2026-12-05"), TODAY)).toBe(false);
    expect(
      canCancel(makeAbsence("a", "e1", "2026-11-20", "2026-12-05", { status: "pending" }), TODAY),
    ).toBe(true);
    expect(
      canCancel(makeAbsence("a", "e1", "2026-12-01", "2026-12-05", { status: "draft" }), TODAY),
    ).toBe(false);
  });

  it("decidedToday: только решения этого руководителя за сегодня", () => {
    const absences = [
      makeAbsence("a", "e1", "2026-12-01", "2026-12-05", { decision: { byId: "m", at: TODAY } }),
      makeAbsence("b", "e1", "2026-12-01", "2026-12-05", {
        decision: { byId: "m", at: "2026-11-24" },
      }),
      makeAbsence("c", "e1", "2026-12-01", "2026-12-05", { decision: { byId: "z", at: TODAY } }),
      makeAbsence("d", "e1", "2026-12-01", "2026-12-05"),
    ];
    expect(decidedToday(absences, "m", TODAY).map((a) => a.id)).toEqual(["a"]);
  });
});
