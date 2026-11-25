import { Menu, Monitor, Moon, Search, Sun, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import EmployeeSearch from "@/components/modules/EmployeeSearch/EmployeeSearch";
import Button from "@/components/ui/Button/Button";
import { findNavItem } from "@/constants/navigation";
import { useUiStore, type Theme } from "@/store/ui.store";

const NEXT_THEME: Record<Theme, { next: Theme; label: string; icon: typeof Sun }> = {
  system: { next: "light", label: "Тема: системная", icon: Monitor },
  light: { next: "dark", label: "Тема: светлая", icon: Sun },
  dark: { next: "system", label: "Тема: тёмная", icon: Moon },
};

interface TopbarProps {
  onOpenMenu: () => void;
}

/**
 * Верхняя панель: поиск сотрудника и тема. На мобильном — бургер, название раздела
 * и поиск по иконке. Заголовок страницы — в контенте, не здесь.
 */
const Topbar = ({ onOpenMenu }: TopbarProps) => {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const section = findNavItem(pathname);
  const { next, label, icon: ThemeIcon } = NEXT_THEME[theme];

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 backdrop-blur md:px-6">
      {searchOpen ? (
        <div className="flex flex-1 items-center gap-2 md:hidden">
          <EmployeeSearch autoFocus onDone={() => setSearchOpen(false)} className="max-w-none" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Закрыть поиск"
            onClick={() => setSearchOpen(false)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Открыть меню"
            onClick={onOpenMenu}
            className="md:hidden"
          >
            <Menu aria-hidden />
          </Button>
          <p className="flex-1 truncate font-medium md:hidden">{section?.label ?? "Доступность"}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Найти сотрудника"
            onClick={() => setSearchOpen(true)}
            className="md:hidden"
          >
            <Search aria-hidden />
          </Button>
        </>
      )}

      <EmployeeSearch className="hidden md:block" />
      <div className="hidden flex-1 md:block" />

      <Button
        variant="ghost"
        size="icon"
        aria-label={`${label}. Переключить`}
        title={label}
        onClick={() => setTheme(next)}
        className={searchOpen ? "max-md:hidden" : undefined}
      >
        <ThemeIcon aria-hidden />
      </Button>
    </header>
  );
};

export default Topbar;
