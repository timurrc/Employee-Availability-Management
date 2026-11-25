import { describe, expect, it } from "vitest";
import type { IDepartment } from "@/types/employee.types";
import { CALENDAR, makeAbsence, makeDelegation, makeEmployee } from "@/test/fixtures";
import {
  absenceOn,
  availableFrom,
  coverageConflicts,
  requestCoverage,
  departmentCoverage,
  deputyCycle,
  resolveDeputy,
  statusOn,
} from "./availability";

describe("absenceOn", () => {
  const absences = [
    makeAbsence("v", "e1", "2026-11-01", "2026-11-14"),
    makeAbsence("s", "e1", "2026-11-10", null, { type: "sick", status: "open" }),
    makeAbsence("p", "e2", "2026-11-01", "2026-11-14", { status: "pending" }),
  ];

  it("пересечение — больничный важнее отпуска", () => {
    expect(absenceOn(absences, "e1", "2026-11-12")?.id).toBe("s");
    expect(absenceOn(absences, "e1", "2026-11-05")?.id).toBe("v");
  });

  it("заявка на согласовании — не отсутствие, если не попросили иначе", () => {
    expect(absenceOn(absences, "e2", "2026-11-05")).toBeNull();
    expect(absenceOn(absences, "e2", "2026-11-05", () => true)?.id).toBe("p");
  });
});

describe("statusOn", () => {
  const absences = [makeAbsence("v", "e1", "2026-11-02", "2026-11-15")];

  it("в отпуске — до какого числа", () => {
    expect(statusOn(CALENDAR, "e1", "2026-11-05", absences)).toMatchObject({
      status: "absent",
      until: "2026-11-15",
    });
  });

  it("в выходной внутри отпуска — всё равно в отпуске", () => {
    expect(statusOn(CALENDAR, "e1", "2026-11-07", absences).status).toBe("absent");
  });

  it("праздник без отсутствия — day_off, рабочий день — available", () => {
    expect(statusOn(CALENDAR, "e2", "2026-11-04", absences)).toMatchObject({
      status: "day_off",
      absence: null,
      until: null,
    });
    expect(statusOn(CALENDAR, "e2", "2026-11-05", absences).status).toBe("available");
  });

  it("открытый больничный — дата окончания неизвестна", () => {
    const sick = [makeAbsence("s", "e3", "2026-11-20", null, { type: "sick", status: "open" })];
    expect(statusOn(CALENDAR, "e3", "2026-11-25", sick)).toMatchObject({
      status: "absent",
      until: null,
    });
  });
});

describe("availableFrom", () => {
  it("на месте — сегодня", () => {
    expect(availableFrom(CALENDAR, "e1", "2026-11-25", [])).toBe("2026-11-25");
  });

  it("в выходной — ближайший рабочий", () => {
    expect(availableFrom(CALENDAR, "e1", "2026-11-28", [])).toBe("2026-11-30");
  });

  it("отпуск до пятницы — выход в понедельник", () => {
    const absences = [makeAbsence("v", "e1", "2026-11-16", "2026-11-27")];
    expect(availableFrom(CALENDAR, "e1", "2026-11-20", absences)).toBe("2026-11-30");
  });

  it("отпуск встык с командировкой, потом новогодние каникулы", () => {
    const absences = [
      makeAbsence("v", "e1", "2026-12-14", "2026-12-25"),
      makeAbsence("t", "e1", "2026-12-28", "2026-12-30", { type: "trip" }),
    ];
    expect(availableFrom(CALENDAR, "e1", "2026-12-15", absences)).toBe("2027-01-11");
  });

  it("открытый больничный — неизвестно", () => {
    const absences = [makeAbsence("s", "e1", "2026-11-20", null, { type: "sick", status: "open" })];
    expect(availableFrom(CALENDAR, "e1", "2026-11-25", absences)).toBeNull();
  });
});

describe("resolveDeputy", () => {
  const DATE = "2026-11-25";
  const employees = [
    makeEmployee("a", { deputyId: "b" }),
    makeEmployee("b", { deputyId: "c" }),
    makeEmployee("c", { deputyId: "a" }),
    makeEmployee("d"),
    makeEmployee("e", { deputyId: "x" }),
  ];
  const away = (...ids: string[]) =>
    ids.map((id) => makeAbsence(`abs-${id}`, id, "2026-11-20", "2026-11-30"));

  it("на месте — действует сам", () => {
    expect(resolveDeputy("a", DATE, { employees, absences: [] })).toEqual({
      status: "self",
      actorId: "a",
      chain: ["a"],
    });
  });

  it("отсутствует — постоянный заместитель", () => {
    expect(resolveDeputy("a", DATE, { employees, absences: away("a") })).toEqual({
      status: "deputy",
      actorId: "b",
      chain: ["a", "b"],
    });
  });

  it("заместитель из отсутствия важнее постоянного", () => {
    const absences = [makeAbsence("v", "a", "2026-11-20", "2026-11-30", { deputyId: "d" })];
    expect(resolveDeputy("a", DATE, { employees, absences })).toMatchObject({
      actorId: "d",
      chain: ["a", "d"],
    });
  });

  it("цепочка A → B → C, если B тоже отсутствует", () => {
    expect(resolveDeputy("a", DATE, { employees, absences: away("a", "b") })).toEqual({
      status: "deputy",
      actorId: "c",
      chain: ["a", "b", "c"],
    });
  });

  it("цикл A → B → C → A — явное состояние, без зависания", () => {
    expect(resolveDeputy("a", DATE, { employees, absences: away("a", "b", "c") })).toEqual({
      status: "cycle",
      actorId: null,
      chain: ["a", "b", "c", "a"],
    });
  });

  it("заместитель не назначен — «нет замещающего»", () => {
    expect(resolveDeputy("d", DATE, { employees, absences: away("d") })).toEqual({
      status: "no_deputy",
      actorId: null,
      chain: ["d"],
    });
  });

  it("заместитель не найден среди сотрудников и отсутствует — конец цепочки", () => {
    expect(resolveDeputy("e", DATE, { employees, absences: away("e", "x") })).toEqual({
      status: "no_deputy",
      actorId: null,
      chain: ["e", "x"],
    });
  });

  it("ручное замещение действует, даже если сотрудник на месте, и важнее остальных", () => {
    const delegations = [makeDelegation("m", "a", "d", "2026-11-01", null)];
    expect(resolveDeputy("a", DATE, { employees, absences: away("a"), delegations })).toEqual({
      status: "deputy",
      actorId: "d",
      chain: ["a", "d"],
    });
  });

  it("ручное замещение вне периода не действует", () => {
    const delegations = [makeDelegation("m", "a", "d", "2026-12-01", "2026-12-10")];
    expect(resolveDeputy("a", DATE, { employees, absences: [], delegations }).status).toBe("self");
  });

  it("ручное замещение по типам документов", () => {
    const delegations = [
      makeDelegation("m", "a", "d", "2026-11-01", null, { documentTypes: ["contract"] }),
    ];
    const context = { employees, absences: [], delegations };
    expect(resolveDeputy("a", DATE, { ...context, documentType: "contract" }).actorId).toBe("d");
    expect(resolveDeputy("a", DATE, { ...context, documentType: "memo" }).status).toBe("self");
    expect(resolveDeputy("a", DATE, context).actorId).toBe("d");
  });
});

