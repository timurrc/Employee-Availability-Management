import { Search, SearchX } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import { buildPath, ROUTES } from "@/constants/routes";
import { useAvailability } from "@/hooks/useAvailability";
import { useDebounce } from "@/hooks/useDebounce";
import type { IEmployee } from "@/types/employee.types";
import { cn } from "@/utils/cn";
import { matchesQuery } from "@/utils/text";

const LIMIT = 8;

interface EmployeeSearchProps {
  /** Фокус сразу после появления (мобильный поиск по иконке) */
  autoFocus?: boolean;
  onDone?: () => void;
  className?: string;
}

/**
 * Глобальный поиск сотрудника (⌘K / Ctrl+K): результаты со статусом на сегодня,
 * Enter — карточка сотрудника. Комбобокс по ARIA 1.2.
 */
const EmployeeSearch = ({ autoFocus, onDone, className }: EmployeeSearchProps) => {
  const { employees, statusOf, employeeById, isLoading } = useAvailability();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(query, 150);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const navigate = useNavigate();

  const results = useMemo(
    () =>
      debounced.trim()
        ? employees
            .filter((e) => matchesQuery(`${e.fullName} ${e.position}`, debounced))
            .slice(0, LIMIT)
        : [],
    [employees, debounced],
  );

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (employee: IEmployee) => {
    navigate(buildPath(ROUTES.EMPLOYEE, { id: employee.id }));
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onDone?.();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (query) setQuery("");
      else onDone?.();
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const shift = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + shift + results.length) % results.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = results[active];
      if (target) go(target);
    }
  };

  const showList = open && debounced.trim().length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-subtle)]"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        autoFocus={autoFocus}
        aria-label="Найти сотрудника"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results.length ? optionId(active) : undefined}
        placeholder="Найти сотрудника…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pr-14 pl-9 outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-focus)] [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 text-xs text-[var(--color-text-subtle)] md:block">
        ⌘K
      </kbd>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Сотрудники"
          className="absolute top-full z-50 mt-1 flex max-h-96 w-full flex-col overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-1 shadow-[var(--shadow-pop)]"
        >
          {results.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-3 text-[var(--color-text-muted)]">
              <SearchX className="size-4" aria-hidden />
              {isLoading ? "Загружаем сотрудников…" : "Никого не нашли — проверьте написание"}
            </li>
          ) : (
            results.map((employee, index) => {
              const status = statusOf(employee.id);
              const deputyId = status.deputy.actorId;
              return (
                <li
                  key={employee.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  // mousedown, а не click: иначе blur инпута закроет список раньше
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(employee);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "cursor-pointer rounded-[var(--radius-md)] px-2 py-1.5",
                    index === active && "bg-[var(--color-surface-2)]",
                  )}
                >
                  <PersonChip
                    person={employee}
                    status={status}
                    deputy={deputyId && deputyId !== employee.id ? employeeById(deputyId) : null}
                    noLink
                  />
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};

export default EmployeeSearch;
