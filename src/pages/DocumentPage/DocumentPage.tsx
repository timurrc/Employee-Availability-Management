import PagePlaceholder from "@/components/ui/PagePlaceholder/PagePlaceholder";
import { useDocumentPage } from "./useDocumentPage";

const DocumentPage = () => {
  const { document, isPending, error } = useDocumentPage();

  if (isPending) return <p className="text-[var(--color-text-muted)]">Загрузка…</p>;
  if (error || !document) return <p className="text-[var(--color-danger)]">{error?.message}</p>;

  return (
    <PagePlaceholder
      title={`${document.number} · ${document.title}`}
      stage={6}
      description="Маршрут согласования: статус каждого согласующего, подсказка заместителя, срок этапа в рабочих днях."
    />
  );
};

export default DocumentPage;
