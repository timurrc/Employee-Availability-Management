import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ДД.ММ.ГГГГ");

/** Форма заявки. Правила ТК РФ (баланс, пересечения, ст. 125) — в utils/vacation, не здесь */
export const vacationRequestSchema = z.object({
  type: z.enum(["vacation", "unpaid", "study"]),
  period: z
    .object({ start: isoDate, end: isoDate })
    .nullable()
    .refine((value) => value !== null, "Выберите период"),
  /** "" — заместитель не назначен */
  deputyId: z.string(),
  comment: z.string().trim().max(500, "Не больше 500 символов"),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, "Укажите причину — сотрудник её увидит").max(300),
});
