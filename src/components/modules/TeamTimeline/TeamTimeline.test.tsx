import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CALENDAR, makeAbsence, makeEmployee } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { IDepartment } from "@/types/employee.types";
import { timelineColumns, timelineCoverage } from "@/utils/timeline";
import TeamTimeline from "./TeamTimeline";

const TODAY = "2026-12-02";
const PERIOD = { start: "2026-11-30", end: "2026-12-13" };
const DEPARTMENT: IDepartment = { id: "d1", name: "ИТ-отдел", headId: "e1", coverageThreshold: 60 };
const EMPLOYEES = [
  makeEmployee("e1", { fullName: "Иванова Анна", position: "Руководитель" }),
  makeEmployee("e2", { fullName: "Петров Олег", position: "Разработчик" }),
];
const ABSENCES = [makeAbsence("a1", "e1", "2026-12-01", "2026-12-04")];

const setup = (props: { viewerId?: string; query?: string } = {}) => {
  const columns = timelineColumns(CALENDAR, PERIOD);
  const onOpenAbsence = vi.fn();
  const onEmptyCell = vi.fn();
  renderWithProviders(
    <TeamTimeline
      columns={columns}
      groups={[
        {
          department: DEPARTMENT,
          employees: EMPLOYEES,
          coverage: timelineCoverage(columns, DEPARTMENT, EMPLOYEES, ABSENCES),
        },
      ]}
      absences={ABSENCES}
      scale="2w"
      today={TODAY}
      query={props.query ?? ""}
      viewerId={props.viewerId}
      onOpenAbsence={onOpenAbsence}
      onEmptyCell={onEmptyCell}
    />,
  );
  return { onOpenAbsence, onEmptyCell };
};

describe("TeamTimeline", () => {
  it("сетка: ячейка объявляет человека, дату и отсутствие", () => {
    setup();
    expect(screen.getByRole("grid", { name: "Календарь команды" })).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: "Иванова А., 2 декабря 2026: отпуск, согласована" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: "Петров О., 5 декабря 2026: выходной" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: "2 декабря 2026: на месте 1 из 2, ниже порога" }),
    ).toBeInTheDocument();
  });

  it("клик по отсутствию открывает карточку, по пустой своей — новую заявку", async () => {
    const { onOpenAbsence, onEmptyCell } = setup({ viewerId: "e2" });
    await userEvent.click(screen.getByRole("gridcell", { name: /^Иванова А., 3 декабря 2026/ }));
    expect(onOpenAbsence).toHaveBeenCalledWith(ABSENCES[0], expect.any(HTMLElement));

    await userEvent.click(screen.getByRole("gridcell", { name: /^Петров О., 8 декабря 2026/ }));
    expect(onEmptyCell).toHaveBeenCalledWith("2026-12-08");

    // Чужая пустая ячейка ничего не делает
    await userEvent.click(screen.getByRole("gridcell", { name: /^Иванова А., 8 декабря 2026/ }));
    expect(onEmptyCell).toHaveBeenCalledTimes(1);
  });

  it("стрелки двигают фокус по ячейкам, Enter открывает отсутствие", () => {
    const { onOpenAbsence } = setup();
    const today = screen.getByRole("gridcell", { name: /^Иванова А., 2 декабря 2026/ });
    expect(today).toHaveAttribute("tabindex", "0");
    today.focus();

    fireEvent.keyDown(today, { key: "ArrowDown" });
    expect(screen.getByRole("gridcell", { name: /^Петров О., 2 декабря 2026/ })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    const next = screen.getByRole("gridcell", { name: /^Иванова А., 3 декабря 2026/ });
    expect(next).toHaveFocus();

    fireEvent.keyDown(next, { key: "Enter" });
    expect(onOpenAbsence).toHaveBeenCalledTimes(1);
  });

  it("поиск подсвечивает строку, не скрывая остальных", () => {
    setup({ query: "петров" });
    expect(screen.getByRole("link", { name: "Петров Олег" }).closest("[role=row]")).toHaveClass(
      "bg-[var(--color-primary-soft)]",
    );
    expect(screen.getByRole("link", { name: "Иванова Анна" })).toBeInTheDocument();
  });
});
