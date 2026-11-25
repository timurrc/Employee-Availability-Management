import { Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Outlet, useLocation } from "react-router-dom";
import Container from "@/components/layouts/Container/Container";
import Sidebar from "@/components/modules/Sidebar/Sidebar";
import Topbar from "@/components/modules/Topbar/Topbar";
import ErrorFallback from "@/components/ui/ErrorFallback/ErrorFallback";
import PageLoader from "@/components/ui/PageLoader/PageLoader";
import { selectIsAuth, useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";
import { cn } from "@/utils/cn";

const Page = ({ pathname }: { pathname: string }) => (
  <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[pathname]}>
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  </ErrorBoundary>
);

/**
 * Каркас: сайдбар (≥ 768) или выезжающая панель (< 768) + топбар + контент в Container.
 * Гость (экран входа) — без навигации. ErrorBoundary ловит падение страницы и
 * сбрасывается при смене роута; Suspense показывает скелетон lazy-страницы.
 */
const MainLayout = () => {
  const { pathname } = useLocation();
  const isAuth = useAuthStore(selectIsAuth);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Переход по ссылке закрывает мобильную панель
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (!isAuth) {
    return (
      <main className="min-h-svh py-12 md:py-20">
        <Container>
          <Page pathname={pathname} />
        </Container>
      </main>
    );
  }

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 border-r border-[var(--color-border)] md:block md:w-[var(--sidebar-w-collapsed)]",
          collapsed ? "xl:w-[var(--sidebar-w-collapsed)]" : "xl:w-[var(--sidebar-w)]",
        )}
      >
        <Sidebar />
      </aside>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Меню"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-80 border-r border-[var(--color-border)] shadow-[var(--shadow-modal)]">
            <Sidebar mode="drawer" onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 py-4 md:py-6">
          <Container>
            <Page pathname={pathname} />
          </Container>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
