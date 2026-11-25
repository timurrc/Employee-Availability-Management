import { Construction } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState/EmptyState";

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
      <h1 className="text-xl font-semibold tracking-[-0.01em]">{title}</h1>
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-elevated)]">
        <EmptyState
          icon={Construction}
          title={`Экран появится на этапе ${stage}`}
          description={description}
        />
      </div>
    </section>
  );
};

export default PagePlaceholder;
