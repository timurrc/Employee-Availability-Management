import { describe, expect, it } from "vitest";
import { CALENDAR, makeAbsence, makeEmployee } from "@/test/fixtures";
import type { IDocument } from "@/types/document.types";
import {
  calendarDays,
  extendedVacationEnd,
  filterSickRows,
  formatEln,
  isSickTab,
  overlapCount,
  overlapsOnClose,
  sickImpact,
  sickLeaveIssues,
  sickRows,
  unresolvedOverlaps,
} from "./sickLeave";

const TODAY = "2026-11-25";
const sick = (id: string, employeeId: string, start: string, end: string | null, status = "open") =>
  makeAbsence(id, employeeId, start, end, {
    type: "sick",
    status: status as "open" | "extended" | "closed",
  });

describe("форматирование", () => {
  it("ЭЛН группами по 4, календарные дни включительно", () => {
    expect(formatEln("910123456789")).toBe("9101 2345 6789");
    expect(calendarDays({ start: "2026-11-20", end: "2026-12-01" })).toBe(12);
    expect(isSickTab("closed")).toBe(true);
    expect(isSickTab("x")).toBe(false);
  });
});

describe("пересечение больничного с отпуском (ст. 124)", () => {
  const vacation = makeAbsence("v", "e1", "2026-11-24", "2026-12-07");

  it("закрытый больничный: продлить на дни пересечения, праздники продлевают ещё", () => {
    const leave = sick("s", "e1", "2026-11-18", "2026-11-27", "closed");
    const [item] = unresolvedOverlaps(CALENDAR, leave, [leave, vacation], TODAY);
    expect(item).toMatchObject({ daysToMove: 4, remaining: 4, extendedEnd: "2026-12-11" });
  });

  it("открытый больничный: «минимум» по сегодня, продлить нельзя", () => {
    const leave = sick("s", "e1", "2026-11-20", null);
    const [item] = unresolvedOverlaps(CALENDAR, leave, [leave, vacation], TODAY);
    expect(item).toMatchObject({ isOpen: true, minDays: 2, extendedEnd: null });
  });

  it("отпуск уже продлён из-за этого больничного — решено; продлили больничный — только разница", () => {
    const leave = sick("s", "e1", "2026-11-18", "2026-11-27", "closed");
    const extended = {
      ...vacation,
      period: { start: "2026-11-24", end: "2026-12-11" },
      extension: { sickLeaveId: "s", previousEnd: "2026-12-07", days: 4 },
    };
    expect(unresolvedOverlaps(CALENDAR, leave, [leave, extended], TODAY)).toEqual([]);

    const longer = { ...leave, period: { start: "2026-11-18", end: "2026-11-30" } };
    const [item] = unresolvedOverlaps(CALENDAR, longer, [longer, extended], TODAY);
    expect(item).toMatchObject({ daysToMove: 7, alreadyExtended: 4, remaining: 3 });
    expect(item?.extendedEnd).toBe("2026-12-14");
  });

  it("при закрытии — что продлить, без уже решённого", () => {
    const leave = sick("s", "e1", "2026-11-20", null);
    expect(overlapsOnClose(CALENDAR, leave, [leave, vacation], "2026-11-21")).toEqual([]);
    const [item] = overlapsOnClose(CALENDAR, leave, [leave, vacation], "2026-11-25");
    expect(item).toMatchObject({ remaining: 2, extendedEnd: "2026-12-09" });
  });

  it("окончание продлённого отпуска через праздник", () => {
    const winter = makeAbsence("w", "e1", "2026-12-20", "2026-12-31");
    expect(extendedVacationEnd(CALENDAR, winter, 2)).toBe("2027-01-10");
  });
});

