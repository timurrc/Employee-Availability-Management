import { expect, test, type Page } from "@playwright/test";

// Доступ по ролям и прямые ссылки. Работает на моках: VITE_USE_MOCK=true в .env
const loginAs = async (page: Page, account: RegExp) => {
  await page.goto("/login");
  await page.getByRole("button", { name: account }).click();
  await expect(page.getByRole("heading", { name: /^Сегодня, / })).toBeVisible();
};

test("сотрудник по прямой ссылке на больничные попадает на «Сегодня»", async ({ page }) => {
  await loginAs(page, /Сотрудник/);
  await page.goto("/sick-leaves");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /^Сегодня, / })).toBeVisible();
});

test("правка производственного календаря доступна только администратору", async ({ page }) => {
  await loginAs(page, /Руководитель/);
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Производственный календарь" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Импорт/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Учётная запись/ }).click();
  await page.getByRole("menuitemradio", { name: /Администратор/ }).click();
  await expect(page.getByRole("button", { name: /Импорт JSON/ }).first()).toBeVisible();
});

test("неизвестный адрес показывает 404 со ссылкой на главную", async ({ page }) => {
  await loginAs(page, /Сотрудник/);
  await page.goto("/no-such-page");
  await expect(page.getByRole("link", { name: /главн|Сегодня/i }).last()).toBeVisible();
});

test("ссылка с фильтрами переживает вход", async ({ page }) => {
  await page.goto("/documents?tab=all");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: /Руководитель: / }).click();
  await expect(page).toHaveURL(/\/documents\?tab=all$/);
});
