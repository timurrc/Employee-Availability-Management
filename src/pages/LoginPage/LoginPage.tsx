import { ArrowRight, LoaderCircle } from "lucide-react";
import { useLoginPage } from "./useLoginPage";

const LoginPage = () => {
  const { accounts, onSelect, pendingId } = useLoginPage();

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium">Вход в демо</h1>
        <p className="text-[var(--color-muted)]">
          Выберите роль — у каждой свой набор разделов. Сменить роль можно в шапке.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {accounts.map(({ employeeId, label, hint }) => (
          <li key={employeeId}>
            <button
              type="button"
              onClick={() => onSelect(employeeId)}
              disabled={Boolean(pendingId)}
              className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4 text-left transition-colors hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex flex-col gap-1">
                <span className="font-medium">{label}</span>
                <span className="text-sm text-[var(--color-muted)]">{hint}</span>
              </span>
              {pendingId === employeeId ? (
                <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="size-5 shrink-0 text-[var(--color-muted)]" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default LoginPage;
