import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_TOKEN } from "@/constants/mock";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import DeadlinesPage from "./DeadlinesPage";

describe("DeadlinesPage", () => {
  beforeEach(() =>
    useAuthStore
      .getState()
      .setAuth(MOCK_TOKEN, { id: "e21", name: "Демо", position: "—", role: "employee" }),
  );

  it("дата + N из URL: результат, разбор через Новый год", async () => {
    renderWithProviders(<DeadlinesPage />, { route: "/deadlines?from=2026-12-28&days=5" });
    expect(await screen.findByTestId("calc-result")).toHaveTextContent("13 января 2027, среда");
    expect(screen.getByText("5 рабочих дней = 16 календарных дней")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Разбор по дням" })).toHaveTextContent(
      /Новогодние каникулы/,
    );
  });

  it("ошибка N и пересчёт на лету", async () => {
    renderWithProviders(<DeadlinesPage />, { route: "/deadlines?from=2026-11-20&days=3" });
    expect(await screen.findByTestId("calc-result")).toHaveTextContent("25 ноября 2026");
    const days = screen.getByLabelText("Рабочих дней (+/−)");
    await userEvent.clear(days);
    await userEvent.type(days, "0");
    expect(screen.getByText("Не может быть 0")).toBeInTheDocument();
    expect(screen.queryByTestId("calc-result")).toBeNull();
  });

  it("с учётом отсутствия исполнителя", async () => {
    renderWithProviders(<DeadlinesPage />, {
      route: "/deadlines?from=2026-12-02&days=3&employee=e19",
    });
    expect(await screen.findByText(/Если ждать выхода —/)).toBeInTheDocument();
    expect(screen.getByText(/Или передать Новиков С\./)).toBeInTheDocument();
  });

  it("между датами и незагруженный год", async () => {
    renderWithProviders(<DeadlinesPage />, {
      route: "/deadlines?mode=between&from=2027-12-01&to=2028-01-31",
    });
    expect(await screen.findByText(/Календарь на 2028 не загружен/)).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Январь 2028" })).toBeInTheDocument();
  });
});
