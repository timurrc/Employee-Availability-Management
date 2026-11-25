import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { ENV } from "@/constants/env";
import { MOCK_TOKEN } from "@/constants/mock";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { Role } from "@/types/employee.types";
import HomePage from "./HomePage";

const loginAs = (id: string, role: Role) =>
  useAuthStore.getState().setAuth(MOCK_TOKEN, { id, name: "Демо", position: "—", role });

const absentCard = () =>
  screen.getByRole("heading", { name: /^Отсутствуют/ }).closest("section") as HTMLElement;

describe("HomePage", () => {
  beforeEach(() => useAuthStore.getState().logout());

  it("руководитель ИТ: заявки ждут решения, отсутствующие отдела, покрытие", async () => {
    loginAs("e19", "manager");
    renderWithProviders(<HomePage />);

    expect(await screen.findByText("3 заявки на отпуск ждут решения")).toBeInTheDocument();
    const card = absentCard();
    // В ИТ сегодня: Мельников (командировка) и Новиков (отгул) — и они замещают друг друга
    expect(
      await within(card).findByRole("link", { name: "Мельников Роман Игоревич" }),
    ).toBeVisible();
    expect(within(card).getAllByText("Нет замещающего")).toHaveLength(2);
    expect(screen.getByRole("meter", { name: "Покрытие: ИТ-отдел" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Заявка на отпуск" })).toBeInTheDocument();
  });

  it("«Все» и поиск по ФИО; ничего не найдено — сброс", async () => {
    loginAs("e19", "manager");
    renderWithProviders(<HomePage />);
    const card = absentCard();
    await within(card).findByRole("link", { name: "Мельников Роман Игоревич" });

    await userEvent.click(within(card).getByRole("radio", { name: "Все" }));
    expect(within(card).getByRole("link", { name: "Громов Павел Олегович" })).toBeInTheDocument();

    await userEvent.type(within(card).getByRole("searchbox"), "Громов");
    expect(within(card).queryByRole("link", { name: "Мельников Роман Игоревич" })).toBeNull();

    await userEvent.clear(within(card).getByRole("searchbox"));
    await userEvent.type(within(card).getByRole("searchbox"), "Петр");
    expect(within(card).getByText("Никто с именем «Петр» сегодня не отсутствует")).toBeVisible();
    await userEvent.click(within(card).getByRole("button", { name: "Сбросить поиск" }));
    expect(within(card).getByRole("searchbox")).toHaveValue("");
  });

  it("ошибка отсутствий изолирована в блоке", async () => {
    server.use(
      http.get(`${ENV.API_URL}/absences`, () =>
        HttpResponse.json({ message: "Сервер недоступен" }, { status: 500 }),
      ),
    );
    loginAs("e19", "manager");
    renderWithProviders(<HomePage />);
    expect(await screen.findByText("Не удалось загрузить отсутствия")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Покрытие по подразделениям" })).toBeVisible();
  });

  it("HR — главное действие «Открыть больничный»", async () => {
    loginAs("e15", "hr");
    renderWithProviders(<HomePage />);
    expect(await screen.findByRole("link", { name: "Открыть больничный" })).toBeInTheDocument();
  });
});
