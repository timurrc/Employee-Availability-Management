import { expect, test, type Page } from "@playwright/test";

// Работает на моках: VITE_USE_MOCK=true в .env, даты моков — от сегодняшнего дня
const loginAs = async (page: Page, account: RegExp) => {
  await page.goto("/login");
  await page.getByRole("button", { name: account }).click();
  await expect(page.getByRole("heading", { name: /^Сегодня, / })).toBeVisible();
};

const nav = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Разделы" }).getByRole("link", { name }).click();

test("HR открывает больничный, видит последствия и закрывает его", async ({ page }) => {
  await loginAs(page, /Кадровик/);
  await nav(page, "Больничные");
  await expect(page.getByText(/пересечение с отпуском ждёт решения/)).toBeVisible();

  await page.getByRole("button", { name: "Открыть больничный" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Открыть больничный" });
  await sheet.getByLabel("Сотрудник").selectOption("e04");
  await expect(sheet.getByRole("region", { name: "Что это задевает" })).toContainText(
    "Согласованный отпуск",
  );
  await sheet.getByLabel("Номер ЭЛН").fill("9100 0012 3456");
  await sheet.getByRole("button", { name: "Открыть больничный" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Больничный открыт: Громов П.")).toBeVisible();

  const row = page.getByTestId("sick-row").filter({ hasText: "Громов" });
  await row.getByRole("button", { name: "Закрыть" }).click();
  const dialog = page.getByRole("dialog", { name: "Закрыть больничный" });
  await expect(dialog).toContainText("(ст. 124 ТК РФ)");
  await dialog.getByRole("button", { name: "Закрыть больничный" }).click();
  await expect(page.getByText(/^Отпуск продлён до/)).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("администратор правит день производственного календаря", async ({ page }) => {
  await loginAs(page, /Администратор/);
  await nav(page, "Календарь");
  await page.getByRole("button", { name: "Следующий год" }).click();
  await expect(page.getByText("✓ как в постановлении")).toBeVisible();

  await page.getByRole("button", { name: /^30 декабря 2027/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Праздник" }).check();
  await dialog.getByRole("button", { name: "Применить" }).click();
  await expect(
    page.getByText("Проверьте: 246 рабочих дней, по постановлению — 247."),
  ).toBeVisible();
});