describe("покрытие подразделения", () => {
  const department: IDepartment = { id: "d1", name: "ИТ", headId: "e1", coverageThreshold: 60 };
  const employees = [
    ...["e1", "e2", "e3", "e4", "e5"].map((id) => makeEmployee(id)),
    makeEmployee("x1", { departmentId: "d2" }),
  ];

  it("departmentCoverage: только своё подразделение и действующие отсутствия", () => {
    const absences = [
      makeAbsence("a1", "e1", "2026-11-20", "2026-11-30"),
      makeAbsence("a2", "e2", "2026-11-20", "2026-11-30", { status: "pending" }),
      makeAbsence("a3", "x1", "2026-11-20", "2026-11-30"),
    ];
    expect(departmentCoverage(department, employees, absences, "2026-11-25")).toEqual({
      date: "2026-11-25",
      total: 5,
      available: 4,
      absentIds: ["e1"],
      percent: 80,
      threshold: 60,
      isBelowThreshold: false,
    });
  });

  it("пустое подразделение — 100 %", () => {
    expect(departmentCoverage(department, [], [], "2026-11-25")).toMatchObject({
      total: 0,
      percent: 100,
      isBelowThreshold: false,
    });
  });

  it("coverageConflicts: рабочие дни, где с заявкой покрытие ниже порога", () => {
    const absences = [
      makeAbsence("a1", "e1", "2026-12-01", "2026-12-04"),
      makeAbsence("a2", "e2", "2026-12-03", "2026-12-10", { status: "pending" }),
      makeAbsence("a3", "e3", "2026-12-01", "2026-12-10", { status: "rejected" }),
    ];
    const conflicts = coverageConflicts(CALENDAR, department, employees, absences, {
      employeeId: "e4",
      period: { start: "2026-11-30", end: "2026-12-06" },
    });
    expect(conflicts.map((c) => c.date)).toEqual(["2026-12-03", "2026-12-04"]);
    expect(conflicts[0]).toMatchObject({
      available: 2,
      percent: 40,
      absentIds: ["e1", "e2", "e4"],
    });
  });

  it("coverageConflicts: редактируемая заявка не считается дважды", () => {
    const absences = [
      makeAbsence("a1", "e1", "2026-12-01", "2026-12-04"),
      makeAbsence("own", "e4", "2026-12-01", "2026-12-04", { status: "pending" }),
    ];
    expect(
      coverageConflicts(CALENDAR, department, employees, absences, {
        id: "own",
        employeeId: "e4",
        period: { start: "2026-12-01", end: "2026-12-04" },
      }),
    ).toEqual([]);
  });

  it("requestCoverage: все рабочие дни заявки, выходные пропускаются", () => {
    const days = requestCoverage(CALENDAR, department, employees, [], {
      employeeId: "e4",
      period: { start: "2026-12-04", end: "2026-12-07" },
    });
    expect(days.map((d) => [d.date, d.available])).toEqual([
      ["2026-12-04", 4],
      ["2026-12-07", 4],
    ]);
  });
});

describe("deputyCycle", () => {
  const employees = [
    makeEmployee("a", { deputyId: "b" }),
    makeEmployee("b", { deputyId: "c" }),
    makeEmployee("c", { deputyId: null }),
    makeEmployee("x", { deputyId: "y" }),
    makeEmployee("y", { deputyId: "x" }),
  ];

  it("назначение, замыкающее цепочку, — цикл с путём от кандидата", () => {
    expect(deputyCycle(employees, "c", "a")).toEqual(["a", "b", "c"]);
  });

  it("сам себе заместитель — цикл", () => {
    expect(deputyCycle(employees, "a", "a")).toEqual(["a"]);
  });

  it("цепочка обрывается — цикла нет", () => {
    expect(deputyCycle(employees, "a", "c")).toBeNull();
  });

  it("чужая петля, не проходящая через сотрудника, — не цикл и не зависание", () => {
    expect(deputyCycle(employees, "a", "x")).toBeNull();
  });

  it("неизвестный кандидат — цикла нет", () => {
    expect(deputyCycle(employees, "a", "zzz")).toBeNull();
  });
});
