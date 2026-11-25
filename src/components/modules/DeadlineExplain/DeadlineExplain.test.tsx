import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stepDeadline } from "@/core/deadline";
import { CALENDAR, makeEmployee } from "@/test/fixtures";
import DeadlineExplain from "./DeadlineExplain";

describe("DeadlineExplain", () => {
  // Даты без года показываются только для текущего года — фиксируем «сегодня»
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 10, 25), toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("срок через праздник: дата, рабочие дни и разбор «почему»", async () => {
    // Старт пт 30 окт. 2026, 3 раб. дня: 2 и 3 нояб. рабочие, 4 нояб. — праздник → до 5 нояб.
    const deadline = stepDeadline(
      CALENDAR,
      { approverId: "a", durationDays: 3, start: "2026-10-30" },
      { employees: [makeEmployee("a")], absences: [] },
    );
    render(
      <DeadlineExplain
        start={deadline.start}
        due={deadline.due}
        durationDays={deadline.durationDays}
        extraDaysOff={deadline.extraDaysOff}
      />,
    );
    expect(deadline.due).toBe("2026-11-05");
    expect(screen.getByText("до 5 нояб.")).toBeInTheDocument();
    expect(screen.getByText("3 раб. дня с 30 окт.")).toBeInTheDocument();

    await userEvent.click(screen.getByText(/\+3 календ\. дня — почему/));
    expect(screen.getByText(/^4 нояб\. — /)).toBeVisible();
    expect(screen.getByText("2 выходных")).toBeVisible();
  });

  it("без нерабочих дней внутри — без разбора", () => {
    render(
      <DeadlineExplain start="2026-11-23" due="2026-11-25" durationDays={2} extraDaysOff={[]} />,
    );
    expect(screen.queryByText(/почему/)).not.toBeInTheDocument();
  });
});
