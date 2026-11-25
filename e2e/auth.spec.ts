import { expect, test } from "@playwright/test";

// Работает на моках: VITE_USE_MOCK=true в .env
test("гость попадает на вход, после выбора роли возвращается на нужный раздел", async ({
  page,
}) => {
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("button", { name: /Руководитель: Кузнецов/ }).click();

  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("heading", { name: "Календарь команды" })).toBeVisible();
});

test("раздел больничных виден только кадровику", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Сотрудник: / }).click();
  const nav = page.getByRole("navigation", { name: "Разделы" });
  await expect(nav.getByRole("link", { name: "Сегодня" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Больничные" })).toHaveCount(0);

  await page.getByRole("button", { name: /Учётная запись/ }).click();
  await page.getByRole("menuitemradio", { name: /Кадровик/ }).click();
  await expect(nav.getByRole("link", { name: "Больничные" })).toBeVisible();
});

test("поиск сотрудника открывает его карточку", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Руководитель: / }).click();
  const search = page.getByRole("combobox", { name: "Найти сотрудника" });
  await expect(search).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(search).toBeFocused();
  await page.keyboard.type("семенов");
  await expect(page.getByRole("option", { name: /Семёнов Алексей/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/employees\/e25$/);
});
