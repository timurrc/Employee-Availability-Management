import { expect, test, type Page } from "@playwright/test";

// Работает на моках: VITE_USE_MOCK=true в .env, даты моков — от сегодняшнего дня
const loginAsEmployee = async (page: Page) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Сотрудник: Абрамов/ }).click();
  await expect(page.getByRole("heading", { name: /^Сегодня, / })).toBeVisible();
};

test("«Сегодня»: передать этап заместителю одним действием и отменить", async ({ page }) => {
  await loginAsEmployee(page);
  const actions = page.getByRole("region", { name: "Ждут вашего действия" });
  await actions.getByRole("button", { name: "Передать заместителю" }).click();
  await expect(page.getByText(/^Этап передан: /)).toBeVisible();
  await expect(actions).toBeHidden();
  await page.getByRole("button", { name: "Отменить" }).click();
  await expect(
    page.getByRole("region", { name: "Ждут вашего действия" }).getByRole("button", {
      name: "Передать заместителю",
    }),
  ).toBeVisible();
});

test("черновик: передать отсутствующих заместителям и отправить на согласование", async ({
  page,
}) => {
  await loginAsEmployee(page);
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Документы" })
    .click();
  await page.getByRole("link", { name: /Служебная записка о закупке/ }).click();

  await expect(page.getByText(/согласующих отсутствуют в даты своего этапа/)).toBeVisible();
  await page.getByRole("button", { name: /^Передать заместителям/ }).click();
  await expect(page.getByText("Риск срока")).toHaveCount(0);

  await page.getByRole("button", { name: "Удалить этап 2" }).click();
  await page.getByRole("button", { name: "Отменить" }).click();
  await expect(page.getByTestId("route-step")).toHaveCount(3);

  await page.getByRole("button", { name: "Отправить на согласование" }).click();
  await expect(page.getByText(/^Отправлено: сейчас у/)).toBeVisible();
  await expect(page.getByText(/этап 1 из 3/)).toBeVisible();
});

test("калькулятор сроков: параметры в URL, разбор через Новый год", async ({ page }) => {
  await loginAsEmployee(page);
  await page.goto("/deadlines?from=2026-12-28&days=5");
  await expect(page.getByTestId("calc-result")).toHaveText("13 января 2027, среда");
  await page.getByLabel("Рабочих дней (+/−)").fill("2");
  await expect(page.getByTestId("calc-result")).toHaveText("30 декабря 2026, среда");
  await expect(page).toHaveURL(/days=2/);
});
