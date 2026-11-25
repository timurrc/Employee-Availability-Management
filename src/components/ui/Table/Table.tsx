import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Значение для сортировки; не задано — колонка не сортируется */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Подпись для скринридеров: «Заявки на отпуск» */
  caption: string;
  onRowClick?: (row: T) => void;
  /** Что показать вместо пустой таблицы (EmptyState) */
  empty?: ReactNode;
  /** Карточка строки для экранов < 768 px; без неё таблица скроллится по горизонтали */
  renderCard?: (row: T) => ReactNode;
  initialSort?: { key: string; direction: "asc" | "desc" };
  className?: string;
}

type Sort = { key: string; direction: "asc" | "desc" } | null;

/**
 * Таблица: sticky-заголовок, строка 40 px, сортировка по клику на заголовок.
 * Действия строки кладутся в последнюю колонку и видны всегда — не только по hover.
 */
const Table = <T,>({
  columns,
  rows,
  getRowId,
  caption,
  onRowClick,
  empty,
  renderCard,
  initialSort,
  className,
}: TableProps<T>) => {
  const [sort, setSort] = useState<Sort>(initialSort ?? null);

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !column?.sortValue) return rows;
    const value = column.sortValue;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      return (x < y ? -1 : x > y ? 1 : 0) * factor;
    });
  }, [rows, columns, sort]);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={className}>
      {renderCard && (
        <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
          {sorted.map((row) => (
            <li key={getRowId(row)}>{renderCard(row)}</li>
          ))}
        </ul>
      )}
      <div className={cn("overflow-x-auto", renderCard && "hidden md:block")}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-[var(--color-elevated)]">
            <tr className="border-b border-[var(--color-border)]">
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const SortIcon = !active
                  ? ChevronsUpDown
                  : sort.direction === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={cn(
                      "h-10 px-3 font-medium whitespace-nowrap text-[var(--color-text-muted)]",
                      column.align === "right" ? "text-right" : "text-left",
                      column.className,
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-[var(--color-text)]"
                      >
                        {column.header}
                        <SortIcon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "h-10 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)]",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-1.5",
                      column.align === "right" && "text-right",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;
