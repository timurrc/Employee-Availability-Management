import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату");

/** 12 цифр, пробелы при вводе допускаются: «9100 0012 3456» */
export const elnNumber = z
  .string()
  .transform((value) => value.replace(/\s/g, ""))
  .refine((value) => /^\d{12}$/.test(value), "Номер ЭЛН — 12 цифр");

/**
 * Форма «Открыть больничный». Пересечение с другим больничным и «начало в будущем > 3 дней» —
 * проверки с данными, они в utils/sickLeave (sickLeaveIssues), не здесь.
 */
export const sickLeaveSchema = z
  .object({
    employeeId: z.string().min(1, "Выберите сотрудника"),
    start: isoDate,
    endUnknown: z.boolean(),
    end: z.string(),
    elnNumber,
  })
  .superRefine((value, ctx) => {
    if (value.endUnknown) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.end)) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "Укажите дату или «неизвестна»" });
    } else if (value.end < value.start) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "Окончание раньше начала" });
    }
  });
