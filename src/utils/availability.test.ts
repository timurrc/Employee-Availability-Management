import { describe, expect, it } from "vitest";
import { statusOn } from "@/core/availability";
import { CALENDAR, makeAbsence } from "@/test/fixtures";
import type { IPersonStatus } from "@/types/availability.types";
import { describeStatus, shortName } from "./availability";

const TODAY = "2026-11-25";
const SELF = { status: "self" as const, actorId: "e1", chain: ["e1"] };

const status = (
  absences = [makeAbsence("a1", "e1", "2026-11-20", "2026-12-09")],
): IPersonStatus => ({
  availability: statusOn(CALENDAR, "e1", TODAY, absences),
  upcoming: null,
  deputy: SELF,
});

describe("shortName", () => {
  it("фамилия и инициал имени", () => {
    expect(shortName("Кузнецов Дмитрий Александрович")).toBe("Кузнецов Д.");
    expect(shortName("Админ")).toBe("Админ");
  });
});

describe("describeStatus", () => {
  it("отсутствует — «В отпуске до 9 дек.» с кольцом цвета типа", () => {
    expect(describeStatus(status(), TODAY)).toMatchObject({
      text: "В отпуске до 9 дек.",
      tone: "abs-vacation",
      ring: "abs-vacation",
    });
  });

  it("открытый больничный — без выдуманной даты", () => {
    const sick = [makeAbsence("a1", "e1", "2026-11-23", null, { type: "sick", status: "open" })];
    expect(describeStatus(status(sick), TODAY)?.text).toBe("Больничный, выход неизвестен");
  });

  it("скоро отсутствует — warning и точка", () => {
    const view = describeStatus(
      { ...status([]), upcoming: makeAbsence("a2", "e1", "2026-11-27", "2026-12-10") },
      TODAY,
    );
    expect(view).toMatchObject({ text: "С 27 нояб. — отпуск", tone: "warning", soon: true });
  });

  it("на месте — null (в списках не показываем)", () => {
    expect(describeStatus(status([]), TODAY)).toBeNull();
  });
});
