import { describe, expect, it } from "vitest";
import { CALENDAR, makeAbsence, makeEmployee } from "@/test/fixtures";
import type { IDocument } from "@/types/document.types";
import {
  actorOf,
  documentDeadlines,
  documentRows,
  documentStatus,
  filterDocumentRows,
  isBeyondCalendar,
  isDocumentTab,
  routeIssues,
} from "./document";

const employees = [
  makeEmployee("a", { deputyId: "b" }),
  makeEmployee("b"),
  makeEmployee("c"),
  makeEmployee("d"),
];
const absences = [
  makeAbsence("va", "a", "2026-11-23", "2026-12-04"),
  makeAbsence("vc", "c", "2026-12-01", "2026-12-10"),
  makeAbsence("sd", "d", "2026-11-20", null, { type: "sick", status: "open" }),
];
const context = { calendar: CALENDAR, employees, absences };

const doc = (extra: Partial<IDocument> = {}): IDocument => ({
  id: "doc",
  number: "Д-1",
  title: "Договор поставки",
  type: "contract",
  authorId: "b",
  createdAt: "2026-11-20",
  routeStartedAt: null,
  steps: [
    { id: "s1", approverId: "a", durationDays: 2, status: "waiting" },
    { id: "s2", approverId: "c", durationDays: 3, status: "waiting" },
    { id: "s3", approverId: "d", durationDays: 1, status: "waiting" },
  ],
  ...extra,
});

describe("documentStatus", () => {
  it("черновик, на согласовании, согласован, отклонён", () => {
    expect(documentStatus(doc())).toBe("draft");
    const started = doc({ routeStartedAt: "2026-11-25" });
    expect(documentStatus(started)).toBe("in_progress");
    const approved = {
      ...started,
      steps: started.steps.map((s) => ({ ...s, status: "approved" as const })),
    };
    expect(documentStatus(approved)).toBe("approved");
    expect(
      documentStatus({ ...started, steps: [{ ...started.steps[0]!, status: "rejected" }] }),
    ).toBe("rejected");
    expect(documentStatus({ ...started, steps: [] })).toBe("in_progress");
    expect(actorOf({ ...started.steps[0]!, delegatedToId: "x" })).toBe("x");
    expect(isDocumentTab("waiting")).toBe(true);
    expect(isDocumentTab("nope")).toBe(false);
  });
});

describe("routeIssues", () => {
  it("отсутствует на старте, уйдёт в окне, некому замещать; решённые этапы — не проблема", () => {
    const draft = doc();
    const deadlines = documentDeadlines(draft, context, "2026-11-25");
    const issues = routeIssues(draft, deadlines, context);
    expect(issues.map((i) => [i.step.id, i.deadline.risk, i.deputyId])).toEqual([
      ["s1", "delegated", "b"],
      ["s2", "absent_in_window", null],
      ["s3", "no_deputy", null],
    ]);

    const decided = {
      ...draft,
      steps: [
        { ...draft.steps[0]!, delegatedToId: "b" },
        { ...draft.steps[1]!, waitForReturn: true },
        { ...draft.steps[2]!, status: "approved" as const },
      ],
    };
    expect(
      routeIssues(decided, documentDeadlines(decided, context, "2026-11-25"), context),
    ).toEqual([]);
  });

  it("уйдёт до окончания срока — заместитель на первый день отсутствия", () => {
    const withDeputy = [
      makeEmployee("c", { deputyId: "b" }),
      ...employees.filter((e) => e.id !== "c"),
    ];
    const ctx = { ...context, employees: withDeputy };
    const draft = doc({
      steps: [{ id: "s", approverId: "c", durationDays: 5, status: "waiting" }],
    });
    const [issue] = routeIssues(draft, documentDeadlines(draft, ctx, "2026-11-25"), ctx);
    expect(issue).toMatchObject({ deputyId: "b", deadline: { risk: "absent_in_window" } });

    const noDeputy = routeIssues(draft, documentDeadlines(draft, context, "2026-11-25"), context);
    expect(noDeputy[0]?.deputyId).toBeNull();
  });

  it("срок за горизонтом календаря", () => {
    expect(isBeyondCalendar(CALENDAR, "2030-01-10")).toBe(true);
    expect(isBeyondCalendar(CALENDAR, "2026-12-01")).toBe(false);
    expect(isBeyondCalendar(new Map(), "2030-01-10")).toBe(false);
  });
});

describe("documentRows / filterDocumentRows", () => {
  const inProgress = doc({
    id: "p",
    routeStartedAt: "2026-11-25",
    steps: [
      { id: "s1", approverId: "b", durationDays: 2, status: "approved", decidedAt: "2026-11-26" },
      { id: "s2", approverId: "a", durationDays: 2, status: "in_progress" },
    ],
  });
  const approved = doc({
    id: "ok",
    number: "С-9",
    title: "Счёт",
    type: "invoice",
    authorId: "c",
    routeStartedAt: "2026-11-01",
    steps: [
      { id: "s1", approverId: "b", durationDays: 1, status: "approved", decidedAt: "2026-11-02" },
      { id: "s2", approverId: "c", durationDays: 1, status: "approved", decidedAt: "2026-11-05" },
    ],
  });
  const rows = documentRows([doc(), inProgress, approved], context);

  it("строка: этап, у кого сейчас, риск, ожидаемая дата решения", () => {
    expect(rows[0]).toMatchObject({
      status: "draft",
      stepNumber: null,
      currentId: null,
      atRisk: false,
    });
    expect(rows[1]).toMatchObject({
      status: "in_progress",
      stepNumber: 2,
      currentId: "a",
      atRisk: true,
      decidedAt: null,
    });
    expect(rows[1]?.decisionDate).toBe(rows[1]?.currentDeadline?.due);
    expect(rows[2]).toMatchObject({
      status: "approved",
      decisionDate: null,
      decidedAt: "2026-11-05",
    });
  });

  it("фильтры: мои, жду моего решения, статус, тип, поиск", () => {
    const ids = (tab: "mine" | "waiting" | "all", viewer: string, extra = {}) =>
      filterDocumentRows(rows, { tab, status: "", type: "", query: "", ...extra }, viewer).map(
        (r) => r.document.id,
      );
    expect(ids("mine", "b")).toEqual(["doc", "p"]);
    expect(ids("waiting", "a")).toEqual(["p"]);
    expect(ids("all", "x", { status: "approved" })).toEqual(["ok"]);
    expect(ids("all", "x", { type: "invoice" })).toEqual(["ok"]);
    expect(ids("all", "x", { query: "с-9" })).toEqual(["ok"]);
  });
});
