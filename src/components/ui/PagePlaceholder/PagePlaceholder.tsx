import { Construction } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  description: string;
  /** Этап плана, на котором появится экран */
  stage: number;
}

/** Временная заглушка экрана до его этапа. Удаляется, когда экран сверстан. */
const PagePlaceholder = ({ title, description, stage }: PagePlaceholderProps) => {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-medium">{title}</h1>
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--color-border)] p-6 text-[var(--color-muted)]">
        <Construction className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p>{description}</p>
          <p className="text-sm">Экран появится на этапе {stage}.</p>
        </div>
      </div>
    </section>
  );
};

export default PagePlaceholder;
