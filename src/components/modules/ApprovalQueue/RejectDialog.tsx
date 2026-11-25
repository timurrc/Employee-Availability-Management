import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Button from "@/components/ui/Button/Button";
import Modal from "@/components/ui/Modal/Modal";
import Textarea from "@/components/ui/Textarea/Textarea";
import { REJECT_REASONS } from "@/constants/vacation";
import { rejectSchema } from "@/schemas/vacation.schema";
import type { IRejectForm } from "@/types/absence.types";

interface RejectDialogProps {
  /** «Петров А. · 20–28 февр.» */
  subject: string;
  /** Заголовок диалога: по умолчанию «Отклонить заявку» */
  title?: string;
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Отклонение заявки или документа — с обязательной причиной: автор её увидит */
const RejectDialog = ({
  subject,
  title = "Отклонить заявку",
  isPending,
  onConfirm,
  onClose,
}: RejectDialogProps) => {
  const { register, handleSubmit, setValue, formState } = useForm<IRejectForm>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: "" },
  });

  return (
    <Modal
      title={title}
      description={subject}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="reject-form" isLoading={isPending}>
            Отклонить
          </Button>
        </>
      }
    >
      <form
        id="reject-form"
        noValidate
        onSubmit={handleSubmit((values) => onConfirm(values.reason))}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Быстрые причины">
          {REJECT_REASONS.map((reason) => (
            <Button
              key={reason}
              variant="secondary"
              size="sm"
              onClick={() => setValue("reason", reason, { shouldValidate: formState.isSubmitted })}
            >
              {reason}
            </Button>
          ))}
        </div>
        <Textarea
          label="Причина"
          data-autofocus
          error={formState.errors.reason?.message}
          {...register("reason")}
        />
      </form>
    </Modal>
  );
};

export default RejectDialog;
