import { describe, expect, it } from "vitest";
import { AbsenceService } from "@/services/absence.service";
import { CalendarService } from "@/services/calendar.service";
import { EmployeeService } from "@/services/employee.service";
import { toISODate } from "@/core/calendar";
import { DemoService } from "@/services/demo.service";
import { DelegationService } from "@/services/delegation.service";
import { SickLeaveService } from "@/services/sickLeave.service";
import { db } from "./db";

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

  it("сбрасывает демо-данные к исходным", async () => {
    db.update((draft) => {
      draft.absences = [];
    });
    await DemoService.reset();
    expect(db.get().absences.length).toBeGreaterThan(0);
  });

  it("больничный: открыть → продлить с новым ЭЛН → закрыть; второй открыть нельзя", async () => {
    const today = toISODate(new Date());
    const opened = await SickLeaveService.open({
      employeeId: "e03",
      start: today,
      end: null,
      elnNumber: "111122223333",
    });
    expect(opened).toMatchObject({ status: "open", type: "sick", period: { end: null } });
    await expect(
      SickLeaveService.open({ employeeId: "e03", start: today, end: null, elnNumber: "1" }),
    ).rejects.toMatchObject({ status: 422, message: "Номер ЭЛН — 12 цифр" });
    await expect(
      SickLeaveService.open({
        employeeId: "e03",
        start: today,
        end: null,
        elnNumber: "111122224444",
      }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/^Уже открыт/) });

    const extended = await SickLeaveService.extend(opened.id, {
      end: "2099-01-10",
      elnNumber: "999988887777",
    });
    expect(extended.status).toBe("extended");
    expect(extended.elnHistory?.map((r) => r.number)).toEqual(["111122223333", "999988887777"]);
    expect(extended.elnHistory?.[0]?.end).not.toBeNull();

    const closed = await SickLeaveService.close(opened.id, { end: "2099-01-05" });
    expect(closed).toMatchObject({ status: "closed", period: { end: "2099-01-05" } });
    expect(closed.elnHistory?.at(-1)?.end).toBe("2099-01-05");
    await expect(SickLeaveService.close(opened.id, { end: today })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("продление отпуска по ст. 124 и отмена", async () => {
    const vacation = db.get().absences.find((a) => a.id === "a21")!;
    const extended = await AbsenceService.extendVacation("a21", {
      end: "2099-12-31",
      sickLeaveId: "a06",
      days: 3,
    });
    expect(extended.extension).toEqual({
      sickLeaveId: "a06",
      previousEnd: vacation.period.end,
      days: 3,
    });
    const undone = await AbsenceService.extendVacation("a21", {
      end: vacation.period.end!,
      sickLeaveId: null,
      days: 0,
    });
    expect(undone.extension).toBeUndefined();
    await expect(
      AbsenceService.extendVacation("a03", { end: "2099-01-01", sickLeaveId: null, days: 0 }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("постоянный заместитель: цикл запрещён", async () => {
    // e05 → e06 → e07 → e06; назначить e04 заместителем e05? e04 → e05 — цикл
    await expect(EmployeeService.setDeputy("e05", "e04")).rejects.toMatchObject({
      status: 422,
      message: expect.stringMatching(/^Создаст цикл: Громов/),
    });
    const updated = await EmployeeService.setDeputy("e18", "e16");
    expect(updated.deputyId).toBe("e16");
    expect((await EmployeeService.setDeputy("e18", null)).deputyId).toBeNull();
  });

  it("замещения на период: создать, пересечение запрещено, удалить", async () => {
    const created = await DelegationService.create({
      fromId: "e05",
      toId: "e08",
      period: { start: "2099-01-01", end: "2099-01-05" },
      documentTypes: [],
    });
    expect(created.reason).toBe("manual");
    await expect(
      DelegationService.create({
        fromId: "e05",
        toId: "e07",
        period: { start: "2099-01-03", end: "2099-01-09" },
        documentTypes: [],
      }),
    ).rejects.toMatchObject({ status: 422 });
    await DelegationService.remove(created.id);
    expect((await DelegationService.getAll()).some((d) => d.id === created.id)).toBe(false);
  });

  it("календарь: правка дня и импорт года", async () => {
    const year = await CalendarService.setDay("2027-12-30", {
      kind: "holiday",
      isShortened: false,
    });
    expect(year.days.find((d) => d.date === "2027-12-30")?.kind).toBe("holiday");

    const imported = await CalendarService.importYear({
      year: 2028,
      source: "тест",
      holidays: [{ date: "2028-01-03", note: "НГ" }],
      extraDaysOff: [],
      workingWeekends: [],
      shortened: [],
    });
    expect(imported.days).toHaveLength(366);
    expect((await CalendarService.getYear(2028)).source).toBe("тест");
    await expect(
      CalendarService.importYear({
        year: 2028,
        source: "",
        holidays: [],
        extraDaysOff: [],
        workingWeekends: [],
        shortened: [],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
