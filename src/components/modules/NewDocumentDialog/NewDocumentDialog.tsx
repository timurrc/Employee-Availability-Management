import { useState } from "react";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/Input";
import Modal from "@/components/ui/Modal/Modal";
import Select from "@/components/ui/Select/Select";
import type { DocumentType } from "@/types/document.types";
import { DOCUMENT_TYPE_LABELS } from "@/utils/document";

interface NewDocumentDialogProps {
  isPending: boolean;
  error?: string;
  onCreate: (dto: { title: string; type: DocumentType }) => void;
  onClose: () => void;
}

/** Новый документ — черновик: тип и название, маршрут собирается на странице документа */
const NewDocumentDialog = ({ isPending, error, onCreate, onClose }: NewDocumentDialogProps) => {
  const [type, setType] = useState<DocumentType>("memo");
  const [title, setTitle] = useState("");
  const [touched, setTouched] = useState(false);
  const titleError = title.trim() ? undefined : "Укажите название";

  return (
    <Modal
      title="Новый документ"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="new-document-form" isLoading={isPending}>
            Создать черновик
          </Button>
        </>
      }
    >
      <form
        id="new-document-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!titleError) onCreate({ title: title.trim(), type });
        }}
      >
        <Select
          label="Тип"
          value={type}
          onChange={(event) => setType(event.target.value as DocumentType)}
        >
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          label="Название"
          data-autofocus
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          error={touched ? titleError : undefined}
        />
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </form>
    </Modal>
  );
};

export default NewDocumentDialog;
