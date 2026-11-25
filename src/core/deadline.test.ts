import { describe, expect, it } from "vitest";
import type { IDocument } from "@/types/document.types";
import { CALENDAR, makeAbsence, makeDelegation, makeEmployee } from "@/test/fixtures";
import { getDay } from "./calendar";
import { groupConsecutiveDays, routeDeadlines, stepDeadline } from "./deadline";

const employees = [
  makeEmployee("e1", { deputyId: "e2" }),
  makeEmployee("e2"),
  makeEmployee("e3"),
  makeEmployee("e4", { deputyId: "e5" }),
  makeEmployee("e5", { deputyId: "e4" }),
];

describe("groupConsecutiveDays", () => {
  it("склеивает идущие подряд дни, разрывы — новый диапазон", () => {
    const days = ["2027-02-22", "2027-02-23", "2027-03-08"].map((d) => getDay(CALENDAR, d));
    expect(groupConsecutiveDays(days).map(({ start, end }) => [start, end])).toEqual([
      ["2027-02-22", "2027-02-23"],
      ["2027-03-08", "2027-03-08"],
    ]);
  });

  it("пусто — пусто", () => {
    expect(groupConsecutiveDays([])).toEqual([]);
  });
});

describe("stepDeadline", () => {
  const context = { employees, absences: [] };

  it("согласующий на месте: срок с учётом праздника 4 ноября и объяснение", () => {
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e1", durationDays: 2, start: "2026-11-03" },
      context,
    );
    expect(result).toMatchObject({
      due: "2026-11-06",
      risk: "none",
      absence: null,
      dueIfWaiting: null,
      resolution: { status: "self", actorId: "e1" },
    });
    expect(result.extraDaysOff.map(({ start, end }) => [start, end])).toEqual([
      ["2026-11-04", "2026-11-04"],
    ]);
  });

  it("через Новый год: один диапазон 31.12–08.01", () => {
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e1", durationDays: 1, start: "2026-12-30" },
      context,
    );
    expect(result.due).toBe("2027-01-11");
    expect(result.extraDaysOff).toHaveLength(1);
    expect(result.extraDaysOff[0]).toMatchObject({ start: "2026-12-31", end: "2027-01-08" });
    expect(result.extraDaysOff[0].days).toHaveLength(9);
  });

  it("отсутствует — срок считается для заместителя", () => {
    const absences = [makeAbsence("v", "e1", "2026-11-20", "2026-12-04")];
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e1", durationDays: 2, start: "2026-11-25" },
      { employees, absences },
    );
    expect(result).toMatchObject({
      due: "2026-11-27",
      risk: "delegated",
      resolution: { status: "deputy", actorId: "e2" },
      dueIfWaiting: null,
    });
    expect(result.absence?.id).toBe("v");
  });

  it("на месте, но уходит в отпуск до окончания срока — риск", () => {
    const absences = [makeAbsence("v", "e3", "2026-11-27", "2026-12-10")];
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e3", durationDays: 3, start: "2026-11-25" },
      { employees, absences },
    );
    expect(result).toMatchObject({ due: "2026-11-30", risk: "absent_in_window" });
    expect(result.absence?.id).toBe("v");
  });

  it("последний день отсутствия — ещё риск, со следующего дня — уже нет", () => {
    const absences = [makeAbsence("v", "e3", "2026-11-16", "2026-11-24")];
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e3", durationDays: 3, start: "2026-11-24" },
      { employees, absences },
    );
    expect(result.risk).toBe("no_deputy");
    const next = stepDeadline(
      CALENDAR,
      { approverId: "e3", durationDays: 3, start: "2026-11-25" },
      { employees, absences },
    );
    expect(next.risk).toBe("none");
  });

  it("замещать некому — срок, если ждать выхода согласующего", () => {
    const absences = [makeAbsence("v", "e3", "2026-11-20", "2026-12-04")];
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e3", durationDays: 2, start: "2026-11-25" },
      { employees, absences },
    );
    expect(result).toMatchObject({
      due: "2026-11-27",
      risk: "no_deputy",
      resolution: { status: "no_deputy", actorId: null },
      dueIfWaiting: "2026-12-08",
    });
  });

  it("этап на 0 дней при ожидании — день выхода", () => {
    const absences = [makeAbsence("v", "e3", "2026-11-20", "2026-12-04")];
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e3", durationDays: 0, start: "2026-11-25" },
      { employees, absences },
    );
    expect(result.dueIfWaiting).toBe("2026-12-07");
  });

  it("открытый больничный без заместителя — дата неизвестна", () => {
    const absences = [makeAbsence("s", "e3", "2026-11-20", null, { type: "sick", status: "open" })];
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e3", durationDays: 2, start: "2026-11-25" },
      { employees, absences },
    );
    expect(result).toMatchObject({ risk: "no_deputy", dueIfWaiting: null });
  });

  it("цикл замещений — тот же риск, что и «нет замещающего»", () => {
    const absences = [
      makeAbsence("a", "e4", "2026-11-20", "2026-11-30"),
      makeAbsence("b", "e5", "2026-11-20", "2026-11-30"),
    ];
    const result = stepDeadline(
      CALENDAR,
      { approverId: "e4", durationDays: 1, start: "2026-11-25" },
      { employees, absences },
    );
    expect(result).toMatchObject({
      risk: "no_deputy",
      resolution: { status: "cycle" },
      dueIfWaiting: "2026-12-01",
    });
  });
});

describe("routeDeadlines", () => {
  const document: IDocument = {
    id: "doc",
    number: "Д-1",
    title: "Договор",
    type: "contract",
    authorId: "e2",
    createdAt: "2026-11-20",
    routeStartedAt: "2026-11-23",
    steps: [
      { id: "s1", approverId: "e2", durationDays: 2, status: "approved", decidedAt: "2026-11-24" },
      { id: "s2", approverId: "e3", durationDays: 2, status: "in_progress" },
      { id: "s3", approverId: "e1", durationDays: 1, status: "waiting", delegatedToId: "e2" },
      { id: "s4", approverId: "e4", durationDays: 1, status: "waiting" },
    ],
  };

  it("маршрут не запущен — сроков нет", () => {
    expect(
      routeDeadlines(CALENDAR, { ...document, routeStartedAt: null }, { employees, absences: [] }),
    ).toEqual([]);
  });

  it("этапы идут друг за другом: решение → срок → срок после выхода", () => {
    const absences = [makeAbsence("v", "e3", "2026-11-20", "2026-12-04")];
    const delegations = [
      makeDelegation("m", "e4", "e1", "2026-11-01", null, { documentTypes: ["contract"] }),
    ];
    const result = routeDeadlines(CALENDAR, document, { employees, absences, delegations });

    expect(result.map((r) => [r.stepId, r.start, r.due, r.risk])).toEqual([
      ["s1", "2026-11-23", "2026-11-25", "none"],
      ["s2", "2026-11-24", "2026-11-26", "no_deputy"],
      ["s3", "2026-12-08", "2026-12-09", "none"],
      ["s4", "2026-12-09", "2026-12-10", "delegated"],
    ]);
    expect(result[1].dueIfWaiting).toBe("2026-12-08");
    expect(result[2].approverId).toBe("e2");
    expect(result[3].resolution.actorId).toBe("e1");
  });
});
