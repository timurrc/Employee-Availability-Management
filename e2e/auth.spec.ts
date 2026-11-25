import { expect, test } from "@playwright/test";

// Работает на моках: VITE_USE_MOCK=true в .env
test("гость попадает на вход, после выбора роли возвращается на нужный раздел", async ({
  page,
}) => {
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("button", { name: /Руководитель/ }).click();

  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("heading", { name: "Календарь команды" })).toBeVisible();
});

test("раздел больничных виден только кадровику", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Сотрудник/ }).click();
  const nav = page.getByRole("navigation", { name: "Разделы" });
  await expect(nav.getByRole("link", { name: "Больничные" })).toHaveCount(0);

  await page.getByLabel("Демо-роль").selectOption({ label: "Кадровик" });
  await expect(nav.getByRole("link", { name: "Больничные" })).toBeVisible();
});
