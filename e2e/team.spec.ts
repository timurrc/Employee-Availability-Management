import { expect, test } from "@playwright/test";

// Работает на моках: VITE_USE_MOCK=true в .env, даты моков — от сегодняшнего дня
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Руководитель: Кузнецов/ }).click();
  await expect(page.getByRole("heading", { name: /^Сегодня, / })).toBeVisible();
});

test("«Сегодня»: из списка отсутствующих — в карточку сотрудника", async ({ page }) => {
  await expect(page.getByText("3 заявки на отпуск ждут решения")).toBeVisible();

  const absent = page.locator("section", {
    has: page.getByRole("heading", { name: /^Отсутствуют/ }),
  });
  await absent.getByRole("radio", { name: "Все" }).click();
  await absent.getByRole("link", { name: "Громов Павел Олегович" }).click();

  await expect(page).toHaveURL(/\/employees\/e04$/);
  await expect(page.getByRole("heading", { name: "Громов Павел Олегович" })).toBeVisible();
  await expect(page.getByText(/^В отпуске до .+ включительно$/)).toBeVisible();
});

test("календарь команды: масштаб в URL, карточка отсутствия по клику", async ({ page }) => {
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Команда" })
    .click();
  await expect(page.getByRole("heading", { name: "Календарь команды" })).toBeVisible();

  await page.getByRole("radio", { name: "Квартал" }).click();
  await expect(page).toHaveURL(/scale=quarter/);
  await page.getByRole("radio", { name: "2 нед" }).click();

  const cell = page
    .getByRole("gridcell", { name: /^Мельников Р\., .+: командировка, согласована$/ })
    .first();
  await cell.click();
  const card = page.getByRole("dialog", { name: /Командировка: Мельников/ });
  await expect(card).toBeVisible();
  await expect(card.getByText("Конференция, Казань")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(cell).toBeFocused();
});
