import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { PwaRegister } from "@/app/components/pwa-register";
import { PasskeySetupPrompt } from "@/app/components/passkey-setup-prompt";
import { RuntimeLanguageSync } from "@/app/components/runtime-language-sync";
import { RuntimeThemeSync } from "@/app/components/runtime-theme-sync";
import { LANGUAGE_COOKIE_NAME, normalizeLanguage } from "@/lib/language";
import { THEME_COOKIE_NAME, normalizeTheme } from "@/lib/theme";

type RootLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "Workbit",
  applicationName: "Workbit",
  manifest: "/manifest.webmanifest",
  description: "Gestione turni, timbrature, richieste e comunicazioni con Workbit.",
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/apple-icon",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Workbit",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f3ff",
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const htmlLang = normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value ?? "it");
  const themePreference = normalizeTheme(cookieStore.get(THEME_COOKIE_NAME)?.value ?? "SYSTEM");

  return (
    <html lang={htmlLang} data-theme-preference={themePreference.toLowerCase()}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var preference = ${JSON.stringify(themePreference)};
                  var resolved = preference === "DARK" ? "dark" : preference === "LIGHT" ? "light" : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                  document.documentElement.dataset.theme = resolved;
                  document.documentElement.dataset.themePreference = preference.toLowerCase();
                  document.documentElement.style.colorScheme = resolved;
                } catch (error) {
                  document.documentElement.dataset.theme = "light";
                  document.documentElement.style.colorScheme = "light";
                }
              })();
            `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html {
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
                background: #f7f3ff;
              }

              body {
                width: 100%;
                max-width: 100%;
                min-height: 100dvh;
                overflow-x: hidden;
              }

              *,
              *::before,
              *::after {
                box-sizing: border-box;
              }

              :root {
                --workbit-background: #f7f3ff;
                --workbit-surface: #ffffff;
                --workbit-surface-secondary: #f8fafc;
                --workbit-surface-elevated: #ffffff;
                --workbit-field-bg: #ffffff;
                --workbit-popup: #ffffff;
                --workbit-navigation: rgba(255,255,255,0.92);
                --workbit-calendar: #ffffff;
                --workbit-navy: #0b1024;
                --workbit-deep-navy: #111827;
                --workbit-ink: #111827;
                --workbit-text: #111827;
                --workbit-text-secondary: #667085;
                --workbit-muted: #667085;
                --workbit-purple: #7b2ff7;
                --workbit-electric-purple: #a855f7;
                --workbit-purple-dark: #5b21b6;
                --workbit-purple-soft: #f7f3ff;
                --workbit-lavender: #ede9fe;
                --workbit-border: rgba(124, 58, 237, 0.16);
                --workbit-card: linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(247,243,255,0.97) 100%);
                --workbit-app-bg: radial-gradient(circle at 88% 2%, rgba(168,85,247,0.16), transparent 28%),
                  radial-gradient(circle at 8% 4%, rgba(91,33,182,0.08), transparent 26%),
                  linear-gradient(180deg, #ffffff 0%, #f7f3ff 100%);
                --workbit-gradient: linear-gradient(135deg, #0b1024 0%, #5b21b6 48%, #a855f7 100%);
                --workbit-gradient-soft: linear-gradient(135deg, rgba(11,16,36,0.08) 0%, rgba(91,33,182,0.10) 45%, rgba(168,85,247,0.14) 100%);
                --workbit-shadow: 0 20px 52px rgba(124, 58, 237, 0.12);
                --workbit-shadow-strong: 0 24px 62px rgba(11, 16, 36, 0.18);
                --workbit-focus: 0 0 0 4px rgba(168, 85, 247, 0.18);
                --workbit-success: #16a34a;
                --workbit-warning: #f59e0b;
                --workbit-danger: #ef4444;
                --workbit-info: #0284c7;
                --workbit-badge: #f5f3ff;
              }

              html[data-theme="dark"] {
                color-scheme: dark;
                --workbit-background: #08071a;
                --workbit-surface: #15112c;
                --workbit-surface-secondary: #1b1538;
                --workbit-surface-elevated: #211944;
                --workbit-field-bg: #110d27;
                --workbit-popup: #17122f;
                --workbit-navigation: linear-gradient(135deg, rgba(17,13,36,0.92) 0%, rgba(29,22,58,0.94) 48%, rgba(41,30,82,0.90) 100%);
                --workbit-calendar: #15112c;
                --workbit-navy: #f8fafc;
                --workbit-deep-navy: #f1f5f9;
                --workbit-ink: #f8fafc;
                --workbit-text: #f8fafc;
                --workbit-text-secondary: #d5cfee;
                --workbit-muted: #b4abc9;
                --workbit-purple: #b78cff;
                --workbit-electric-purple: #c084fc;
                --workbit-purple-dark: #e9d5ff;
                --workbit-purple-soft: #271d4c;
                --workbit-lavender: #34265f;
                --workbit-border: rgba(216, 199, 255, 0.24);
                --workbit-card: linear-gradient(160deg, rgba(33,25,68,0.98) 0%, rgba(20,16,43,0.98) 58%, rgba(15,13,33,0.98) 100%);
                --workbit-app-bg: radial-gradient(circle at 86% 0%, rgba(168,85,247,0.24), transparent 31%),
                  radial-gradient(circle at 15% 6%, rgba(124,58,237,0.16), transparent 28%),
                  radial-gradient(circle at 55% 98%, rgba(192,132,252,0.10), transparent 32%),
                  linear-gradient(180deg, #090720 0%, #120d2b 48%, #0b0a1f 100%);
                --workbit-gradient: linear-gradient(135deg, #20124c 0%, #7c3aed 52%, #c084fc 100%);
                --workbit-gradient-soft: linear-gradient(135deg, rgba(124,58,237,0.24) 0%, rgba(192,132,252,0.16) 100%);
                --workbit-shadow: 0 18px 48px rgba(0, 0, 0, 0.30), 0 0 28px rgba(124, 58, 237, 0.10);
                --workbit-shadow-strong: 0 26px 68px rgba(0, 0, 0, 0.46), 0 0 40px rgba(168, 85, 247, 0.14);
                --workbit-focus: 0 0 0 4px rgba(192, 132, 252, 0.22);
                --workbit-success: #4ade80;
                --workbit-warning: #f59e0b;
                --workbit-danger: #fb7185;
                --workbit-info: #38bdf8;
                --workbit-badge: rgba(192, 132, 252, 0.16);
              }

              html,
              body,
              .dashboard-shell,
              .dashboard-main {
                transition: background-color 140ms ease, background 140ms ease, color 140ms ease, border-color 140ms ease;
              }

              html[data-theme="dark"] body {
                background: var(--workbit-app-bg) !important;
                color: var(--workbit-text) !important;
              }

              html[data-theme="dark"] .dashboard-shell,
              html[data-theme="dark"] .dashboard-main,
              html[data-theme="dark"] .dashboard-shell-inner {
                color: var(--workbit-text) !important;
              }

              html[data-theme="dark"] .dashboard-shell-card,
              html[data-theme="dark"] .dashboard-panel,
              html[data-theme="dark"] .dashboard-item-card,
              html[data-theme="dark"] .dashboard-compact-list-item,
              html[data-theme="dark"] .dashboard-list-card,
              html[data-theme="dark"] .dashboard-week-card,
              html[data-theme="dark"] .dashboard-modal-panel,
              html[data-theme="dark"] .dashboard-card {
                background: var(--workbit-card) !important;
                border-color: var(--workbit-border) !important;
                color: var(--workbit-text) !important;
                box-shadow: var(--workbit-shadow) !important;
              }

              html[data-theme="dark"] .dashboard-panel *,
              html[data-theme="dark"] .dashboard-shell-card *,
              html[data-theme="dark"] .dashboard-item-card *,
              html[data-theme="dark"] .dashboard-compact-list-item *,
              html[data-theme="dark"] .dashboard-modal-panel * {
                border-color: rgba(216, 199, 255, 0.18);
              }

              html[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]),
              html[data-theme="dark"] select,
              html[data-theme="dark"] textarea {
                background: var(--workbit-surface-secondary) !important;
                color: var(--workbit-text) !important;
                border-color: var(--workbit-border) !important;
              }

              html[data-theme="dark"] input::placeholder,
              html[data-theme="dark"] textarea::placeholder {
                color: #94a3b8 !important;
              }

              html[data-theme="dark"] option {
                background: var(--workbit-surface-secondary);
                color: var(--workbit-text);
              }

              html[data-theme="dark"] strong,
              html[data-theme="dark"] h1,
              html[data-theme="dark"] h2,
              html[data-theme="dark"] h3,
              html[data-theme="dark"] h4 {
                color: var(--workbit-text) !important;
              }

              html[data-theme="dark"] .dashboard-panel p,
              html[data-theme="dark"] .dashboard-panel label,
              html[data-theme="dark"] .dashboard-panel small,
              html[data-theme="dark"] .dashboard-shell-card p,
              html[data-theme="dark"] .dashboard-shell-card label,
              html[data-theme="dark"] .dashboard-shell-card small {
                color: var(--workbit-text-secondary);
              }

              html[data-theme="dark"] a {
                color: var(--workbit-purple-dark);
              }

              html[data-theme="dark"] [style*="color: #0f172a"],
              html[data-theme="dark"] [style*="color:#0f172a"],
              html[data-theme="dark"] [style*="color: #111827"],
              html[data-theme="dark"] [style*="color:#111827"],
              html[data-theme="dark"] [style*="color: rgb(15, 23, 42)"],
              html[data-theme="dark"] [style*="color: rgb(17, 24, 39)"] {
                color: var(--workbit-text) !important;
              }

              html[data-theme="dark"] [style*="color: #334155"],
              html[data-theme="dark"] [style*="color:#334155"],
              html[data-theme="dark"] [style*="color: #475569"],
              html[data-theme="dark"] [style*="color:#475569"],
              html[data-theme="dark"] [style*="color: #64748b"],
              html[data-theme="dark"] [style*="color:#64748b"],
              html[data-theme="dark"] [style*="color: #667085"],
              html[data-theme="dark"] [style*="color:#667085"],
              html[data-theme="dark"] [style*="color: #6b7280"],
              html[data-theme="dark"] [style*="color:#6b7280"],
              html[data-theme="dark"] [style*="color: rgb(51, 65, 85)"],
              html[data-theme="dark"] [style*="color: rgb(71, 85, 105)"],
              html[data-theme="dark"] [style*="color: rgb(100, 116, 139)"],
              html[data-theme="dark"] [style*="color: rgb(102, 112, 133)"],
              html[data-theme="dark"] [style*="color: rgb(107, 114, 128)"] {
                color: var(--workbit-text-secondary) !important;
              }

              html[data-theme="dark"] [style*="color: #5b21b6"],
              html[data-theme="dark"] [style*="color:#5b21b6"],
              html[data-theme="dark"] [style*="color: #6d28d9"],
              html[data-theme="dark"] [style*="color:#6d28d9"],
              html[data-theme="dark"] [style*="color: #7c3aed"],
              html[data-theme="dark"] [style*="color:#7c3aed"] {
                color: var(--workbit-purple-dark) !important;
              }

              html[data-theme="dark"] [style*="color: #166534"],
              html[data-theme="dark"] [style*="color:#166534"],
              html[data-theme="dark"] [style*="color: #15803d"],
              html[data-theme="dark"] [style*="color:#15803d"] {
                color: #166534 !important;
              }

              html[data-theme="dark"] [style*="color: #92400e"],
              html[data-theme="dark"] [style*="color:#92400e"],
              html[data-theme="dark"] [style*="color: #9a3412"],
              html[data-theme="dark"] [style*="color:#9a3412"] {
                color: #92400e !important;
              }

              html[data-theme="dark"] [style*="color: #991b1b"],
              html[data-theme="dark"] [style*="color:#991b1b"],
              html[data-theme="dark"] [style*="color: #b91c1c"],
              html[data-theme="dark"] [style*="color:#b91c1c"] {
                color: #991b1b !important;
              }

              html[data-theme="dark"] .dashboard-shell [style*="background: #ffffff"],
              html[data-theme="dark"] .dashboard-shell [style*="background:#ffffff"],
              html[data-theme="dark"] .dashboard-shell [style*="background: #fff"],
              html[data-theme="dark"] .dashboard-shell [style*="background:#fff"],
              html[data-theme="dark"] .dashboard-shell [style*="background: rgb(255, 255, 255)"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color: #ffffff"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color:#ffffff"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color: rgb(255, 255, 255)"] {
                background: var(--workbit-surface) !important;
              }

              html[data-theme="dark"] .dashboard-shell [style*="background: #f8fafc"],
              html[data-theme="dark"] .dashboard-shell [style*="background:#f8fafc"],
              html[data-theme="dark"] .dashboard-shell [style*="background: #f1f5f9"],
              html[data-theme="dark"] .dashboard-shell [style*="background:#f1f5f9"],
              html[data-theme="dark"] .dashboard-shell [style*="background: #f7f3ff"],
              html[data-theme="dark"] .dashboard-shell [style*="background:#f7f3ff"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color: #f8fafc"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color:#f8fafc"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color: #f1f5f9"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color:#f1f5f9"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color: #f7f3ff"],
              html[data-theme="dark"] .dashboard-shell [style*="background-color:#f7f3ff"],
              html[data-theme="dark"] .dashboard-shell [style*="background: rgb(248, 250, 252)"],
              html[data-theme="dark"] .dashboard-shell [style*="background: rgb(241, 245, 249)"] {
                background: var(--workbit-surface-secondary) !important;
              }

              html[data-theme="dark"] [style*="background: #dcfce7"],
              html[data-theme="dark"] [style*="background:#dcfce7"],
              html[data-theme="dark"] [style*="background: #f0fdf4"],
              html[data-theme="dark"] [style*="background:#f0fdf4"],
              html[data-theme="dark"] [style*="background-color: #dcfce7"],
              html[data-theme="dark"] [style*="background-color:#dcfce7"] {
                background: #dcfce7 !important;
                border-color: #bbf7d0 !important;
              }

              html[data-theme="dark"] [style*="background: #fffbeb"],
              html[data-theme="dark"] [style*="background:#fffbeb"],
              html[data-theme="dark"] [style*="background: #fff7ed"],
              html[data-theme="dark"] [style*="background:#fff7ed"],
              html[data-theme="dark"] [style*="background-color: #fffbeb"],
              html[data-theme="dark"] [style*="background-color:#fffbeb"] {
                background: #fffbeb !important;
                border-color: #fde68a !important;
              }

              html[data-theme="dark"] [style*="background: #fef2f2"],
              html[data-theme="dark"] [style*="background:#fef2f2"],
              html[data-theme="dark"] [style*="background: #fff1f2"],
              html[data-theme="dark"] [style*="background:#fff1f2"],
              html[data-theme="dark"] [style*="background-color: #fef2f2"],
              html[data-theme="dark"] [style*="background-color:#fef2f2"] {
                background: #fef2f2 !important;
                border-color: #fecaca !important;
              }

              html[data-theme="dark"] .dashboard-bottom-nav,
              html[data-theme="dark"] nav {
                background: var(--workbit-navigation) !important;
                border-color: var(--workbit-border) !important;
                box-shadow: var(--workbit-shadow-strong) !important;
              }

              html[data-theme="dark"] .dashboard-bottom-nav a,
              html[data-theme="dark"] .dashboard-bottom-nav button {
                color: var(--workbit-text) !important;
                background: linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(234,223,255,0.78) 100%) !important;
                border-color: var(--workbit-border) !important;
              }

              html[data-theme="dark"] .dashboard-button,
              html[data-theme="dark"] button[style*="linear-gradient(135deg"],
              html[data-theme="dark"] a[style*="linear-gradient(135deg"] {
                color: #ffffff !important;
              }

              html[data-theme="dark"] .dashboard-button[style*="background: linear-gradient(180deg"] {
                background: linear-gradient(180deg, var(--workbit-surface-secondary) 0%, var(--workbit-purple-soft) 100%) !important;
                color: var(--workbit-text) !important;
                border-color: var(--workbit-border) !important;
              }

              html[data-theme="dark"] input[type="date"],
              html[data-theme="dark"] input[type="month"],
              html[data-theme="dark"] input[type="time"] {
                color-scheme: light;
              }

              input,
              select,
              textarea,
              button {
                font: inherit;
              }

              input:not([type="checkbox"]):not([type="radio"]),
              select,
              textarea {
                max-width: 100%;
              }

              input:not([type="checkbox"]):not([type="radio"]):focus,
              select:focus,
              textarea:focus,
              button:focus-visible,
              a:focus-visible {
                outline: none;
                box-shadow: var(--workbit-focus);
                border-color: rgba(168, 85, 247, 0.42);
              }

              input::placeholder,
              textarea::placeholder {
                color: #94a3b8;
              }

              input[type="file"]::file-selector-button {
                border: 1px solid var(--workbit-border);
                border-radius: 999px;
                background: linear-gradient(180deg, var(--workbit-surface) 0%, var(--workbit-purple-soft) 100%);
                color: var(--workbit-purple-dark);
                font-weight: 800;
                padding: 8px 12px;
                margin-right: 12px;
                cursor: pointer;
              }

              ::selection {
                background: rgba(124, 58, 237, 0.18);
                color: var(--workbit-ink);
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily:
            '"SF Pro Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
          background: "var(--workbit-app-bg)",
          color: "var(--workbit-ink)",
          width: "100%",
          maxWidth: "100%",
          minHeight: "100dvh",
          overflowX: "hidden",
        }}
      >
        <RuntimeLanguageSync language={htmlLang} />
        <RuntimeThemeSync theme={themePreference} />
        <PwaRegister />
        <PasskeySetupPrompt />
        {children}
      </body>
    </html>
  );
}
