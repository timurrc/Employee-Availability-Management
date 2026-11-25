import { describe, expect, it } from "vitest";
import { resolveDeputy, statusOn } from "@/core/availability";
import { CALENDAR, makeAbsence, makeEmployee } from "@/test/fixtures";
import type { IAbsence } from "@/types/absence.types";
import type { IDocument } from "@/types/document.types";
import type { IDepartment, IEmployee } from "@/types/employee.types";
import {
  absentRows,
  coverageRows,
  nextAbsence,
  nextDayOff,
  pendingActions,
  soonRows,
  upcomingEvents,
} from "./today";

const TODAY = "2026-11-25"; // среда

const DEPARTMENTS: IDepartment[] = [
  { id: "d1", name: "Юридический отдел", headId: "m", coverageThreshold: 60 },
  { id: "d2", name: "ИТ-отдел", headId: "e4", coverageThreshold: 50 },
];

const EMPLOYEES: IEmployee[] = [
  makeEmployee("m", { fullName: "Громов Павел", managerId: null, role: "manager" }),
  makeEmployee("e1", { fullName: "Егорова Ксения", deputyId: "e2", managerId: "m" }),
  makeEmployee("e2", { fullName: "Смирнов Андрей", managerId: "m" }),
  makeEmployee("e3", { fullName: "Иванов Пётр", managerId: "m" }),
  makeEmployee("e4", { fullName: "Петров Олег", departmentId: "d2", deputyId: "e2" }),
];

const ABSENCES: IAbsence[] = [
  makeAbsence("a1", "e1", "2026-11-20", "2026-12-09"),
  makeAbsence("a2", "e3", "2026-11-23", null, { type: "sick", status: "open" }),
  makeAbsence("a3", "e4", "2026-11-24", "2026-11-26", { type: "trip" }),
  makeAbsence("a4", "e2", "2026-11-28", "2026-12-05"),
  makeAbsence("a5", "e3", "2027-02-01", "2027-02-14", { status: "pending" }),
];

const statusOf = (absences: IAbsence[]) => (id: string, date: string) => ({
  availability: statusOn(CALENDAR, id, date, absences),
  upcoming: null,
  deputy: resolveDeputy(id, date, { employees: EMPLOYEES, absences }),
});

describe("absentRows", () => {
  it("нет замещающего — сверху, дальше — кто раньше выйдет", () => {
    const rows = absentRows(EMPLOYEES, statusOf(ABSENCES), CALENDAR, ABSENCES, TODAY);
    expect(rows.map((r) => r.employee.id)).toEqual(["e3", "e4", "e1"]);
    expect(rows[0]).toMatchObject({ noDeputy: true, returnsOn: null });
    expect(rows[1]?.returnsOn).toBe("2026-11-27");
    expect(rows[2]?.returnsOn).toBe("2026-12-10");
  });
});

describe("soonRows и nextAbsence", () => {
  it("кто уйдёт в ближайшие 7 дней — только те, кто сегодня на месте", () => {
    expect(soonRows(EMPLOYEES, ABSENCES, TODAY).map((r) => r.employee.id)).toEqual(["e2"]);
    expect(soonRows(EMPLOYEES, ABSENCES, TODAY, 2)).toEqual([]);
  });

  it("ближайшее отсутствие среди выбранных людей", () => {
    expect(nextAbsence(ABSENCES, new Set(["e2", "e4"]), TODAY)?.id).toBe("a4");
    expect(nextAbsence(ABSENCES, new Set(["e4"]), TODAY)).toBeNull();
  });
});

describe("coverageRows", () => {
  it("дальше всех ниже порога — сверху", () => {
    const rows = coverageRows(DEPARTMENTS, EMPLOYEES, ABSENCES, TODAY);
    expect(rows.map((r) => [r.department.id, r.coverage.percent])).toEqual([
      ["d2", 0],
      ["d1", 50],
    ]);
  });
});

