import { describe, expect, it } from "vitest";
import { coverageZone } from "./coverage";
import { initials, matchesQuery } from "./text";

describe("initials", () => {
  it("первые буквы двух первых слов", () => {
    expect(initials("Кузнецов Дмитрий Александрович")).toBe("КД");
    expect(initials("админ")).toBe("А");
  });
});

describe("matchesQuery", () => {
  it("все слова в любом порядке, без регистра и «ё»", () => {
    const text = "Семёнов Алексей Николаевич Системный администратор";
    expect(matchesQuery(text, "алекс семен")).toBe(true);
    expect(matchesQuery(text, "  АДМИН ")).toBe(true);
    expect(matchesQuery(text, "семенов бухгалтер")).toBe(false);
  });
});

describe("coverageZone", () => {
  it("ниже порога, у порога (до +10 п.п.) и спокойно", () => {
    expect(coverageZone(59, 60)).toBe("below");
    expect(coverageZone(60, 60)).toBe("near");
    expect(coverageZone(69, 60)).toBe("near");
    expect(coverageZone(70, 60)).toBe("ok");
  });
});
