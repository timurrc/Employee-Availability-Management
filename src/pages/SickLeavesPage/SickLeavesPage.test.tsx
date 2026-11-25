import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { ENV } from "@/constants/env";
import { MOCK_TOKEN } from "@/constants/mock";
import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import SickLeavesPage from "./SickLeavesPage";

const rowOf = (name: RegExp) =>
  screen.getAllByTestId("sick-row").find((row) => name.test(row.textContent ?? ""))!;

describe("SickLeavesPage", () => {
  beforeEach(() =>
    useAuthStore
      .getState()
      .setAuth(MOCK_TOKEN, { id: "e16", name: "Попова", position: "HR", role: "hr" }),
  );

  it("открытые: пересечение сверху, «нет замещающего», ЭЛН группами", async () => {
    renderWithProviders(<SickLeavesPage />);
    const rows = await screen.findAllByTestId("sick-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Степанова");
    expect(screen.getByText(/1 пересечение с отпуском ждёт решения/)).toBeInTheDocument();
    expect(rowOf(/Алексеева/)).toHaveTextContent("Нет замещающего");
    expect(rowOf(/Егорова/)).toHaveTextContent("9101 2345 6789");
    expect(rowOf(/Егорова/)).toHaveTextContent("выход неизвестен");
  });

  it("продлить отпуск по ст. 124 — плашка уходит", async () => {
    renderWithProviders(<SickLeavesPage />);
    await screen.findAllByTestId("sick-row");
    await userEvent.click(screen.getByRole("button", { name: /^Продлить отпуск до/ }));
    await waitFor(() =>
      expect(screen.queryByText(/пересечение с отпуском ждёт решения/)).toBeNull(),
    );
    expect(db.get().absences.find((a) => a.id === "a21")?.extension?.sickLeaveId).toBe("a06");
  });

  it("закрыть больничный — уходит из открытых", async () => {
    renderWithProviders(<SickLeavesPage />);
    await screen.findAllByTestId("sick-row");
    await userEvent.click(within(rowOf(/Егорова/)).getByRole("button", { name: "Закрыть" }));
    const dialog = screen.getByRole("dialog", { name: "Закрыть больничный" });
    expect(dialog).toHaveTextContent(/календарных дн/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Закрыть больничный" }));
    await waitFor(() => expect(screen.getAllByTestId("sick-row")).toHaveLength(2));
    expect(db.get().absences.find((a) => a.id === "a03")?.status).toBe("closed");
  });

  it("продлить: неизвестная дата и новый ЭЛН", async () => {
    renderWithProviders(<SickLeavesPage />);
    await screen.findAllByTestId("sick-row");
    await userEvent.click(within(rowOf(/Егорова/)).getByRole("button", { name: "Продлить" }));
    const dialog = screen.getByRole("dialog", { name: "Продлить больничный" });
    const eln = within(dialog).getByLabelText("Новый номер ЭЛН (если выдан)");
    await userEvent.type(eln, "123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Продлить" }));
    expect(within(dialog).getByText("Номер ЭЛН — 12 цифр")).toBeInTheDocument();
    await userEvent.clear(eln);
    await userEvent.type(eln, "5555 6666 7777");
    await userEvent.click(within(dialog).getByRole("button", { name: "Продлить" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(db.get().absences.find((a) => a.id === "a03")?.elnNumber).toBe("555566667777");
  });

  it("открыть больничный: что задевает, валидация ЭЛН, сохранение", async () => {
    renderWithProviders(<SickLeavesPage />);
    await screen.findAllByTestId("sick-row");
    await userEvent.click(screen.getAllByRole("button", { name: "Открыть больничный" })[0]!);
    const sheet = screen.getByRole("dialog", { name: "Открыть больничный" });

    await userEvent.selectOptions(within(sheet).getByLabelText("Сотрудник"), "e04");
    const impact = within(sheet).getByRole("region", { name: "Что это задевает" });
    expect(impact).toHaveTextContent(/Согласованный отпуск .* пересекается/);
    expect(impact).toHaveTextContent(/1 этап документов ждёт Громов П\./);

    await userEvent.click(within(sheet).getByRole("button", { name: "Открыть больничный" }));
    expect(await within(sheet).findByText("Номер ЭЛН — 12 цифр")).toBeInTheDocument();
    await userEvent.type(within(sheet).getByLabelText("Номер ЭЛН"), "9100 0012 3456");
    await userEvent.click(within(sheet).getByRole("button", { name: "Открыть больничный" }));
    await waitFor(() => expect(screen.getAllByTestId("sick-row")).toHaveLength(4));
  });

  it("без заместителя — назначить прямо из строки", async () => {
    renderWithProviders(<SickLeavesPage />);
    await screen.findAllByTestId("sick-row");
    await userEvent.click(within(rowOf(/Алексеева/)).getByRole("button", { name: "Назначить" }));
    const dialog = screen.getByRole("dialog", { name: "Постоянный заместитель" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Заместитель"), "e16");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(rowOf(/Алексеева/)).toHaveTextContent("Замещает Попова Е."));
  });

  it("фильтр без результатов — «Сбросить фильтры»", async () => {
    renderWithProviders(<SickLeavesPage />);
    await screen.findAllByTestId("sick-row");
    await userEvent.type(screen.getByLabelText("Поиск по ФИО"), "zzz");
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(screen.getAllByTestId("sick-row")).toHaveLength(3);
  });

  it("ошибка загрузки — «Повторить»", async () => {
    server.use(http.get(`${ENV.API_URL}/absences`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<SickLeavesPage />);
    expect(await screen.findByRole("button", { name: /Повторить/ })).toBeInTheDocument();
  });
});
