import {
  Check,
  ChevronsUpDown,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Avatar from "@/components/ui/Avatar/Avatar";
import { ROLE_LABELS } from "@/constants/roles";
import type { Theme } from "@/store/ui.store";
import { cn } from "@/utils/cn";
import { useAccountSwitcher } from "./useAccountSwitcher";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Системная", icon: Monitor },
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
];

interface AccountSwitcherProps {
  /** Только аватар (сайдбар свёрнут) */
  compact?: boolean;
  /** Только аватар на планшете (сайдбар-колонка) */
  compactOnTablet?: boolean;
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left outline-none hover:bg-[var(--color-surface-2)] focus-visible:bg-[var(--color-surface-2)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Учётная запись внизу сайдбара. Меню: демо-учётки (смена роли без перезагрузки),
 * тема, сброс демо-данных, выход.
 */
const AccountSwitcher = ({ compact = false, compactOnTablet = false }: AccountSwitcherProps) => {
  const { user, accounts, switchTo, pendingId, theme, setTheme, resetDemo, isResetting, logout } =
    useAccountSwitcher();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isBusy = Boolean(pendingId) || isResetting;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (!user) return null;

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") return close();
    if (event.key === "Tab") return setOpen(false);
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ??
        []),
    ];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  const roleLabel = ROLE_LABELS[user.role];
  const hideText = cn(compact ? "hidden" : compactOnTablet && "md:max-xl:hidden");

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Учётная запись: ${user.name}, ${roleLabel}`}
        title={compact ? `${user.name} · ${roleLabel}` : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] p-1.5 text-left hover:bg-[var(--color-surface-2)]",
          (compact || compactOnTablet) && (compact ? "justify-center" : "md:max-xl:justify-center"),
        )}
      >
        {pendingId ? (
          <LoaderCircle
            className="size-8 shrink-0 animate-spin p-1.5 text-[var(--color-primary)]"
            aria-hidden
          />
        ) : (
          <Avatar name={user.name} size="md" />
        )}
        <span className={cn("flex min-w-0 flex-1 flex-col", hideText)}>
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-sm text-[var(--color-text-muted)]">
            {roleLabel} · демо
          </span>
        </span>
        <ChevronsUpDown
          className={cn("size-4 shrink-0 text-[var(--color-text-subtle)]", hideText)}
          aria-hidden
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Учётная запись"
          onKeyDown={onMenuKey}
          className="absolute bottom-full left-0 z-50 mb-2 flex w-72 flex-col gap-0.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-1.5 shadow-[var(--shadow-pop)]"
        >
          <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-[var(--color-text-subtle)] uppercase">
            Демо: войти как
          </p>
          {accounts.map((account) => {
            const isCurrent = account.employeeId === user.id;
            return (
              <button
                key={account.employeeId}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                disabled={isBusy}
                onClick={() => {
                  switchTo(account.employeeId);
                  close();
                }}
                className={itemClass}
              >
                {pendingId === account.employeeId ? (
                  <LoaderCircle className="size-6 shrink-0 animate-spin p-1" aria-hidden />
                ) : (
                  <Avatar name={account.name ?? account.label} size="sm" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{account.label}</span>
                  {account.name && (
                    <span className="truncate text-sm text-[var(--color-text-muted)]">
                      {account.name}
                    </span>
                  )}
                </span>
                {isCurrent && <Check className="size-4 text-[var(--color-primary)]" aria-hidden />}
              </button>
            );
          })}

          <hr className="my-1 border-[var(--color-border)]" />
          <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-[var(--color-text-subtle)] uppercase">
            Тема
          </p>
          <div role="group" aria-label="Тема" className="flex flex-col gap-0.5">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={itemClass}
              >
                <Icon className="size-4 text-[var(--color-text-muted)]" aria-hidden />
                <span className="flex-1">{label}</span>
                {theme === value && (
                  <Check className="size-4 text-[var(--color-primary)]" aria-hidden />
                )}
              </button>
            ))}
          </div>

          <hr className="my-1 border-[var(--color-border)]" />
          <button
            type="button"
            role="menuitem"
            disabled={isBusy}
            onClick={() => {
              resetDemo();
              close();
            }}
            className={itemClass}
          >
            <RotateCcw className="size-4 text-[var(--color-text-muted)]" aria-hidden />
            Сбросить демо-данные
          </button>
          <button type="button" role="menuitem" onClick={logout} className={itemClass}>
            <LogOut className="size-4 text-[var(--color-text-muted)]" aria-hidden />
            Выйти
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountSwitcher;
