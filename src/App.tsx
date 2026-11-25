import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import MainLayout from "@/components/layouts/MainLayout/MainLayout";
import ProtectedRoute from "@/components/layouts/ProtectedRoute/ProtectedRoute";
import { ROUTES } from "@/constants/routes";

// Каждая страница — отдельный чанк, грузится при переходе. Suspense — в MainLayout.
const HomePage = lazy(() => import("@/pages/HomePage/HomePage"));
const LoginPage = lazy(() => import("@/pages/LoginPage/LoginPage"));
const TeamPage = lazy(() => import("@/pages/TeamPage/TeamPage"));
const VacationsPage = lazy(() => import("@/pages/VacationsPage/VacationsPage"));
const SickLeavesPage = lazy(() => import("@/pages/SickLeavesPage/SickLeavesPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage/CalendarPage"));
const EmployeePage = lazy(() => import("@/pages/EmployeePage/EmployeePage"));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage/DocumentsPage"));
const DocumentPage = lazy(() => import("@/pages/DocumentPage/DocumentPage"));
const DeadlinesPage = lazy(() => import("@/pages/DeadlinesPage/DeadlinesPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage/NotFoundPage"));

const App = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route element={<ProtectedRoute mode="guest" />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.TEAM} element={<TeamPage />} />
          <Route path={ROUTES.VACATIONS} element={<VacationsPage />} />
          <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
          <Route path={ROUTES.EMPLOYEE} element={<EmployeePage />} />
          <Route path={ROUTES.DOCUMENTS} element={<DocumentsPage />} />
          <Route path={ROUTES.DOCUMENT} element={<DocumentPage />} />
          <Route path={ROUTES.DEADLINES} element={<DeadlinesPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={["hr", "admin"]} />}>
          <Route path={ROUTES.SICK_LEAVES} element={<SickLeavesPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default App;
