import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { statusOn } from "@/core/availability";
import { CALENDAR, makeAbsence, makeEmployee } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { IPersonStatus } from "@/types/availability.types";
import PersonChip from "./PersonChip";

const TODAY = "2026-11-25";
const PERSON = makeEmployee("e1", { fullName: "Иванова Анна Сергеевна", position: "Юрист" });
const DEPUTY = makeEmployee("e2", { fullName: "Смирнов Андрей Петрович" });

const absentStatus = (deputy: IPersonStatus["deputy"]): IPersonStatus => ({
  availability: statusOn(CALENDAR, "e1", TODAY, [
    makeAbsence("a1", "e1", "2026-11-20", "2026-12-09"),
  ]),
  upcoming: null,
  deputy,
});

describe("PersonChip", () => {
  it("строка: статус и кто замещает, имя — ссылка на карточку", () => {
    renderWithProviders(
      <PersonChip
        person={PERSON}
        date={TODAY}
        status={absentStatus({ status: "deputy", actorId: "e2", chain: ["e1", "e2"] })}
        deputy={DEPUTY}
      />,
    );
    expect(screen.getByRole("link", { name: "Иванова Анна Сергеевна" })).toHaveAttribute(
      "href",
      "/employees/e1",
    );
    expect(screen.getByText("В отпуске до 9 дек.")).toBeInTheDocument();
    expect(screen.getByText("Замещает Смирнов А.")).toBeInTheDocument();
  });

  it("нет замещающего — явное состояние", () => {
    renderWithProviders(
      <PersonChip
        person={PERSON}
        date={TODAY}
        status={absentStatus({ status: "no_deputy", actorId: null, chain: ["e1"] })}
      />,
    );
    expect(screen.getByText("Нет замещающего")).toBeInTheDocument();
  });

  it("карточка: на месте показывает «На месте», в строке — должность", () => {
    const status: IPersonStatus = {
      availability: statusOn(CALENDAR, "e1", TODAY, []),
      upcoming: null,
      deputy: { status: "self", actorId: "e1", chain: ["e1"] },
    };
    const { rerender } = renderWithProviders(
      <PersonChip person={PERSON} status={status} variant="card" date={TODAY} />,
    );
    expect(screen.getByText("На месте")).toBeInTheDocument();
    rerender(<PersonChip person={PERSON} status={status} date={TODAY} />);
    expect(screen.queryByText("На месте")).not.toBeInTheDocument();
    expect(screen.getByText("Юрист")).toBeInTheDocument();
  });
});