describe("nextDayOff", () => {
  it("ближайший праздник или перенос — 31 декабря (перенос)", () => {
    expect(nextDayOff(CALENDAR, TODAY)).toMatchObject({ date: "2026-12-31", isTransfer: true });
    expect(nextDayOff(CALENDAR, TODAY, 10)).toBeNull();
  });
});

describe("upcomingEvents", () => {
  const document: IDocument = {
    id: "doc1",
    number: "Д-1",
    title: "Договор поставки",
    type: "contract",
    authorId: "e4",
    createdAt: TODAY,
    routeStartedAt: TODAY,
    steps: [{ id: "s1", approverId: "e2", durationDays: 2, status: "in_progress" }],
  };

  it("мой срок и моё отсутствие — по дате, в пределах 30 дней", () => {
    const events = upcomingEvents({
      userId: "e2",
      calendar: CALENDAR,
      employees: EMPLOYEES,
      absences: ABSENCES,
      documents: [document],
      today: TODAY,
    });
    expect(events.map((e) => [e.kind, e.date])).toEqual([
      ["deadline", "2026-11-27"],
      ["absence", "2026-11-28"],
    ]);
    expect(events[1]?.title).toBe("Отпуск · 28 нояб.\u2009–\u20095 дек.");
  });

  it("сокращённый день и заявка на согласовании", () => {
    const events = upcomingEvents({
      userId: "e3",
      calendar: CALENDAR,
      employees: EMPLOYEES,
      absences: ABSENCES,
      documents: [],
      today: "2026-10-30",
      days: 120,
    });
    expect(events.find((e) => e.kind === "shortened")?.date).toBe("2026-11-03");
    expect(events.find((e) => e.kind === "holiday")?.title).toBe(
      "Нерабочий день — День народного единства",
    );
    expect(events.find((e) => e.absence?.status === "pending")?.title).toBe(
      "Отпуск · 1–14 фев. 2027 (на согласовании)",
    );
  });
});

describe("pendingActions", () => {
  const context = {
    calendar: CALENDAR,
    employees: EMPLOYEES,
    departments: DEPARTMENTS,
    absences: ABSENCES,
    documents: [] as IDocument[],
    today: TODAY,
  };

  it("руководитель: заявки подчинённых и дни ниже порога", () => {
    const actions = pendingActions({ ...context, userId: "m", role: "manager" });
    expect(actions.map((a) => a.kind)).toEqual(["vacation_queue", "coverage_risk"]);
    expect(actions[0]?.text).toBe("1 заявка на отпуск ждёт решения");
    expect(actions[1]?.target).toEqual({ page: "team", departmentId: "d1" });
  });

  it("автор документа: этап стоит на отсутствующем согласующем", () => {
    const documents: IDocument[] = [
      {
        id: "doc1",
        number: "Д-142",
        title: "Договор",
        type: "contract",
        authorId: "e4",
        createdAt: TODAY,
        routeStartedAt: TODAY,
        steps: [{ id: "s1", approverId: "e1", durationDays: 2, status: "in_progress" }],
      },
    ];
    const [action] = pendingActions({ ...context, documents, userId: "e4", role: "employee" });
    expect(action).toMatchObject({
      kind: "stuck_document",
      text: "Д-142: Егорова К. отсутствует, этап стоит",
      actionLabel: "Передать заместителю",
    });
  });

  it("HR: больничный в отпуске и больничный без замещающего", () => {
    const absences = [
      ...ABSENCES,
      makeAbsence("a6", "e1", "2026-11-24", "2026-11-27", { type: "sick", status: "extended" }),
    ];
    const kinds = pendingActions({ ...context, absences, userId: "hr", role: "hr" }).map(
      (a) => a.id,
    );
    expect(kinds).toEqual(["sick-overlap-a6", "sick-no-deputy-a2"]);
  });

  it("нечего делать — пусто", () => {
    expect(pendingActions({ ...context, userId: "e2", role: "employee" })).toEqual([]);
  });
});
