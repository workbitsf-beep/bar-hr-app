"use client";

import { useMemo, useState } from "react";
import { AppTheme } from "@prisma/client";
import { THEME_COOKIE_NAME, getThemeOptions, normalizeTheme, type ThemePreference } from "@/lib/theme";

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
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = preference.toLowerCase();
  document.documentElement.style.colorScheme = resolvedTheme;
  document.cookie = `${THEME_COOKIE_NAME}=${preference}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function ThemeSelect({
  defaultValue,
  label = "Tema",
}: {
  defaultValue: string;
  label?: string;
}) {
  const options = useMemo(() => getThemeOptions(), []);
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
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ theme: nextTheme }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "var(--workbit-muted)", fontSize: 13, fontWeight: 800 }}>
        {label}
      </span>
      <select
        value={value}
        aria-label={label}
        onChange={(event) => void handleChange(event.target.value)}
        style={{
          width: "100%",
          border: "1px solid var(--workbit-border)",
          borderRadius: 16,
          padding: "10px 38px 10px 12px",
          background: "var(--workbit-surface)",
          color: "var(--workbit-text)",
          fontWeight: 800,
          appearance: "none",
          opacity: saving ? 0.75 : 1,
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
