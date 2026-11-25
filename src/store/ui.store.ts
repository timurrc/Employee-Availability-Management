import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";

interface UiState {
  theme: Theme;
  /** Сайдбар свёрнут до иконок (на широких экранах; на планшете свёрнут всегда) */
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
}

/** Настройки интерфейса этого браузера — тема и сайдбар */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: "eam:ui" },
  ),
);

/** Тема — атрибут data-theme на <html>; «системная» — без атрибута, решает prefers-color-scheme */
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
};
