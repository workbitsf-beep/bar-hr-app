"use client";

import { useState } from "react";
import { AppTheme } from "@prisma/client";
import {
  THEME_COOKIE_NAME,
  getThemeOptions,
  normalizeTheme,
  type ThemePreference,
} from "@/lib/theme";

function resolveTheme(preference: ThemePreference) {
  if (preference === AppTheme.LIGHT) return "light";
  if (preference === AppTheme.DARK) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(preference: ThemePreference) {
  const resolvedTheme = resolveTheme(preference);
  const root = document.documentElement;

  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = preference.toLowerCase();
  root.style.colorScheme = resolvedTheme;
  document.cookie = `${THEME_COOKIE_NAME}=${preference}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute("content", resolvedTheme === "dark" ? "#12083c" : "#f7f3ff");
}

export function ThemeSelect({
  defaultValue,
  label = "Tema",
}: {
  defaultValue: string;
  label?: string;
}) {
  const [value, setValue] = useState<ThemePreference>(() => normalizeTheme(defaultValue));
  const [saving, setSaving] = useState(false);

  async function handleChange(nextValue: string) {
    const nextTheme = normalizeTheme(nextValue);
    setValue(nextTheme);
    applyTheme(nextTheme);
    setSaving(true);

    try {
      await fetch("/api/user/theme", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: nextTheme }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="workbit-theme-select">
      <span>{label}</span>
      <select
        value={value}
        aria-label={label}
        disabled={saving}
        onChange={(event) => void handleChange(event.target.value)}
      >
        {getThemeOptions().map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
