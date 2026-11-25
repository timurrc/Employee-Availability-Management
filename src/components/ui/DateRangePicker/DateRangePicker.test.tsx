import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DateRangePicker, { type DateRange } from "./DateRangePicker";

const Harness = ({ onChange }: { onChange: (range: DateRange | null) => void }) => {
  const [value, setValue] = useState<DateRange | null>(null);
  return (
    <DateRangePicker
      value={value}
      initialMonth="2026-12-01"
      single
      dayInfo={(date) =>
        date === "2026-12-31"
          ? { kind: "holiday", note: "Новогодние каникулы" }
          : { kind: "workday" }
      }
      onChange={(range) => {
        setValue(range);
        onChange(range);
      }}
    />
  );
};

describe("DateRangePicker", () => {
  it("два клика задают период; второй клик раньше первого — даты меняются местами", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /^14 декабря 2026/ }));
    expect(screen.getByText("Выберите дату окончания")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^1 декабря 2026/ }));
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-12-01", end: "2026-12-14" });
    expect(screen.getByLabelText("С")).toHaveValue("01.12.2026");
    expect(screen.getByLabelText("По")).toHaveValue("14.12.2026");
  });

  it("ввод с клавиатуры ДД.ММ.ГГГГ", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("С"), "28.12.2026");
    await userEvent.type(screen.getByLabelText("По"), "08.01.2027");
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-12-28", end: "2027-01-08" });
  });

  it("праздник объявляется в подписи дня", () => {
    render(<Harness onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /31 декабря 2026.*праздник: Новогодние каникулы/ }),
    ).toBeInTheDocument();
  });

  it("стрелки двигают фокус по дням", async () => {
    render(<Harness onChange={vi.fn()} />);
    const first = screen.getByRole("button", { name: /^1 декабря 2026/ });
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: /^8 декабря 2026/ })).toHaveFocus(),
    );
  });
});
