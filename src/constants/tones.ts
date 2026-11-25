/**
 * Тоны статусов: семантика (neutral/info/success/warning/danger) и категориальные
 * цвета типов отсутствия (abs-*). Классы выписаны целиком — Tailwind находит их по тексту.
 */
export type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "abs-vacation"
  | "abs-unpaid"
  | "abs-sick"
  | "abs-trip"
  | "abs-study"
  | "abs-dayoff";

interface IToneClasses {
  /** Текст и иконка */
  fg: string;
  /** Подложка бейджа */
  bg: string;
  /** Левая граница полосы отсутствия */
  border: string;
  /** Заливка (полоса, точка) */
  fill: string;
}

export const TONE_CLASSES: Record<Tone, IToneClasses> = {
  neutral: {
    fg: "text-[var(--color-text-muted)]",
    bg: "bg-[var(--color-surface-2)]",
    border: "border-[var(--color-border-strong)]",
    fill: "bg-[var(--color-text-subtle)]",
  },
  info: {
    fg: "text-[var(--color-info)]",
    bg: "bg-[var(--color-info-bg)]",
    border: "border-[var(--color-info)]",
    fill: "bg-[var(--color-info)]",
  },
  success: {
    fg: "text-[var(--color-success)]",
    bg: "bg-[var(--color-success-bg)]",
    border: "border-[var(--color-success)]",
    fill: "bg-[var(--color-success)]",
  },
  warning: {
    fg: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning-bg)]",
    border: "border-[var(--color-warning)]",
    fill: "bg-[var(--color-warning)]",
  },
  danger: {
    fg: "text-[var(--color-danger)]",
    bg: "bg-[var(--color-danger-bg)]",
    border: "border-[var(--color-danger)]",
    fill: "bg-[var(--color-danger)]",
  },
  "abs-vacation": {
    fg: "text-[var(--color-abs-vacation)]",
    bg: "bg-[var(--color-abs-vacation-bg)]",
    border: "border-[var(--color-abs-vacation)]",
    fill: "bg-[var(--color-abs-vacation)]",
  },
  "abs-unpaid": {
    fg: "text-[var(--color-abs-unpaid)]",
    bg: "bg-[var(--color-abs-unpaid-bg)]",
    border: "border-[var(--color-abs-unpaid)]",
    fill: "bg-[var(--color-abs-unpaid)]",
  },
  "abs-sick": {
    fg: "text-[var(--color-abs-sick)]",
    bg: "bg-[var(--color-abs-sick-bg)]",
    border: "border-[var(--color-abs-sick)]",
    fill: "bg-[var(--color-abs-sick)]",
  },
  "abs-trip": {
    fg: "text-[var(--color-abs-trip)]",
    bg: "bg-[var(--color-abs-trip-bg)]",
    border: "border-[var(--color-abs-trip)]",
    fill: "bg-[var(--color-abs-trip)]",
  },
  "abs-study": {
    fg: "text-[var(--color-abs-study)]",
    bg: "bg-[var(--color-abs-study-bg)]",
    border: "border-[var(--color-abs-study)]",
    fill: "bg-[var(--color-abs-study)]",
  },
  "abs-dayoff": {
    fg: "text-[var(--color-abs-dayoff)]",
    bg: "bg-[var(--color-abs-dayoff-bg)]",
    border: "border-[var(--color-abs-dayoff)]",
    fill: "bg-[var(--color-abs-dayoff)]",
  },
};
