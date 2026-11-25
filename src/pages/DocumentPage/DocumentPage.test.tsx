import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_TOKEN } from "@/constants/mock";
import { ROUTES } from "@/constants/routes";
import { db } from "@/mocks/db";
import { useAuthStore } from "@/store/auth.store";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { Role } from "@/types/employee.types";
import DocumentPage from "./DocumentPage";

const loginAs = (id: string, role: Role = "employee") =>
  useAuthStore.getState().setAuth(MOCK_TOKEN, { id, name: "Демо", position: "—", role });

const renderAt = (id: string) =>
  renderWithProviders(
    <Routes>
      <Route path={ROUTES.DOCUMENT} element={<DocumentPage />} />
    </Routes>,
    { route: `/documents/${id}` },
  );

const steps = () => screen.getAllByTestId("route-step");

describe("DocumentPage", () => {
  beforeEach(() => loginAs("e21"));

  it("черновик: статус согласующих на даты этапов, передать всем — риск уходит, отправить", async () => {
    renderAt("doc3");
    const banner = await screen.findByText(/2 согласующих отсутствуют в даты своего этапа/);
    expect(banner).toBeInTheDocument();
    expect(steps()).toHaveLength(3);
    expect(within(steps()[1]!).getByText("На месте в даты этапа")).toBeInTheDocument();
    expect(screen.getAllByText("Риск срока")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Передать заместителям (2)" }));
    expect(screen.queryByText("Риск срока")).toBeNull();
    expect(
      within(steps()[0]!).getByText(/Передано: Новиков С\. замещает Кузнецов Д\./),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Отправить на согласование" }));
    expect(await screen.findByText("На согласовании")).toBeInTheDocument();
    const saved = db.get().documents.find((d) => d.id === "doc3")!;
    expect(saved.routeStartedAt).not.toBeNull();
    expect(saved.steps[0]).toMatchObject({ delegatedToId: "e20", status: "in_progress" });
  });

  it("правка маршрута: срок, порядок, удаление, добавить согласующего", async () => {
    renderAt("doc3");
    await screen.findAllByTestId("route-step");
    const duration = screen.getByLabelText("Срок, этап 2");
    await userEvent.clear(duration);
    await userEvent.type(duration, "4");
    expect(duration).toHaveValue(4);

    await userEvent.click(screen.getByRole("button", { name: "Ниже, этап 1" }));
    expect(steps()[0]).toHaveTextContent("Семёнов");

    await userEvent.click(screen.getByRole("button", { name: "Удалить этап 3" }));
    expect(steps()).toHaveLength(2);

    await userEvent.selectOptions(screen.getByLabelText("Добавить согласующего"), "e01");
    await userEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(steps()).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() =>
      expect(
        db
          .get()
          .documents.find((d) => d.id === "doc3")
          ?.steps.map((s) => s.approverId),
      ).toEqual(["e25", "e19", "e01"]),
    );
  });

  it("«Оставить» — этап ждёт выхода, срок сдвигается", async () => {
    renderAt("doc3");
    await screen.findAllByTestId("route-step");
    await userEvent.click(within(steps()[2]!).getByRole("button", { name: "Оставить" }));
    expect(within(steps()[2]!).getByText("Ждёт выхода")).toBeInTheDocument();
    expect(within(steps()[2]!).getByText(/Срок сдвинут на выход/)).toBeInTheDocument();
    await userEvent.click(within(steps()[2]!).getByRole("button", { name: "Не ждать" }));
    expect(within(steps()[2]!).queryByText("Ждёт выхода")).toBeNull();
  });

  it("отправленный документ: у кого сейчас, передача запросом", async () => {
    renderAt("doc1");
    expect(await screen.findByText(/этап 1 из 3/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сохранить" })).toBeNull();
    await userEvent.click(
      within(steps()[0]!).getByRole("button", { name: "Передать заместителю" }),
    );
    await waitFor(() =>
      expect(db.get().documents.find((d) => d.id === "doc1")?.steps[0]?.delegatedToId).toBe("e05"),
    );
  });

  it("не автор: только чтение, без кнопок передачи", async () => {
    loginAs("e19", "manager");
    renderAt("doc1");
    await screen.findAllByTestId("route-step");
    expect(screen.queryByRole("button", { name: /Передать/ })).toBeNull();
  });

  it("согласующий решает: согласовать и отклонить с причиной", async () => {
    loginAs("e01", "manager");
    renderAt("doc2");
    await userEvent.click(await screen.findByRole("button", { name: "Согласовать" }));
    expect(await screen.findByText("Согласован")).toBeInTheDocument();

    db.reset();
    loginAs("e04", "manager");
    renderAt("doc1");
    await userEvent.click(await screen.findByRole("button", { name: "Отклонить" }));
    const dialog = screen.getByRole("dialog", { name: "Отклонить документ" });
    await userEvent.type(within(dialog).getByLabelText("Причина"), "Нужна правка сумм");
    await userEvent.click(within(dialog).getByRole("button", { name: "Отклонить" }));
    expect(await screen.findByText(/^Отклонил Громов П\./)).toBeInTheDocument();
    expect(screen.getAllByText("«Нужна правка сумм»").length).toBeGreaterThan(0);
  });

  it("не найден", async () => {
    renderAt("nope");
    expect(await screen.findByText("Документ не найден")).toBeInTheDocument();
  });
});
