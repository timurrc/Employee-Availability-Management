import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeEmployee } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import DeputyHint from "./DeputyHint";

const PEOPLE = {
  a: makeEmployee("a", { fullName: "Иванов Иван" }),
  b: makeEmployee("b", { fullName: "Смирнов Андрей" }),
  c: makeEmployee("c", { fullName: "Козлов Пётр" }),
};
const byId = (id: string) => PEOPLE[id as keyof typeof PEOPLE];

describe("DeputyHint", () => {
  it("сотрудник на месте — ничего не показывает", () => {
    const { container } = renderWithProviders(
      <DeputyHint
        resolution={{ status: "self", actorId: "a", chain: ["a"] }}
        employeeById={byId}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("цепочка: замещает Козлов, Смирнов тоже отсутствует", () => {
    renderWithProviders(
      <DeputyHint
        resolution={{ status: "deputy", actorId: "c", chain: ["a", "b", "c"] }}
        employeeById={byId}
      />,
    );
    expect(screen.getByRole("link", { name: "Козлов П." })).toBeInTheDocument();
    expect(screen.getByText("(Смирнов А. тоже отсутствует)")).toBeInTheDocument();
  });

  it("цикл — «Нет замещающего» с объяснением и действием", () => {
    renderWithProviders(
      <DeputyHint
        resolution={{ status: "cycle", actorId: null, chain: ["a", "b", "a"] }}
        employeeById={byId}
        emptyAction={<button type="button">Выбрать</button>}
      />,
    );
    expect(screen.getByText("Нет замещающего")).toBeInTheDocument();
    expect(
      screen.getByText(/замещения по кругу: Иванов И\. → Смирнов А\. → Иванов И\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выбрать" })).toBeInTheDocument();
  });

  it("заместитель не назначен", () => {
    renderWithProviders(
      <DeputyHint
        resolution={{ status: "no_deputy", actorId: null, chain: ["a"] }}
        employeeById={byId}
      />,
    );
    expect(screen.getByText(/заместитель не назначен/)).toBeInTheDocument();
  });
});
