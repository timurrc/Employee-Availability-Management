import { describe, expect, it } from "vitest";
import { AbsenceService } from "@/services/absence.service";
import { CalendarService } from "@/services/calendar.service";
import { EmployeeService } from "@/services/employee.service";
import { toISODate } from "@/core/calendar";

// Проверка мок-API через настоящие сервисы и axios
describe("мок-API", () => {
  it("отдаёт сотрудников с подразделением и руководителем", async () => {
    const employees = await EmployeeService.getAll();
    expect(employees).toHaveLength(30);
    const director = employees.find((item) => item.id === "e01");
    expect(director?.managerId).toBeNull();
    expect(employees.find((item) => item.id === "e21")?.managerId).toBe("e19");
  });

  it("фильтрует отсутствия по пересечению с периодом, открытый больничный попадает", async () => {
    const today = toISODate(new Date());
    const items = await AbsenceService.getAll({ from: today, to: today });
    const ids = items.map((item) => item.id);
    expect(ids).toContain("a03"); // открытый больничный без даты окончания
    expect(ids).toContain("a01");
    expect(ids).not.toContain("a15"); // прошедший отпуск
  });

  it("собирает производственный календарь года и отдаёт 404 на незагруженный год", async () => {
    const calendar = await CalendarService.getYear(2026);
    expect(calendar.days).toHaveLength(365);
    await expect(CalendarService.getYear(2030)).rejects.toMatchObject({ status: 404 });
  });
});
