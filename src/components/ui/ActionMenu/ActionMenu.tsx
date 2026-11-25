import { Ellipsis } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/utils/cn";

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  /** Красным — только удаление */
  danger?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** «Действия с заявкой 15 февр. – 1 мар.» */
  label: string;
  className?: string;
}

/** Меню «…» у строки: стрелки, Home/End, Esc и клик мимо закрывают, фокус возвращается на кнопку */
const ActionMenu = ({ items, label, className }: ActionMenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      return close();
    }
    if (event.key === "Tab") return setOpen(false);
    const list = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next = {
      ArrowDown: list[(index + 1) % list.length],
      ArrowUp: list[(index - 1 + list.length) % list.length],
      Home: list[0],
      End: list.at(-1),
    }[event.key];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      >
        <Ellipsis className="size-4" aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-20 mt-1 flex min-w-44 flex-col rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-1 shadow-[var(--shadow-pop)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className={cn(
                "h-8 cursor-pointer rounded-[var(--radius-sm)] px-2.5 text-left whitespace-nowrap hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface-2)] focus:outline-none",
                item.danger && "text-[var(--color-danger)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionMenu;
