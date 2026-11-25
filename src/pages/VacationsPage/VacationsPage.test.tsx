import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays, format } from "date-fns";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { ENV } from "@/constants/env";
import { MOCK_TOKEN } from "@/constants/mock";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { Role } from "@/types/employee.types";
import VacationsPage from "./VacationsPage";

const loginAs = (id: string, role: Role) =>
  useAuthStore.getState().setAuth(MOCK_TOKEN, { id, name: "Демо", position: "—", role });

/** ДД.ММ.ГГГГ через N дней от сегодня — моки тоже считаются от сегодня */
const inputDate = (days: number) => format(addDays(new Date(), days), "dd.MM.yyyy");
const isoDate = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");

const myList = () => screen.getByRole("list", { name: "Мои заявки" });

const fillPeriod = async (dialog: HTMLElement, from: number, to: number) => {
  await userEvent.type(within(dialog).getByLabelText("С"), inputDate(from));
  await userEvent.type(within(dialog).getByLabelText("По"), inputDate(to));
};

describe("VacationsPage", () => {
  beforeEach(() => useAuthStore.getState().logout());

  it("сотрудник: баланс, заявки, причина отказа; вкладок нет", async () => {
    loginAs("e21", "employee");
    renderWithProviders(<VacationsPage />);

    expect(await screen.findByText(/дн\. доступно$/)).toBeInTheDocument();
    const list = myList();
    expect(within(list).getByText("На согласовании")).toBeInTheDocument();
    expect(within(list).getByText("«Сдача проекта»")).toBeInTheDocument();
    expect(within(list).getByText("Согласована")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Раздел" })).toBeNull();
  });

  it("сотрудник подаёт заявку: расчёт, заместитель, отправка → в списке", async () => {
    loginAs("e21", "employee");
    renderWithProviders(<VacationsPage />);
    await screen.findByRole("list", { name: "Мои заявки" });
    expect(within(myList()).getAllByText("На согласовании")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Новая заявка" }));
    const dialog = screen.getByRole("dialog", { name: "Новая заявка на отпуск" });
    expect(within(dialog).getByRole("button", { name: "Отправить руководителю" })).toBeDisabled();
    expect(within(dialog).getByText("Выберите период")).toBeInTheDocument();

    await fillPeriod(dialog, 100, 106);
    expect(within(dialog).getByRole("region", { name: "Расчёт" })).toHaveTextContent(
      /спишется с баланса/,
    );
    expect(within(dialog).getByText("Согласует Кузнецов Д.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Заместитель")).toHaveValue("e22");

    await userEvent.click(within(dialog).getByRole("button", { name: "Отправить руководителю" }));
    await waitFor(() => expect(within(myList()).getAllByText("На согласовании")).toHaveLength(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("пересечение со своей заявкой — ошибка под полем, отправить нельзя", async () => {
    loginAs("e21", "employee");
    renderWithProviders(<VacationsPage />);
    await screen.findByRole("list", { name: "Мои заявки" });

    await userEvent.click(screen.getByRole("button", { name: "Новая заявка" }));
    const dialog = screen.getByRole("dialog");
    await fillPeriod(dialog, 25, 27);
    expect(within(dialog).getByText(/^Пересекается с вашим отпуском/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Отправить руководителю" })).toBeDisabled();
  });

  it("ошибка отправки — плашка с «Повторить», данные в форме остаются", async () => {
    server.use(
      http.post(`${ENV.API_URL}/absences`, () =>
        HttpResponse.json({ message: "Сервер недоступен" }, { status: 500 }),
      ),
    );
    loginAs("e21", "employee");
    renderWithProviders(<VacationsPage />);
    await screen.findByRole("list", { name: "Мои заявки" });

    await userEvent.click(screen.getByRole("button", { name: "Новая заявка" }));
    const dialog = screen.getByRole("dialog");
    await fillPeriod(dialog, 100, 106);
    await userEvent.click(within(dialog).getByRole("button", { name: "Отправить руководителю" }));

    expect(await within(dialog).findByText("Не удалось отправить заявку")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("С")).toHaveValue(inputDate(100));
  });

  it("закрытие с изменениями — «Сохранить черновик?»; сохранить → черновик в списке", async () => {
    loginAs("e21", "employee");
    renderWithProviders(<VacationsPage />);
    await screen.findByRole("list", { name: "Мои заявки" });

    await userEvent.click(screen.getByRole("button", { name: "Новая заявка" }));
    const sheet = screen.getByRole("dialog");
    await fillPeriod(sheet, 100, 106);
    await userEvent.keyboard("{Escape}");

    const confirm = screen.getByRole("dialog", { name: "Сохранить черновик?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Сохранить" }));
    expect(await within(myList()).findByText("Черновик")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("?start= из календаря команды открывает форму с датой начала", async () => {
    loginAs("e21", "employee");
    renderWithProviders(<VacationsPage />, { route: `/vacations?start=${isoDate(100)}` });
    const dialog = await screen.findByRole("dialog", { name: "Новая заявка на отпуск" });
    expect(within(dialog).getByLabelText("С")).toHaveValue(inputDate(100));
  });

  it("руководитель: очередь по умолчанию; согласовать и отклонить с причиной", async () => {
    loginAs("e19", "manager");
    renderWithProviders(<VacationsPage />);

    expect(await screen.findByRole("heading", { name: "На согласовании · 3" })).toBeInTheDocument();
    const queue = screen.getByRole("list", { name: "Заявки на согласовании" });
    expect(within(queue).getAllByRole("listitem")).toHaveLength(3);

    const [first] = within(queue).getAllByRole("listitem");
    await userEvent.click(within(first!).getByRole("button", { name: "Согласовать" }));
    expect(await screen.findByRole("heading", { name: "На согласовании · 2" })).toBeInTheDocument();
    expect(screen.getByText("Решены сегодня · 1")).toBeInTheDocument();

    const [next] = within(
      screen.getByRole("list", { name: "Заявки на согласовании" }),
    ).getAllByRole("listitem");
    await userEvent.click(within(next!).getByRole("button", { name: "Отклонить" }));
    const dialog = screen.getByRole("dialog", { name: "Отклонить заявку" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Отклонить" }));
    expect(within(dialog).getByText("Укажите причину — сотрудник её увидит")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Проектный срок" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Отклонить" }));
    expect(await screen.findByRole("heading", { name: "На согласовании · 1" })).toBeInTheDocument();
    expect(screen.getByText("«Проектный срок»")).toBeInTheDocument();
  });

  it("HR: «Все заявки» с фильтром; очереди нет", async () => {
    loginAs("e16", "hr");
    renderWithProviders(<VacationsPage />, { route: "/vacations?tab=all" });

    expect(await screen.findByRole("heading", { name: "Все заявки" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /На согласовании/ })).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText("Статус"), "rejected");
    await userEvent.selectOptions(screen.getByLabelText("Подразделение"), "d-hr");
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(screen.getByLabelText("Статус")).toHaveValue("");
  });
});
