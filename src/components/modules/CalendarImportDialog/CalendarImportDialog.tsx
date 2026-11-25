import { FileJson } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import Alert from "@/components/ui/Alert/Alert";
import Button from "@/components/ui/Button/Button";
import Modal from "@/components/ui/Modal/Modal";
import { buildCalendarYear, calendarChanges, indexCalendar } from "@/core/calendar";
import { useCalendarYear, useImportCalendar } from "@/hooks/useCalendar";
import { calendarSourceSchema } from "@/schemas/calendar.schema";
import type { ICalendarYearSource } from "@/types/calendar.types";
import { formatDayLong } from "@/utils/date";
import { importErrorText, yearSummary } from "@/utils/productionCalendar";

interface CalendarImportDialogProps {
  onDone: (year: number) => void;
  onClose: () => void;
}

const KIND = { workday: "рабочий", weekend: "выходной", holiday: "праздник" } as const;

const EXAMPLE = `{
  "year": 2028,
  "source": "Постановление Правительства РФ от … № …",
  "expectedWorkingDays": 247,
  "holidays": [{ "date": "2028-01-01", "note": "Новогодние каникулы" }],
  "extraDaysOff": [{ "date": "2028-01-10", "note": "Перенос с субботы" }],
  "workingWeekends": [],
  "shortened": ["2028-02-22"]
}`;

/**
 * Импорт года из JSON (формат ICalendarYearSource): файл → проверка → предпросмотр
 * «что изменится» и сводка до/после → подтверждение.
 */
const CalendarImportDialog = ({ onDone, onClose }: CalendarImportDialogProps) => {
  const [source, setSource] = useState<ICalendarYearSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const existing = useCalendarYear(source?.year ?? 0, Boolean(source));
  const mutation = useImportCalendar();

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSource(null);
    setError(null);
    if (!file) return;
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setError("Файл не похож на JSON — проверьте формат");
      return;
    }
    const parsed = calendarSourceSchema.safeParse(json);
    if (!parsed.success) {
      setError(`Файл не похож на календарь: ${importErrorText(parsed.error)}`);
      return;
    }
    setSource(parsed.data);
  };

  const built = source ? buildCalendarYear(source) : null;
  const before = existing.data;
  const changes = built && before ? calendarChanges(before, built) : [];
  const after = built ? yearSummary(indexCalendar([built]), built) : null;
  const was = before ? yearSummary(indexCalendar([before]), before) : null;
  const isChecking = Boolean(source) && existing.isLoading;

  const apply = async () => {
    if (!source) return;
    try {
      await mutation.mutateAsync(source);
      onDone(source.year);
    } catch {
      // mutation.error — в диалоге
    }
  };

  return (
    <Modal
      title="Импорт календаря"
      description="JSON в формате ICalendarYearSource"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={!source || isChecking}
            isLoading={mutation.isPending}
            onClick={() => void apply()}
          >
            {source ? `${before ? "Заменить" : "Применить"} календарь ${source.year}` : "Применить"}
          </Button>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] px-4 py-6 text-center hover:bg-[var(--color-surface-2)]">
        <FileJson className="size-6 text-[var(--color-text-muted)]" aria-hidden />
        <span className="font-medium">Выберите файл .json</span>
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          data-autofocus
          onChange={(event) => void onFile(event)}
        />
      </label>
      <button
        type="button"
        onClick={() => setShowExample((value) => !value)}
        className="self-start text-sm text-[var(--color-primary)] hover:underline"
      >
        {showExample ? "Скрыть пример" : "Пример формата"}
      </button>
      {showExample && (
        <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3 font-mono text-xs">
          {EXAMPLE}
        </pre>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {source && after && !isChecking && (
        <section className="flex flex-col gap-2" aria-label="Предпросмотр">
          <p>
            <span className="font-medium">{source.year}</span> · {source.source}
          </p>
          {before ? (
            <Alert tone="warning" title={`Календарь ${source.year} уже есть — он будет заменён`}>
              {changes.length === 0 ? "Типы дней не изменятся." : `Изменится ${changes.length} дн.`}{" "}
              Рабочих дней {was?.workingDays} → {after.workingDays}.
            </Alert>
          ) : (
            <Alert tone="info">
              Новый год: {after.workingDays} рабочих дней, {after.daysOff} выходных и праздничных.
            </Alert>
          )}
          {after.mismatch && (
            <Alert tone="warning">
              Проверьте: {after.workingDays} рабочих дней, по постановлению — {after.expected}.
            </Alert>
          )}
          {changes.length > 0 && (
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
              {changes.map((change) => (
                <li key={change.date}>
                  {formatDayLong(change.date)}: {KIND[change.before.kind]}
                  {change.before.isShortened && " (сокр.)"} → {KIND[change.after.kind]}
                  {change.after.isShortened && " (сокр.)"}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {mutation.error && <Alert tone="danger">{mutation.error.message}</Alert>}
    </Modal>
  );
};

export default CalendarImportDialog;
