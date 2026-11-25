import {
  CircleSlash,
  Coffee,
  GraduationCap,
  HeartPulse,
  Palmtree,
  Plane,
  type LucideIcon,
} from "lucide-react";
import type { AbsenceStatus, AbsenceType } from "@/types/absence.types";
import type { ApprovalStatus } from "@/types/document.types";
import type { Tone } from "./tones";

export interface IAbsenceMeta {
  label: string;
  /** Как читать «в каком состоянии»: «В отпуске до 9 дек.» */
  stateLabel: string;
  icon: LucideIcon;
  /** Короткий код в ячейке таймлайна */
  code: string;
  tone: Tone;
}

/** Единое кодирование отсутствий — docs/design/03-foundations.md */
export const ABSENCE_META: Record<AbsenceType, IAbsenceMeta> = {
  vacation: {
    label: "Отпуск",
    stateLabel: "В отпуске",
    icon: Palmtree,
    code: "О",
    tone: "abs-vacation",
  },
  unpaid: {
    label: "Без сохранения",
    stateLabel: "Отпуск без сохранения",
    icon: CircleSlash,
    code: "БС",
    tone: "abs-unpaid",
  },
  sick: {
    label: "Больничный",
    stateLabel: "На больничном",
    icon: HeartPulse,
    code: "Б",
    tone: "abs-sick",
  },
  trip: {
    label: "Командировка",
    stateLabel: "В командировке",
    icon: Plane,
    code: "К",
    tone: "abs-trip",
  },
  study: {
    label: "Учебный",
    stateLabel: "Учебный отпуск",
    icon: GraduationCap,
    code: "У",
    tone: "abs-study",
  },
  dayoff: { label: "Отгул", stateLabel: "Отгул", icon: Coffee, code: "ОГ", tone: "abs-dayoff" },
};

export const ABSENCE_STATUS_META: Record<AbsenceStatus, { label: string; tone: Tone }> = {
  draft: { label: "Черновик", tone: "neutral" },
  pending: { label: "На согласовании", tone: "info" },
  approved: { label: "Согласована", tone: "success" },
  rejected: { label: "Отклонена", tone: "danger" },
  cancelled: { label: "Отменена", tone: "neutral" },
  open: { label: "Открыт", tone: "abs-sick" },
  extended: { label: "Продлён", tone: "abs-sick" },
  closed: { label: "Закрыт", tone: "neutral" },
};

export const APPROVAL_STATUS_META: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Ожидает", tone: "neutral" },
  in_progress: { label: "На согласовании", tone: "info" },
  approved: { label: "Согласовано", tone: "success" },
  rejected: { label: "Отклонено", tone: "danger" },
};

/** Отсутствие начнётся скоро — предупреждаем за столько календарных дней */
export const SOON_DAYS = 3;
