import { screen, waitFor, within } from "@testing-library/react";
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

  it("HR меняет постоянного заместителя: вариант с циклом недоступен", async () => {
    useAuthStore
      .getState()
      .setAuth(MOCK_TOKEN, { id: "e16", name: "Демо", position: "—", role: "hr" });
    renderAt("e05");
    await userEvent.click(await screen.findByRole("button", { name: "Изменить" }));
    const dialog = screen.getByRole("dialog", { name: "Постоянный заместитель" });
    const cycle = within(dialog).getByRole("option", {
      name: /создаст цикл: Громов П\. → Никитина О\./,
    });
    expect(cycle).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByLabelText("Заместитель"), "e08");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Постоянный заместитель:").parentElement).toHaveTextContent("Орлов");
  });

  it("назначить замещение на период и снять его", async () => {
    useAuthStore
      .getState()
      .setAuth(MOCK_TOKEN, { id: "e16", name: "Демо", position: "—", role: "hr" });
    renderAt("e05");
    await userEvent.click(await screen.findByRole("button", { name: "Назначить на период" }));
    const dialog = screen.getByRole("dialog", { name: "Назначить замещение на период" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Назначить" }));
    expect(within(dialog).getByText("Выберите, кто замещает")).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText("Кто замещает"), "e08");
    await userEvent.click(within(dialog).getByRole("button", { name: "Назначить" }));
    const list = await screen.findByRole("list", { name: "Замещения на период" });
    expect(list).toHaveTextContent(/замещает Орлов К\./);
    expect(screen.getByText("Замещает:")).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: "Снять" }));
    await waitFor(() =>
      expect(screen.queryByRole("list", { name: "Замещения на период" })).toBeNull(),
    );
  });

  it("сотрудник без прав не видит «Изменить» у чужой карточки", async () => {
    useAuthStore
      .getState()
      .setAuth(MOCK_TOKEN, { id: "e21", name: "Демо", position: "—", role: "employee" });
    renderAt("e05");
    await screen.findByRole("heading", { name: "Никитина Ольга Игоревна" });
    expect(screen.queryByRole("button", { name: "Изменить" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Назначить на период" })).toBeNull();
  });
});
