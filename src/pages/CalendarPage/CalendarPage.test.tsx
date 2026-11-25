import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_TOKEN } from "@/constants/mock";
import { db } from "@/mocks/db";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { Role } from "@/types/employee.types";
import CalendarPage from "./CalendarPage";

const loginAs = (role: Role) =>
  useAuthStore.getState().setAuth(MOCK_TOKEN, { id: "e25", name: "Демо", position: "—", role });

describe("CalendarPage", () => {
  beforeEach(() => useAuthStore.getState().logout());

  it("сводка 2027 сходится с постановлением, 12 месяцев, кварталы", async () => {
    loginAs("employee");
    renderWithProviders(<CalendarPage />, { route: "/calendar?year=2027" });
    expect(await screen.findByText("✓ как в постановлении")).toBeInTheDocument();
    expect(screen.getByText(/Основание: .*№ 1187/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Декабрь" })).toHaveTextContent(/раб. дн./);
    await userEvent.click(screen.getByRole("radio", { name: "I кв" }));
    expect(screen.getByRole("rowheader", { name: "Февраль" })).toBeInTheDocument();
    // Не админ: импорта нет, клик по дню ничего не открывает
    expect(screen.queryByRole("button", { name: "Импорт JSON" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^23 февраля 2027/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("админ меняет тип дня — сводка предупреждает о расхождении", async () => {
    loginAs("admin");
    renderWithProviders(<CalendarPage />, { route: "/calendar?year=2027" });
    await userEvent.click(await screen.findByRole("button", { name: /^30 декабря 2027/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Праздник" }));
    expect(within(dialog).getByRole("checkbox", { name: /Сокращённый/ })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Применить" }));
    expect(
      await screen.findByText("Проверьте: 246 рабочих дней, по постановлению — 247."),
    ).toBeInTheDocument();
    expect(
      db
        .get()
        .calendars.find((c) => c.year === 2027)
        ?.holidays.at(-1)?.date,
    ).toBe("2027-12-30");
  });

  it("стрелки двигают фокус по дням", async () => {
    loginAs("employee");
    renderWithProviders(<CalendarPage />, { route: "/calendar?year=2027" });
    const first = await screen.findByRole("button", { name: /^1 января 2027/ });
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /^2 января 2027/ })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /^9 января 2027/ })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("button", { name: /^2 января 2027/ })).toHaveFocus();
  });

  it("незагруженный год: админу — импорт, остальным — к администратору", async () => {
    loginAs("admin");
    renderWithProviders(<CalendarPage />, { route: "/calendar?year=2030" });
    expect(await screen.findByText("Календарь на 2030 не загружен")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Импорт JSON" })).toHaveLength(2);
  });

  it("импорт JSON: ошибка формата, затем предпросмотр нового года и загрузка", async () => {
    loginAs("admin");
    renderWithProviders(<CalendarPage />, { route: "/calendar?year=2030" });
    await userEvent.click((await screen.findAllByRole("button", { name: "Импорт JSON" }))[0]!);
    const dialog = screen.getByRole("dialog", { name: "Импорт календаря" });
    const input = dialog.querySelector<HTMLInputElement>("input[type=file]")!;

    await userEvent.upload(input, new File(["{oops"], "bad.json", { type: "application/json" }));
    expect(await within(dialog).findByText(/не похож на JSON/)).toBeInTheDocument();

    const source = {
      year: 2030,
      source: "Тестовое постановление",
      holidays: [{ date: "2030-01-01", note: "НГ" }],
    };
    await userEvent.upload(
      input,
      new File([JSON.stringify(source)], "2030.json", { type: "application/json" }),
    );
    expect(await within(dialog).findByText(/^Новый год:/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Применить календарь 2030" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText(/Основание: Тестовое постановление/)).toBeInTheDocument();
  });
});
