import { ArrowRight, CalendarCheck, ExternalLink, LoaderCircle } from "lucide-react";
import Avatar from "@/components/ui/Avatar/Avatar";
import Badge from "@/components/ui/Badge/Badge";
import Skeleton from "@/components/ui/Skeleton/Skeleton";
import { REPO_URL } from "@/constants/links";
import { useLoginPage } from "./useLoginPage";

const LoginPage = () => {
  const { accounts, isLoading, onSelect, pendingId } = useLoginPage();

  return (
    <section className="mx-auto flex max-w-[480px] flex-col gap-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="flex items-center gap-2 text-md font-semibold">
          <CalendarCheck className="size-6 text-[var(--color-primary)]" aria-hidden />
          Доступность
        </p>
        <h1 className="text-xl font-semibold tracking-[-0.01em]">
          Модуль доступности сотрудников для СЭД
        </h1>
        <p className="text-[var(--color-text-muted)]">
          Демо: данные вымышленные и хранятся в этом браузере.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)]">Войти как</h2>
        <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)]">
          {accounts.map(({ employeeId, label, hint, name, position }) => (
            <li key={employeeId} className="border-b border-[var(--color-border)] last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(employeeId)}
                disabled={Boolean(pendingId) || isLoading}
                aria-describedby={`login-hint-${employeeId}`}
                className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {name ? (
                  <Avatar name={name} size="lg" />
                ) : (
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {/* Имя кнопки — из видимого текста (WCAG 2.5.3): «Руководитель: ФИО · должность» */}
                  <span className="sr-only">{label}: </span>
                  {name ? (
                    <span className="truncate font-medium">
                      {name}
                      <span className="font-normal text-[var(--color-text-muted)]">
                        {" "}
                        · {position}
                      </span>
                    </span>
                  ) : (
                    <Skeleton className="h-4 w-48" />
                  )}
                  <span
                    id={`login-hint-${employeeId}`}
                    className="text-sm text-[var(--color-text-muted)]"
                    aria-hidden
                  >
                    {hint}
                  </span>
                </span>
                <Badge tone="neutral" className="hidden sm:inline-flex" aria-hidden>
                  {label}
                </Badge>
                {pendingId === employeeId ? (
                  <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <ArrowRight
                    className="size-4 shrink-0 text-[var(--color-text-subtle)]"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <footer className="flex flex-col gap-2 text-sm text-[var(--color-text-muted)]">
        <p>
          С чего начать: войдите сотрудником и откройте «Документы» — в договоре юрист в отпуске,
          этап можно передать заместителю.
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 self-start text-[var(--color-primary)] hover:underline"
        >
          Как устроено — README
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </footer>
    </section>
  );
};

export default LoginPage;
