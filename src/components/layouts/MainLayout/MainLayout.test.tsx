import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import ProtectedRoute from "@/components/layouts/ProtectedRoute/ProtectedRoute";
import { MOCK_TOKEN } from "@/constants/mock";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import MainLayout from "./MainLayout";

const loginAs = (id: string, role: "employee" | "hr") =>
  useAuthStore
    .getState()
    .setAuth(MOCK_TOKEN, { id, name: "Демо Пользователь", position: "—", role });

const renderApp = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route element={<MainLayout />}>
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.HOME} element={<h1>Сегодня</h1>} />
          <Route path={ROUTES.EMPLOYEE} element={<h1>Карточка</h1>} />
        </Route>
        <Route element={<ProtectedRoute roles={["hr", "admin"]} />}>
          <Route path={ROUTES.SICK_LEAVES} element={<h1>Больничные</h1>} />
        </Route>
      </Route>
    </Routes>,
    { route },
  );

describe("MainLayout", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useUiStore.setState({ theme: "system", sidebarCollapsed: false });
  });

  it("навигация по группам, разделы чужой роли не показываются", () => {
    loginAs("e21", "employee");
    renderApp(ROUTES.HOME);
    const nav = screen.getAllByRole("navigation", { name: "Разделы" })[0]!;
    expect(within(nav).getByText("Работа")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Сегодня" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).queryByRole("link", { name: "Больничные" })).not.toBeInTheDocument();
  });

  it("смена роли: раздел недоступен новой роли — уводит на «Сегодня»", async () => {
    loginAs("e16", "hr");
    renderApp(ROUTES.SICK_LEAVES);
    expect(screen.getByRole("heading", { name: "Больничные" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Учётная запись/ }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /Сотрудник/ }));

    expect(await screen.findByRole("heading", { name: "Сегодня" })).toBeInTheDocument();
    await waitFor(() => expect(useAuthStore.getState().user?.role).toBe("employee"));
  });

  it("тема выбирается в меню учётной записи", async () => {
    loginAs("e21", "employee");
    renderApp(ROUTES.HOME);
    await userEvent.click(screen.getByRole("button", { name: /Учётная запись/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Тёмная" }));
    expect(useUiStore.getState().theme).toBe("dark");
  });

  it("меню закрывается по Esc и возвращает фокус", async () => {
    loginAs("e21", "employee");
    renderApp(ROUTES.HOME);
    const trigger = screen.getByRole("button", { name: /Учётная запись/ });
    await userEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("поиск сотрудника: статус на сегодня и переход в карточку по Enter", async () => {
    loginAs("e21", "employee");
    renderApp(ROUTES.HOME);
    const search = screen.getAllByRole("combobox", { name: "Найти сотрудника" })[0]!;
    await userEvent.type(search, "кузнецов");
    const option = await screen.findByRole("option", { name: /Кузнецов Дмитрий/ });
    expect(option).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Карточка" })).toBeInTheDocument();
  });

  it("гость видит страницу без навигации", () => {
    renderWithProviders(
      <Routes>
        <Route element={<MainLayout />}>
          <Route path={ROUTES.LOGIN} element={<h1>Вход</h1>} />
        </Route>
      </Routes>,
      { route: ROUTES.LOGIN },
    );
    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
