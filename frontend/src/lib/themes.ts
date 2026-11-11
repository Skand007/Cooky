export type ThemeId = "citrus" | "linen" | "midnight" | "charcoal";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  mode: "light" | "dark";
  swatch: string; // accent colour, for the little dot in the theme picker
  bar: string; // browser toolbar colour (theme-color meta)
}

export const THEMES: ThemeInfo[] = [
  { id: "citrus", label: "Citrus", mode: "light", swatch: "#e8590c", bar: "#fff3e3" },
  { id: "linen", label: "Linen", mode: "light", swatch: "#17785a", bar: "#eaf4ef" },
  { id: "midnight", label: "Midnight", mode: "dark", swatch: "#ffc857", bar: "#0a0a1c" },
  { id: "charcoal", label: "Charcoal", mode: "dark", swatch: "#ff6b4a", bar: "#130d0b" },
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
  const bar = THEMES.find((t) => t.id === theme)?.bar;
  if (bar) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bar);
  window.localStorage.setItem(STORAGE_KEY, theme);
}