describe("sickRows / filterSickRows", () => {
  const employees = [
    makeEmployee("e1", { fullName: "Иванов Пётр", deputyId: "e4", departmentId: "d1" }),
    makeEmployee("e2", { fullName: "Сидорова Мария", departmentId: "d2" }),
    makeEmployee("e3", { fullName: "Орлов Кирилл", departmentId: "d1" }),
    makeEmployee("e4", { fullName: "Петров Олег", deputyId: "e3", departmentId: "d2" }),
  ];
  const absences = [
    sick("old", "e1", "2026-11-10", null),
    sick("nodeputy", "e2", "2026-11-22", null),
    sick("overlap", "e3", "2026-11-20", "2026-11-27", "extended"),
    makeAbsence("v3", "e3", "2026-11-26", "2026-12-05"),
    sick("closed", "e4", "2026-11-01", "2026-11-10", "closed"),
    sick("ancient", "e4", "2026-06-01", "2026-06-10", "closed"),
    sick("future", "e1", "2026-11-27", "2026-11-28"),
    sick("ghost", "zzz", "2026-11-01", null),
  ];
  const rows = sickRows({
    calendar: CALENDAR,
    employees,
    departments: [{ id: "d1", name: "ИТ", headId: "e1", coverageThreshold: 50 }],
    absences,
    today: TODAY,
  });

  it("сортировка: пересечения → без замещающего → открытые давнее → закрытые свежие", () => {
    expect(rows.map((r) => r.leave.id)).toEqual([
      "overlap",
      "nodeputy",
      "old",
      "future",
      "closed",
      "ancient",
    ]);
    expect(overlapCount(rows)).toBe(1);
    expect(rows.find((r) => r.leave.id === "old")).toMatchObject({
      dayNumber: 16,
      noDeputy: false,
    });
    expect(rows.find((r) => r.leave.id === "future")?.dayNumber).toBeNull();
    expect(rows.find((r) => r.leave.id === "closed")).toMatchObject({ dayNumber: null });
    expect(rows[0]?.department?.name).toBe("ИТ");
  });

  it("фильтры: вкладка, подразделение, ФИО", () => {
    const ids = (tab: "open" | "closed" | "all", query = "", departmentId = "") =>
      filterSickRows(rows, { tab, query, departmentId }, TODAY).map((r) => r.leave.id);
    expect(ids("open")).toEqual(["overlap", "nodeputy", "old", "future"]);
    expect(ids("closed")).toEqual(["closed"]);
    expect(ids("all")).toHaveLength(6);
    expect(ids("all", "олег")).toEqual(["closed", "ancient"]);
    expect(ids("all", "петр")).toHaveLength(4); // «Пётр» и «Петров»: ё = е
    expect(ids("open", "", "d1")).toEqual(["overlap", "old", "future"]);
  });
});

describe("форма больничного", () => {
  const employees = [makeEmployee("e1", { deputyId: "e2" }), makeEmployee("e2")];
  const documents: IDocument[] = [
    {
      id: "d1",
      number: "Д-1",
      title: "Договор",
      type: "contract",
      authorId: "e2",
      createdAt: TODAY,
      routeStartedAt: TODAY,
      steps: [
        { id: "s1", approverId: "e1", durationDays: 2, status: "in_progress" },
        { id: "s2", approverId: "e1", durationDays: 2, status: "approved" },
        { id: "s3", approverId: "e2", durationDays: 2, status: "waiting", delegatedToId: "e1" },
      ],
    },
  ];
  const absences = [
    makeAbsence("v", "e1", "2026-12-05", "2026-12-18"),
    makeAbsence("far", "e1", "2027-02-01", "2027-02-10"),
    sick("open", "e2", "2026-11-20", null),
  ];

  it("что задевает: отпуск в ближайшие 14 дней, этапы на сотруднике, заместитель", () => {
    const impact = sickImpact(
      { employeeId: "e1", period: { start: TODAY, end: null } },
      { employees, absences, documents },
    );
    expect(impact.vacations.map((v) => v.id)).toEqual(["v"]);
    expect(impact.steps.map((s) => s.step.id)).toEqual(["s1", "s3"]);
    expect(impact.deputy?.id).toBe("e2");

    const closed = sickImpact(
      { employeeId: "e2", period: { start: TODAY, end: "2026-11-26" } },
      { employees, absences, documents },
    );
    expect(closed).toMatchObject({ vacations: [], steps: [], deputy: undefined });
  });

  it("проверки: далеко в будущем, уже открыт другой больничный", () => {
    const fmt = (date: string) => date;
    expect(
      sickLeaveIssues(
        { employeeId: "e1", period: { start: TODAY, end: null } },
        absences,
        TODAY,
        fmt,
      ),
    ).toEqual([]);
    expect(
      sickLeaveIssues(
        { employeeId: "e2", period: { start: "2026-12-01", end: null } },
        absences,
        TODAY,
        fmt,
      ).map((issue) => issue.message),
    ).toEqual([
      "Начало позже чем через 3 дня — проверьте дату",
      "Уже открыт больничный с 2026-11-20 — продлите его",
    ]);
  });
});
