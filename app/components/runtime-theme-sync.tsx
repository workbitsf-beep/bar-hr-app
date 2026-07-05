"use client";

import { useEffect } from "react";
import { AppTheme } from "@prisma/client";
import { normalizeTheme, type ThemePreference } from "@/lib/theme";

function resolveTheme(preference: ThemePreference) {
  if (preference === AppTheme.LIGHT) {
    return "light";
  }

  if (preference === AppTheme.DARK) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(preference: ThemePreference) {
  const resolvedTheme = resolveTheme(preference);
  const root = document.documentElement;

  root.dataset.themePreference = preference.toLowerCase();
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
}

export function RuntimeThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    const preference = normalizeTheme(theme);
    applyTheme(preference);

    if (preference !== AppTheme.SYSTEM) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme(preference);

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, [theme]);

  return null;
}
