import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_TOKEN } from "@/constants/mock";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import LoginPage from "./LoginPage";

const renderLogin = () =>
  renderWithProviders(
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.TEAM} element={<p>team</p>} />
    </Routes>,
    { route: { pathname: ROUTES.LOGIN, state: { from: ROUTES.TEAM } } },
  );

describe("LoginPage", () => {
  beforeEach(() => useAuthStore.getState().logout());

  it("показывает учётную запись для каждой роли с ФИО из справочника", async () => {
    renderLogin();
    expect(
      await screen.findByRole("button", { name: "Руководитель: Кузнецов Дмитрий Александрович" }),
    ).toBeEnabled();
    for (const label of ["Сотрудник", "Кадровик", "Администратор"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("вход под руководителем сохраняет роль и ведёт на state.from", async () => {
    renderLogin();
    const manager = await screen.findByRole("button", { name: /Руководитель: Кузнецов/ });
    await userEvent.click(manager);

    expect(await screen.findByText("team")).toBeInTheDocument();
    const { token, user } = useAuthStore.getState();
    expect(token).toBe(MOCK_TOKEN);
    expect(user).toMatchObject({ id: "e19", role: "manager" });
  });
});
