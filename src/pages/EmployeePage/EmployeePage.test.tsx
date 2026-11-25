import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_TOKEN } from "@/constants/mock";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import EmployeePage from "./EmployeePage";

const renderAt = (id: string) =>
  renderWithProviders(
    <Routes>
      <Route path={ROUTES.EMPLOYEE} element={<EmployeePage />} />
    </Routes>,
    { route: `/employees/${id}` },
  );

describe("EmployeePage", () => {
  beforeEach(() =>
    useAuthStore
      .getState()
      .setAuth(MOCK_TOKEN, { id: "e19", name: "Демо", position: "—", role: "manager" }),
  );

  it("в отпуске: до какого числа, когда выйдет, кто замещает", async () => {
    renderAt("e04");
    expect(
      await screen.findByRole("heading", { name: "Громов Павел Олегович" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^В отпуске до .+ включительно$/)).toBeInTheDocument();
    expect(screen.getByText(/^выйдет /)).toBeInTheDocument();
    expect(screen.getByText("Замещает:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Написать" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/),
    );
    expect(screen.getByRole("heading", { name: "Документы на нём" })).toBeInTheDocument();
  });

  it("план и история — вкладки", async () => {
    renderAt("e11");
    await userEvent.click(await screen.findByRole("tab", { name: /История/ }));
    expect(screen.getByRole("tab", { name: /История/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Согласована")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /План/ }));
    expect(screen.getByText("Отсутствий не запланировано")).toBeInTheDocument();
  });

  it("нет постоянного заместителя — предупреждение", async () => {
    renderAt("e03");
    expect(await screen.findByText(/Постоянный заместитель не назначен/)).toBeInTheDocument();
    expect(screen.getByText("На месте")).toBeInTheDocument();
  });

  it("не найден — пустое состояние со ссылкой на команду", async () => {
    renderAt("e999");
    expect(await screen.findByText("Сотрудник не найден")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "К списку команды" })).toHaveAttribute("href", "/team");
  });
});
