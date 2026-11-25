import { isValid, parseISO } from "date-fns";
import { z } from "zod";

/** Существующая дата: «2027-02-30» не пройдёт */
const realDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата не в формате YYYY-MM-DD")
  .refine(
    (value) => isValid(parseISO(value)) && parseISO(value).getDate() === Number(value.slice(8)),
    {
      message: "Такой даты не существует",
    },
  );

const noted = z.object({ date: realDate, note: z.string() });

/** Формат файла импорта — ICalendarYearSource */
export const calendarSourceSchema = z
  .object({
    year: z.number({ error: "Нет поля year" }).int().min(2000).max(2100),
    source: z.string({ error: "Нет поля source" }).min(1, "Укажите основание (source)"),
    holidays: z.array(noted, { error: "Нет поля holidays" }),
    extraDaysOff: z.array(noted).default([]),
    workingWeekends: z.array(noted).default([]),
    shortened: z.array(realDate).default([]),
    expectedWorkingDays: z.number().int().optional(),
  })
  .superRefine((value, ctx) => {
    const lists = [
      ["holidays", value.holidays.map((d) => d.date)],
      ["extraDaysOff", value.extraDaysOff.map((d) => d.date)],
      ["workingWeekends", value.workingWeekends.map((d) => d.date)],
      ["shortened", value.shortened],
    ] as const;
    for (const [field, dates] of lists) {
      dates.forEach((date, index) => {
        if (!date.startsWith(`${value.year}-`)) {
          ctx.addIssue({
            code: "custom",
            path: [field, index],
            message: `Дата ${date} не из ${value.year} года`,
          });
        }
      });
    }
  });
