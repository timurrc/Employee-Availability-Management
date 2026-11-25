import { describe, expect, it } from "vitest";
import { formatDay, formatDays, formatPeriod, formatRelative, plural } from "./date";

const TODAY = "2026-11-25";

describe("plural", () => {
  it.each([
    [1, "день"],
    [2, "дня"],
    [5, "дней"],
    [11, "дней"],
    [14, "дней"],
    [21, "день"],
    [22, "дня"],
    [112, "дней"],
  ])("%i → %s", (count, expected) => {
    expect(plural(count, ["день", "дня", "дней"])).toBe(expected);
  });
});

describe("formatDay", () => {
  it("без года в текущем году, с годом — в другом", () => {
    expect(formatDay("2026-12-09", TODAY)).toBe("9 дек.");
    expect(formatDay("2027-01-13", TODAY)).toBe("13 янв. 2027");
  });
});

describe("formatPeriod", () => {
  it("один месяц — «1–14 дек.»", () => {
    expect(formatPeriod({ start: "2026-12-01", end: "2026-12-14" }, TODAY)).toBe("1–14 дек.");
  });

  it("разные месяцы — тонкие пробелы вокруг тире", () => {
    expect(formatPeriod({ start: "2026-11-28", end: "2026-12-03" }, TODAY)).toBe(
      "28 нояб. – 3 дек.",
    );
  });

  it("через новый год — у второй даты год", () => {
    expect(formatPeriod({ start: "2026-12-28", end: "2027-01-13" }, TODAY)).toBe(
      "28 дек. – 13 янв. 2027",
    );
  });

  it("весь период в следующем году — год один раз в конце", () => {
    expect(formatPeriod({ start: "2027-03-01", end: "2027-03-14" }, TODAY)).toBe("1–14 мар. 2027");
  });

  it("один день и открытый период", () => {
    expect(formatPeriod({ start: "2026-12-09", end: "2026-12-09" }, TODAY)).toBe("9 дек.");
    expect(formatPeriod({ start: "2026-11-23", end: null }, TODAY)).toBe("с 23 нояб.");
  });
});

describe("formatRelative", () => {
  it("ближайшие дни словами, дальше — дата", () => {
    expect(formatRelative("2026-11-25", TODAY)).toBe("сегодня");
    expect(formatRelative("2026-11-26", TODAY)).toBe("завтра");
    expect(formatRelative("2026-11-24", TODAY)).toBe("вчера");
    expect(formatRelative("2026-11-28", TODAY)).toBe("через 3 дня");
    expect(formatRelative("2026-12-09", TODAY)).toBe("9 дек.");
  });
});

describe("formatDays", () => {
  it("коротко для таблиц и полностью для форм, календ. и раб. не путаются", () => {
    expect(formatDays(14, "calendar")).toBe("14 календ. дн.");
    expect(formatDays(3, "working")).toBe("3 раб. дн.");
    expect(formatDays(14, "calendar", true)).toBe("14 календарных дней");
    expect(formatDays(1, "working", true)).toBe("1 рабочий день");
    expect(formatDays(2, "working", true)).toBe("2 рабочих дня");
  });
});
