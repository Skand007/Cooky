export type ThemeId = "citrus" | "linen" | "midnight" | "charcoal";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  mode: "light" | "dark";
  swatch: string; // accent color, for the little dot in the theme picker
}

export const THEMES: ThemeInfo[] = [
  { id: "citrus", label: "Citrus", mode: "light", swatch: "#f6871f" },
  { id: "linen", label: "Linen", mode: "light", swatch: "#7a8b5c" },
  { id: "midnight", label: "Midnight", mode: "dark", swatch: "#f6c453" },
  { id: "charcoal", label: "Charcoal", mode: "dark", swatch: "#e2583e" },
];

const STORAGE_KEY = "cooky-theme";
const DEFAULT_THEME: ThemeId = "citrus";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.some((t) => t.id === stored)) return stored as ThemeId;
  // Fall back to the visitor's OS preference on first visit.
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "midnight" : DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute("data-theme", theme);
  const mode = THEMES.find((t) => t.id === theme)?.mode ?? "light";
  document.documentElement.classList.toggle("dark", mode === "dark");
  window.localStorage.setItem(STORAGE_KEY, theme);
}
