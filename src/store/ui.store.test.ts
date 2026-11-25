import { describe, expect, it } from "vitest";
import { applyTheme, useUiStore } from "./ui.store";

describe("ui.store", () => {
  it("тема: явный выбор — data-theme, системная — без атрибута", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("сворачивание сайдбара сохраняется в localStorage", () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    expect(localStorage.getItem("eam:ui")).toContain('"sidebarCollapsed":true');
    useUiStore.getState().toggleSidebar();
  });
});
