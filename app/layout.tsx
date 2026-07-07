import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { PwaRegister } from "@/app/components/pwa-register";
import { PasskeySetupPrompt } from "@/app/components/passkey-setup-prompt";
import { RuntimeLanguageSync } from "@/app/components/runtime-language-sync";
import { RuntimeThemeSync } from "@/app/components/runtime-theme-sync";
import { ViewportResizeSync } from "@/app/components/viewport-resize-sync";
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
                overscroll-behavior-x: none;
                background: #f7f3ff;
              }

              body {
                width: 100%;
                max-width: 100%;
                min-height: var(--workbit-vh, 100dvh);
                overflow-x: hidden;
                overscroll-behavior-x: none;
              }

              *,
              *::before,
              *::after {
                box-sizing: border-box;
              }

              :root {
                --workbit-vw: 100vw;
                --workbit-vh: 100dvh;
                --workbit-orientation: portrait;
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
                color-scheme: light;
                --workbit-background: #e5dbff;
                --workbit-surface: #f7f2ff;
                --workbit-surface-secondary: #eadfff;
                --workbit-surface-elevated: #fbf8ff;
                --workbit-field-bg: #ffffff;
                --workbit-popup: #f7f2ff;
                --workbit-navigation: linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(238,231,255,0.82) 46%, rgba(216,199,255,0.76) 100%);
                --workbit-calendar: #f7f2ff;
                --workbit-navy: #160f2f;
                --workbit-deep-navy: #24124f;
                --workbit-ink: #160f2f;
                --workbit-text: #160f2f;
                --workbit-text-secondary: #594b75;
                --workbit-muted: #76678d;
                --workbit-purple: #7c3aed;
                --workbit-electric-purple: #a855f7;
                --workbit-purple-dark: #5b21b6;
                --workbit-purple-soft: #e5dbff;
                --workbit-lavender: #d8c7ff;
                --workbit-border: rgba(124, 58, 237, 0.22);
                --workbit-card: linear-gradient(180deg, rgba(251,248,255,0.98) 0%, rgba(229,219,255,0.97) 100%);
                --workbit-app-bg: radial-gradient(circle at 86% 2%, rgba(168,85,247,0.28), transparent 29%),
                  radial-gradient(circle at 12% 4%, rgba(124,58,237,0.16), transparent 26%),
                  linear-gradient(180deg, #f7f2ff 0%, #e5dbff 52%, #d9c9ff 100%);
                --workbit-gradient: linear-gradient(135deg, #28164f 0%, #7c3aed 52%, #a855f7 100%);
                --workbit-gradient-soft: linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(168,85,247,0.16) 100%);
                --workbit-shadow: 0 18px 42px rgba(91, 33, 182, 0.16);
                --workbit-shadow-strong: 0 24px 58px rgba(91, 33, 182, 0.22);
                --workbit-focus: 0 0 0 4px rgba(168, 85, 247, 0.20);
                --workbit-success: #16a34a;
                --workbit-warning: #f59e0b;
                --workbit-danger: #ef4444;
                --workbit-info: #0284c7;
                --workbit-badge: #eadfff;
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
                border-color: rgba(196, 181, 253, 0.20);
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
          minHeight: "var(--workbit-vh, 100dvh)",
          overflowX: "hidden",
        }}
      >
        <ViewportResizeSync />
        <RuntimeLanguageSync language={htmlLang} />
        <RuntimeThemeSync theme={themePreference} />
        <PwaRegister />
        <PasskeySetupPrompt />
        {children}
      </body>
    </html>
  );
}
