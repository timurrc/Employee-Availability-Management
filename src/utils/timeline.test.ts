import { describe, expect, it } from "vitest";
import { indexCalendar } from "@/core/calendar";
import { CALENDAR, makeAbsence, makeEmployee } from "@/test/fixtures";
import type { IDepartment } from "@/types/employee.types";
import { splitAbsences } from "./employee";
import {
  belowThresholdRanges,
  isVisibleOnTimeline,
  periodPhrase,
  shiftTimeline,
  timelineBars,
  timelineColumns,
  timelineCoverage,
  timelineGroups,
  timelinePeriod,
  timelineTitle,
} from "./timeline";

const TODAY = "2026-11-25";
const DECEMBER = { start: "2026-12-01", end: "2026-12-31" };
const DEPARTMENT: IDepartment = { id: "d1", name: "ИТ", headId: "e3", coverageThreshold: 60 };

describe("период сетки", () => {
  it("2 недели с понедельника, месяц, квартал", () => {
    expect(timelinePeriod("2w", TODAY)).toEqual({ start: "2026-11-23", end: "2026-12-06" });
    expect(timelinePeriod("month", TODAY)).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(timelinePeriod("quarter", TODAY)).toEqual({ start: "2026-10-01", end: "2026-12-31" });
  });

  it("листание через границу года", () => {
    expect(shiftTimeline("month", "2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftTimeline("quarter", "2026-10-01", -1)).toBe("2026-07-01");
    expect(shiftTimeline("2w", "2026-12-28", 1)).toBe("2027-01-11");
  });

  it("заголовок и фраза для пустого периода", () => {
    expect(timelineTitle("month", DECEMBER, TODAY)).toBe("Декабрь 2026");
    expect(timelineTitle("quarter", timelinePeriod("quarter", TODAY), TODAY)).toBe("IV кв. 2026");
    expect(periodPhrase("month", DECEMBER, TODAY)).toBe("В декабре");
    expect(periodPhrase("month", { start: "2027-05-01", end: "2027-05-31" }, TODAY)).toBe(
      "В мае 2027",
    );
    expect(periodPhrase("2w", { start: "2026-12-07", end: "2026-12-20" }, TODAY)).toBe("7–20 дек.");
  });
});

describe("timelineColumns", () => {
  it("год без календаря — догадка по сб/вс", () => {
    const only2026 = indexCalendar([]);
    const [first] = timelineColumns(only2026, { start: "2028-01-03", end: "2028-01-03" });
    expect(first).toMatchObject({ isGuess: true, day: { kind: "workday" } });
    expect(timelineColumns(CALENDAR, DECEMBER).at(-1)?.day.kind).toBe("weekend");
  });
});

describe("timelineBars", () => {
  it("обрезает отсутствие по периоду и помечает обрезанные края", () => {
    const [bar] = timelineBars(
      [makeAbsence("a1", "e1", "2026-11-20", "2026-12-09")],
      DECEMBER,
      TODAY,
    );
    expect(bar).toMatchObject({ column: 0, span: 9, cutStart: true, cutEnd: false });
  });

  it("открытый больничный — до «сегодня + 3» и растворяется", () => {
    const sick = makeAbsence("a1", "e1", "2026-11-23", null, { type: "sick", status: "open" });
    const [bar] = timelineBars([sick], { start: "2026-11-01", end: "2026-11-30" }, TODAY);
    expect(bar).toMatchObject({ column: 22, span: 6, isOpen: true, cutEnd: false });
  });

  it("за пределами периода — нет полосы; заявка — штриховка", () => {
    const pending = makeAbsence("a1", "e1", "2026-12-20", "2026-12-25", { status: "pending" });
    expect(timelineBars([pending], { start: "2026-11-01", end: "2026-11-30" }, TODAY)).toEqual([]);
    expect(timelineBars([pending], DECEMBER, TODAY)[0]?.isPending).toBe(true);
  });

  it("черновик видит только автор, отклонённое — никто", () => {
    const draft = makeAbsence("a1", "e1", "2026-12-01", "2026-12-05", { status: "draft" });
    expect(isVisibleOnTimeline(draft, "e1")).toBe(true);
    expect(isVisibleOnTimeline(draft, "e2")).toBe(false);
    expect(isVisibleOnTimeline({ ...draft, status: "rejected" }, "e1")).toBe(false);
  });
});

describe("покрытие в сетке", () => {
  const employees = ["e1", "e2", "e3"].map((id) => makeEmployee(id));
  const absences = [
    makeAbsence("a1", "e1", "2026-12-04", "2026-12-08"),
    makeAbsence("a2", "e2", "2026-12-07", "2026-12-07"),
  ];

  it("по рабочим дням; выходные — без столбика", () => {
    const columns = timelineColumns(CALENDAR, { start: "2026-12-04", end: "2026-12-08" });
    const coverage = timelineCoverage(columns, DEPARTMENT, employees, absences);
    expect(coverage.map((day) => day?.percent ?? null)).toEqual([67, null, null, 33, 67]);
    expect(coverage[3]?.isBelow).toBe(true);
  });

  it("отрезки ниже порога — выходные их не разрывают", () => {
    const day = (date: string, isBelow: boolean) => ({
      date,
      isBelow,
      available: 0,
      total: 0,
      percent: 0,
      threshold: 0,
    });
    expect(
      belowThresholdRanges([
        day("2026-12-03", false),
        day("2026-12-04", true),
        null,
        null,
        day("2026-12-07", true),
        day("2026-12-08", false),
        day("2026-12-09", true),
      ]),
    ).toEqual([
      { start: "2026-12-04", end: "2026-12-07" },
      { start: "2026-12-09", end: "2026-12-09" },
    ]);
  });
});

describe("timelineGroups", () => {
  it("руководитель отдела первым, дальше по алфавиту; пустые отделы не показываем", () => {
    const employees = [
      makeEmployee("e1", { fullName: "Яковлев Б" }),
      makeEmployee("e2", { fullName: "Абрамов А" }),
      makeEmployee("e3", { fullName: "Петров В" }),
    ];
    const empty: IDepartment = { ...DEPARTMENT, id: "d2" };
    const groups = timelineGroups([DEPARTMENT, empty], employees);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.employees.map((e) => e.id)).toEqual(["e3", "e2", "e1"]);
  });
});

describe("splitAbsences", () => {
  it("план — текущие и будущие, история — прошлые и отклонённые", () => {
    const absences = [
      makeAbsence("past", "e1", "2026-10-01", "2026-10-05"),
      makeAbsence("now", "e1", "2026-11-20", "2026-11-30"),
      makeAbsence("next", "e1", "2027-02-01", "2027-02-14", { status: "pending" }),
      makeAbsence("rej", "e1", "2027-03-01", "2027-03-05", { status: "rejected" }),
      makeAbsence("draft", "e1", "2027-04-01", "2027-04-05", { status: "draft" }),
      makeAbsence("other", "e2", "2026-12-01", "2026-12-05"),
    ];
    const result = splitAbsences(absences, "e1", TODAY);
    expect(result.plan.map((a) => a.id)).toEqual(["now", "next"]);
    expect(result.history.map((a) => a.id)).toEqual(["rej", "past"]);
    expect(result.next?.id).toBe("next");
    expect(splitAbsences(absences, "e1", TODAY, { showDrafts: true }).plan).toHaveLength(3);
  });
});
