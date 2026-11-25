import { describe, expect, it } from "vitest";
import { deputyCycle } from "@/core/availability";
import { MOCK_EMPLOYEES } from "./mock";

describe("сид моков", () => {
  it("постоянные заместители не образуют циклов — как и требует PATCH /deputy", () => {
    const cycles = MOCK_EMPLOYEES.filter((e) => e.deputyId !== null)
      .map((e) => deputyCycle(MOCK_EMPLOYEES, e.id, e.deputyId!))
      .filter((cycle) => cycle !== null);
    expect(cycles).toEqual([]);
  });

  it("заместитель — существующий сотрудник и не он сам", () => {
    const ids = new Set(MOCK_EMPLOYEES.map((e) => e.id));
    for (const e of MOCK_EMPLOYEES) {
      if (e.deputyId === null) continue;
      expect(ids.has(e.deputyId)).toBe(true);
      expect(e.deputyId).not.toBe(e.id);
    }
  });
});
