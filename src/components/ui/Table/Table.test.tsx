import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Table, { type TableColumn } from "./Table";

interface Row {
  id: string;
  name: string;
  days: number;
}

const ROWS: Row[] = [
  { id: "1", name: "Борисов", days: 14 },
  { id: "2", name: "Абрамов", days: 3 },
  { id: "3", name: "Волков", days: 7 },
];

const COLUMNS: TableColumn<Row>[] = [
  { key: "name", header: "ФИО", cell: (r) => r.name, sortValue: (r) => r.name },
  { key: "days", header: "Дней", cell: (r) => r.days, sortValue: (r) => r.days, align: "right" },
];

const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]!.textContent);

describe("Table", () => {
  it("сортирует по клику на заголовок, повторный клик — в обратном порядке", async () => {
    render(<Table caption="Заявки" columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} />);
    await userEvent.click(screen.getByRole("button", { name: /Дней/ }));
    expect(names()).toEqual(["Абрамов", "Волков", "Борисов"]);
    expect(screen.getByRole("columnheader", { name: /Дней/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );

    await userEvent.click(screen.getByRole("button", { name: /Дней/ }));
    expect(names()).toEqual(["Борисов", "Волков", "Абрамов"]);
  });

  it("пустой список — показывает empty вместо таблицы", () => {
    render(
      <Table
        caption="Заявки"
        columns={COLUMNS}
        rows={[]}
        getRowId={(r) => r.id}
        empty={<p>Заявок нет</p>}
      />,
    );
    expect(screen.getByText("Заявок нет")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
