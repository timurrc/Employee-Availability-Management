import { expect, test, type Page } from "@playwright/test";

// Работает на моках: VITE_USE_MOCK=true в .env, даты моков — от сегодняшнего дня
const inputDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [date.getDate(), date.getMonth() + 1, date.getFullYear()]
    .map((part, index) => String(part).padStart(index < 2 ? 2 : 4, "0"))
    .join(".");
};

const loginAs = async (page: Page, account: RegExp) => {
  await page.goto("/login");
  await page.getByRole("button", { name: account }).click();
  await expect(page.getByRole("heading", { name: /^Сегодня, / })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Отпуска" })
    .click();
};

test("сотрудник подаёт заявку, руководитель согласует её в очереди", async ({ page }) => {
  await loginAs(page, /Сотрудник: Абрамов/);
  await page.getByRole("button", { name: "Новая заявка" }).click();

  const sheet = page.getByRole("dialog", { name: "Новая заявка на отпуск" });
  await sheet.getByLabel("С", { exact: true }).fill(inputDate(100));
  await sheet.getByLabel("По", { exact: true }).fill(inputDate(106));
  await expect(sheet.getByRole("region", { name: "Расчёт" })).toContainText("спишется с баланса");
  await sheet.getByRole("button", { name: "Отправить руководителю" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(/^Заявка отправлена/)).toBeVisible();

  // Смена роли без выхода — переключатель в шапке
  await page.getByRole("button", { name: /Учётная запись/ }).click();
  await page.getByRole("menuitemradio", { name: /Руководитель/ }).click();
  await expect(page.getByRole("button", { name: /Учётная запись: Кузнецов/ })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Отпуска" })
    .click();
  await expect(page.getByRole("heading", { name: "На согласовании · 4" })).toBeVisible();
  const queue = page.getByRole("list", { name: "Заявки на согласовании" });
  const row = queue.getByRole("listitem").filter({ hasText: "Абрамов" }).last();
  await row.getByRole("button", { name: "Согласовать" }).click();
  await expect(page.getByText(/^Отпуск согласован: Абрамов/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "На согласовании · 3" })).toBeVisible();
});
