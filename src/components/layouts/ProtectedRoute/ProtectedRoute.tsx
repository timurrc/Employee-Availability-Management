import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { selectIsAuth, useAuthStore } from "@/store/auth.store";
import type { Role } from "@/types/employee.types";

interface ProtectedRouteProps {
  /** guest — только для неавторизованных (вход) */
  mode?: "private" | "guest";
  /** Доступ только этим ролям; остальных уводит на главную */
  roles?: Role[];
}

/**
 * Обёртка для группы роутов.
 * private: нет токена → /login, после входа вернёт на исходную страницу с query (state.from).
 * guest:   есть токен → на главную.
 * roles:   роль пользователя не из списка → на главную.
 */
const ProtectedRoute = ({ mode = "private", roles }: ProtectedRouteProps) => {
  const isAuth = useAuthStore(selectIsAuth);
  const role = useAuthStore((state) => state.user?.role);
  const location = useLocation();

  if (mode === "private" && !isAuth) {
    // Вместе с query: фильтры и вкладки из ссылки (?tab=all, ?dept=…) переживают вход
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (mode === "guest" && isAuth) {
    // Сразу после входа guard срабатывает раньше navigate() в хуке —
    // поэтому сам уводит туда, откуда пользователя отправили на /login
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? ROUTES.HOME} replace />;
  }

  if (roles && (!role || !roles.includes(role))) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
