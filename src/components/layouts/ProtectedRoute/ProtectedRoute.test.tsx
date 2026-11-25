import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import ProtectedRoute from "./ProtectedRoute";

const renderRoutes = () =>
  renderWithProviders(
    <Routes>
      <Route path={ROUTES.LOGIN} element={<p>login</p>} />
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.TEAM} element={<p>team</p>} />
      </Route>
    </Routes>,
    { route: ROUTES.TEAM },
  );

describe("ProtectedRoute", () => {
  beforeEach(() => useAuthStore.getState().logout());

  it("без токена уводит на логин", () => {
    renderRoutes();
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("гостевой роут после входа уводит на state.from", () => {
    useAuthStore.getState().setToken("token");
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute mode="guest" />}>
          <Route path={ROUTES.LOGIN} element={<p>login</p>} />
        </Route>
        <Route path={ROUTES.TEAM} element={<p>team</p>} />
      </Routes>,
      { route: { pathname: ROUTES.LOGIN, state: { from: ROUTES.TEAM } } },
    );
    expect(screen.getByText("team")).toBeInTheDocument();
  });

  it("с токеном пускает на страницу", () => {
    useAuthStore.getState().setToken("token");
    renderRoutes();
    expect(screen.getByText("team")).toBeInTheDocument();
  });

  it("роль не из списка уводит на главную", () => {
    useAuthStore
      .getState()
      .setAuth("token", { id: "e21", name: "Demo", position: "Разработчик", role: "employee" });
    renderWithProviders(
      <Routes>
        <Route path={ROUTES.HOME} element={<p>home</p>} />
        <Route element={<ProtectedRoute roles={["hr"]} />}>
          <Route path={ROUTES.SICK_LEAVES} element={<p>sick</p>} />
        </Route>
      </Routes>,
      { route: ROUTES.SICK_LEAVES },
    );
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
