import { CalendarCheck2, LogOut } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { canSee, NAV_ITEMS } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { selectIsAuth, useAuthStore } from "@/store/auth.store";
import { cn } from "@/utils/cn";
import Container from "@/components/layouts/Container/Container";
import AccountSwitcher from "@/components/modules/AccountSwitcher/AccountSwitcher";
import Button from "@/components/ui/Button/Button";

// Временная шапка этапа 0. Боковая навигация и итоговый вид — этап 2 (см. дизайн-долг).
const Header = () => {
  const isAuth = useAuthStore(selectIsAuth);
  const role = useAuthStore((state) => state.user?.role);
  const logout = useAuthStore((state) => state.logout);

  const items = NAV_ITEMS.filter((item) => canSee(item, role));

  return (
    <header className="border-b border-[var(--color-border)]">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to={ROUTES.HOME} className="flex shrink-0 items-center gap-2 font-medium">
          <CalendarCheck2 className="size-5 text-[var(--color-primary)]" aria-hidden />
          <span className="hidden md:inline">Доступность</span>
        </Link>

        {isAuth && (
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto" aria-label="Разделы">
            {items.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]",
                    isActive && "bg-[var(--color-surface)] text-[var(--color-text)]",
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        {isAuth && (
          <div className="flex shrink-0 items-center gap-2">
            <AccountSwitcher />
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Выйти">
              <LogOut className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </Container>
    </header>
  );
};

export default Header;
