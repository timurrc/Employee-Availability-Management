import { useState } from "react";
import { toast } from "sonner";
import { UNDO_TOAST_MS } from "@/constants/vacation";
import { useAuthStore } from "@/store/auth.store";
import type { IAbsence } from "@/types/absence.types";
import { useSetAbsenceStatus } from "./useAbsences";

/**
 * Решения по заявке: согласовать (тост с «Отменить» 5 с), отклонить с причиной,
 * отменить свою. Нужен очереди руководителя, карточке отсутствия и «Моим заявкам».
 */
export const useVacationDecision = () => {
  const user = useAuthStore((state) => state.user);
  const mutation = useSetAbsenceStatus();
  /** По какой заявке идёт запрос — строка полупрозрачная, кнопка со спиннером */
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (
    absence: IAbsence,
    status: "approved" | "rejected" | "pending" | "cancelled",
    reason?: string,
  ) => {
    if (!user) return false;
    setBusyId(absence.id);
    try {
      await mutation.mutateAsync({ id: absence.id, dto: { status, byId: user.id, reason } });
      return true;
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error ? String(error.message) : "";
      toast.error(
        status === "approved"
          ? "Не удалось согласовать — повторите"
          : status === "rejected"
            ? "Не удалось отклонить — повторите"
            : `Не удалось изменить заявку${message ? `: ${message}` : ""}`,
      );
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const approve = async (absence: IAbsence, name: string) => {
    if (!(await run(absence, "approved"))) return false;
    toast.success(`Отпуск согласован: ${name}`, {
      duration: UNDO_TOAST_MS,
      action: {
        label: "Отменить",
        onClick: () => void run(absence, "pending"),
      },
    });
    return true;
  };

  const reject = async (absence: IAbsence, reason: string, name: string) => {
    const ok = await run(absence, "rejected", reason);
    if (ok) toast.success(`Заявка отклонена: ${name}`);
    return ok;
  };

  const cancel = async (absence: IAbsence) => {
    const ok = await run(absence, "cancelled");
    if (ok) toast.success("Заявка отменена");
    return ok;
  };

  return { approve, reject, cancel, busyId };
};
