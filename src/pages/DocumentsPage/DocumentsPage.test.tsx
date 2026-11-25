import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_TOKEN } from "@/constants/mock";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import DocumentsPage from "./DocumentsPage";

const renderPage = (route = "/documents") =>
  renderWithProviders(
    <Routes>
      <Route path={ROUTES.DOCUMENTS} element={<DocumentsPage />} />
      <Route path={ROUTES.DOCUMENT} element={<p>Карточка документа</p>} />
    </Routes>,
    { route },
  );

describe("DocumentsPage", () => {
  beforeEach(() =>
    useAuthStore
      .getState()
      .setAuth(MOCK_TOKEN, { id: "e21", name: "Демо", position: "—", role: "employee" }),
  );

  it("мои документы: статус, у кого сейчас, риск, дата решения", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Документы" });
    const row = within(table)
      .getByText(/Договор поставки/)
      .closest("tr")!;
    expect(row).toHaveTextContent("этап 1 из 3");
    expect(row).toHaveTextContent("Громов Павел Олегович");
    expect(row).toHaveTextContent("Риск срока");
    expect(
      within(table)
        .getByText(/Счёт на продление/)
        .closest("tr"),
    ).toHaveTextContent(/Согласован \d+/);
  });

  it("пустая вкладка предлагает показать все документы", async () => {
    renderPage("/documents?tab=waiting");
    expect(await screen.findByText("Вашего решения ничего не ждёт")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Показать все документы" }));
    expect(await screen.findByRole("table", { name: "Документы" })).toHaveTextContent(
      "Приказ о премировании",
    );
    expect(screen.getByRole("radio", { name: "Все" })).toBeChecked();
  });

  it("фильтры и пусто", async () => {
    renderPage("/documents?tab=waiting");
    expect(await screen.findByText("Вашего решения ничего не ждёт")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Все" }));
    await userEvent.type(screen.getByLabelText("Номер или название"), "zzz");
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
  });

  it("новый документ — черновик, переход в карточку", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Документы" });
    await userEvent.click(screen.getByRole("button", { name: "Новый документ" }));
    const dialog = screen.getByRole("dialog", { name: "Новый документ" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Создать черновик" }));
    expect(within(dialog).getByText("Укажите название")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Название"), "Приказ о дежурствах");
    await userEvent.click(within(dialog).getByRole("button", { name: "Создать черновик" }));
    expect(await screen.findByText("Карточка документа")).toBeInTheDocument();
  });
});
