import { CalendarCheck, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import AccountSwitcher from "@/components/modules/AccountSwitcher/AccountSwitcher";
import { canSee, findNavItem, NAV_GROUPS, NAV_ITEMS } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";
import { cn } from "@/utils/cn";

interface SidebarProps {
  /**
   * responsive — колонка каркаса: на планшете иконки, на ≥ 1280 — по выбору пользователя;
   * drawer — мобильная панель, всегда развёрнута
   */
  mode?: "responsive" | "drawer";
  onNavigate?: () => void;
}

/** Боковая навигация по группам задач + учётная запись внизу — docs/design/screens/00 */
const Sidebar = ({ mode = "responsive", onNavigate }: SidebarProps) => {
  const role = useAuthStore((state) => state.user?.role);
  const collapsedByUser = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const { pathname } = useLocation();
  const activeItem = findNavItem(pathname);

  const isDrawer = mode === "drawer";
  const collapsed = !isDrawer && collapsedByUser;
  /** Подписи скрыты: всегда при свёрнутом, на планшете — в режиме колонки */
  const hideLabel = cn(collapsed ? "sr-only" : !isDrawer && "md:max-xl:sr-only");

  return (
    <div className="flex h-full flex-col gap-2 bg-[var(--color-surface)]">
      <Link
        to={ROUTES.HOME}
        onClick={onNavigate}
        className={cn(
          "flex h-[var(--topbar-h)] shrink-0 items-center gap-2 px-5 text-md font-semibold",
          !isDrawer && "md:max-xl:justify-center md:max-xl:px-0",
          collapsed && "justify-center px-0",
        )}
      >
        <CalendarCheck className="size-6 shrink-0 text-[var(--color-primary)]" aria-hidden />
        <span className={hideLabel}>Доступность</span>
      </Link>

      <nav aria-label="Разделы" className="flex flex-1 flex-col gap-4 overflow-y-auto px-3">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.id && canSee(item, role));
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="flex flex-col gap-0.5">
              <p
                className={cn(
                  "px-2 pt-2 pb-1 text-xs font-medium tracking-wide text-[var(--color-text-subtle)] uppercase",
                  hideLabel,
                )}
              >
                {group.label}
              </p>
              {items.map(({ label, to, icon: Icon }) => {
                const isActive = activeItem?.to === to;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onNavigate}
                    title={collapsed || !isDrawer ? label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-[var(--radius-md)] px-2 text-base text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
                      isActive &&
                        "bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]",
                      !isDrawer && "md:max-xl:justify-center",
                      collapsed && "justify-center",
                    )}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className={hideLabel}>{label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-[var(--color-border)] p-3">
        <AccountSwitcher compact={collapsed} compactOnTablet={!isDrawer} />
        {!isDrawer && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
            className={cn(
              "hidden h-8 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] xl:flex",
              collapsed && "justify-center",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
            <span className={cn(collapsed && "sr-only")}>
              {collapsed ? "Развернуть" : "Свернуть"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
