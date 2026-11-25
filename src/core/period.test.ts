import { describe, expect, it } from "vitest";
import { containsDate, isClosedPeriod, overlapPeriod, periodEnd, periodsOverlap } from "./period";

const p = (start: string, end: string | null) => ({ start, end });

describe("period", () => {
  it("periodEnd: открытый период тянется в бесконечность", () => {
    expect(periodEnd(p("2026-11-01", null))).toBe("9999-12-31");
    expect(periodEnd(p("2026-11-01", "2026-11-05"))).toBe("2026-11-05");
  });

  it("containsDate включает границы", () => {
    expect(containsDate(p("2026-11-01", "2026-11-05"), "2026-11-01")).toBe(true);
    expect(containsDate(p("2026-11-01", "2026-11-05"), "2026-11-05")).toBe(true);
    expect(containsDate(p("2026-11-01", "2026-11-05"), "2026-11-06")).toBe(false);
    expect(containsDate(p("2026-11-01", null), "2030-01-01")).toBe(true);
  });

  it("overlapPeriod: общий отрезок, касание в один день, нет пересечения", () => {
    expect(overlapPeriod(p("2026-11-01", "2026-11-10"), p("2026-11-05", "2026-11-20"))).toEqual(
      p("2026-11-05", "2026-11-10"),
    );
    expect(overlapPeriod(p("2026-11-01", "2026-11-05"), p("2026-11-05", "2026-11-06"))).toEqual(
      p("2026-11-05", "2026-11-05"),
    );
    expect(overlapPeriod(p("2026-11-01", "2026-11-04"), p("2026-11-05", "2026-11-06"))).toBeNull();
  });

  it("overlapPeriod двух открытых периодов — открытый", () => {
    expect(overlapPeriod(p("2026-11-01", null), p("2026-11-03", null))).toEqual(
      p("2026-11-03", null),
    );
  });

  it("periodsOverlap и isClosedPeriod", () => {
    expect(periodsOverlap(p("2026-11-01", null), p("2025-01-01", "2026-11-01"))).toBe(true);
    expect(periodsOverlap(p("2026-11-02", null), p("2025-01-01", "2026-11-01"))).toBe(false);
    expect(isClosedPeriod(p("2026-11-01", null))).toBe(false);
    expect(isClosedPeriod(p("2026-11-01", "2026-11-01"))).toBe(true);
  });
});
