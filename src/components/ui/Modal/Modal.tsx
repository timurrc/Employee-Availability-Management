import { X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const PLACEMENTS = {
  /** Шит справа 480 px, на мобильном — во весь экран */
  right:
    "inset-y-0 right-0 w-full max-w-full sm:w-[480px] sm:rounded-l-[var(--radius-lg)] flex flex-col",
  /** Диалог по центру: подтверждение, причина отказа */
  center:
    "top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] flex flex-col max-h-[calc(100dvh-2rem)]",
} as const;

interface ModalProps {
  title: string;
  /** Закрытие по Esc, крестику и клику по подложке — решает вызывающий (например, спросить про черновик) */
  onClose: () => void;
  children: ReactNode;
  /** Кнопки внизу — прилипают к низу шита */
  footer?: ReactNode;
  placement?: keyof typeof PLACEMENTS;
  /** Подзаголовок под названием */
  description?: ReactNode;
  className?: string;
}

/**
 * Модальное окно: шит справа или диалог по центру. Ловушка фокуса, Esc, подложка,
 * после закрытия фокус возвращается туда, откуда открыли. Рендерится в body.
 * Вложенный диалог (подтверждение поверх шита) сам гасит свой Esc.
 */
const Modal = ({
  title,
  onClose,
  children,
  footer,
  placement = "center",
  description,
  className,
}: ModalProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first =
      ref.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? ref.current)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <div
        className="absolute inset-0 bg-[var(--color-overlay)]"
        aria-hidden
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute bg-[var(--color-elevated)] shadow-[var(--shadow-modal)] outline-none",
          PLACEMENTS[placement],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 id={titleId} className="text-md font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-[var(--color-text-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Закрыть"
            className="-m-1 cursor-pointer rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
