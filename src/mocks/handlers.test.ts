import { describe, expect, it } from "vitest";
import { AbsenceService } from "@/services/absence.service";
import { CalendarService } from "@/services/calendar.service";
import { EmployeeService } from "@/services/employee.service";
import { toISODate } from "@/core/calendar";
import { DemoService } from "@/services/demo.service";
import { DelegationService } from "@/services/delegation.service";
import { DocumentService } from "@/services/document.service";
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
    // e04 → e05 → e06 → e07 → e08: назначить e04 заместителем e05 — цикл
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

  it("документ: создать → маршрут → отправить → передать → решения", async () => {
    const created = await DocumentService.create({ title: "Тест", type: "memo", authorId: "e21" });
    expect(created).toMatchObject({ routeStartedAt: null, steps: [] });
    expect(created.number).toMatch(/^СЗ-\d{4}\/\d{3}$/);
    await expect(DocumentService.send(created.id, "2026-11-25")).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      DocumentService.saveRoute(created.id, { steps: [{ approverId: "e19", durationDays: 0 }] }),
    ).rejects.toMatchObject({ status: 422 });

    const routed = await DocumentService.saveRoute(created.id, {
      steps: [
        { approverId: "e19", durationDays: 2, waitForReturn: true },
        { approverId: "e04", durationDays: 1, delegatedToId: "e05" },
      ],
    });
    expect(routed.steps.map((s) => [s.status, s.delegatedToId, s.waitForReturn])).toEqual([
      ["waiting", undefined, true],
      ["waiting", "e05", undefined],
    ]);
    const sent = await DocumentService.send(created.id, "2026-11-25");
    expect(sent.steps.map((s) => s.status)).toEqual(["in_progress", "waiting"]);
    await expect(DocumentService.send(created.id, "2026-11-25")).rejects.toMatchObject({
      status: 422,
    });
    await expect(DocumentService.saveRoute(created.id, { steps: [] })).rejects.toMatchObject({
      status: 422,
    });

    const [first, second] = sent.steps;
    const delegated = await DocumentService.patchStep(created.id, first!.id, {
      delegatedToId: "e20",
    });
    expect(delegated.steps[0]).toMatchObject({ delegatedToId: "e20", waitForReturn: false });
    await expect(
      DocumentService.patchStep(created.id, first!.id, { delegatedToId: "e19" }),
    ).rejects.toMatchObject({ status: 422 });
    const waiting = await DocumentService.patchStep(created.id, second!.id, {
      waitForReturn: true,
    });
    expect(waiting.steps[1]).toMatchObject({ delegatedToId: "e05", waitForReturn: true });

    await expect(
      DocumentService.decide(created.id, { byId: "e19", decision: "approved" }),
    ).rejects.toMatchObject({ status: 403 });
    const approved = await DocumentService.decide(created.id, {
      byId: "e20",
      decision: "approved",
    });
    expect(approved.steps.map((s) => s.status)).toEqual(["approved", "in_progress"]);
    await expect(
      DocumentService.patchStep(created.id, first!.id, { delegatedToId: null }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      DocumentService.decide(created.id, { byId: "e05", decision: "rejected" }),
    ).rejects.toMatchObject({ status: 422 });
    const rejected = await DocumentService.decide(created.id, {
      byId: "e05",
      decision: "rejected",
      reason: " Нет бюджета ",
    });
    expect(rejected.steps[1]).toMatchObject({ status: "rejected", comment: "Нет бюджета" });
    await expect(
      DocumentService.decide(created.id, { byId: "e05", decision: "approved" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      DocumentService.create({ title: " ", type: "memo", authorId: "e21" }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
