import { AppTheme } from "@prisma/client";

export const THEME_COOKIE_NAME = "preferred-theme";

export type ThemePreference = AppTheme;
export type ResolvedTheme = "light" | "dark";

export function normalizeTheme(value: unknown): ThemePreference {
  const raw = String(value ?? "").trim().toUpperCase();

  if (raw === AppTheme.LIGHT || raw === AppTheme.DARK || raw === AppTheme.SYSTEM) {
    return raw;
  }

  return AppTheme.SYSTEM;
}

export function getThemeOptions() {
  return [
    { value: AppTheme.SYSTEM, label: "Automatico" },
    { value: AppTheme.LIGHT, label: "Chiaro" },
    { value: AppTheme.DARK, label: "Scuro" },
  ];
}

export function getThemeCookieValue(value: unknown) {
  return normalizeTheme(value);
}
