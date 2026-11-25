import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// WCAG 2.2 AA: axe на каждом экране в светлой и тёмной теме.
// Падаем на serious/critical — minor/moderate попадают в отчёт QA, но не блокируют.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const SCREENS: { path: string; heading: RegExp; account: RegExp }[] = [
  { path: "/", heading: /^Сегодня, /, account: /Руководитель/ },
  { path: "/documents?tab=all", heading: /^Документы$/, account: /Руководитель/ },
  { path: "/documents/doc1", heading: /Д-2026\/114/, account: /Сотрудник/ },
  { path: "/deadlines", heading: /^Сроки$/, account: /Сотрудник/ },
  { path: "/team", heading: /^Календарь команды$/, account: /Руководитель/ },
  { path: "/employees/e20", heading: /Новиков Сергей/, account: /Руководитель/ },
  { path: "/vacations", heading: /^Отпуска$/, account: /Руководитель/ },
  { path: "/vacations?tab=mine", heading: /^Отпуска$/, account: /Сотрудник/ },
  { path: "/sick-leaves", heading: /^Больничные$/, account: /Кадровик/ },
  { path: "/calendar", heading: /^Производственный календарь$/, account: /Администратор/ },
];

const audit = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    // Кнопка React Query Devtools есть только в dev-сборке
    .exclude(".tsqd-parent-container")
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
};

test("экран входа без серьёзных нарушений", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Руководитель: / })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(`тема ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const screen of SCREENS) {
      test(`${screen.path} без серьёзных нарушений`, async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("button", { name: screen.account }).click();
        await expect(page.getByRole("heading", { name: /^Сегодня, / })).toBeVisible();
        await page.goto(screen.path);
        await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
        // Скелетоны сменились данными
        await expect(page.getByRole("status", { name: "Загрузка" })).toHaveCount(0);
        expect(await audit(page)).toEqual([]);
      });
    }
  });
}
