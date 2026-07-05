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
                --workbit-background: #070a18;
                --workbit-surface: #0f1530;
                --workbit-surface-secondary: #111936;
                --workbit-popup: #101733;
                --workbit-navigation: rgba(12, 17, 38, 0.92);
                --workbit-calendar: #111936;
                --workbit-navy: #f8fafc;
                --workbit-deep-navy: #eef2ff;
                --workbit-ink: #f8fafc;
                --workbit-text: #f8fafc;
                --workbit-text-secondary: #cbd5e1;
                --workbit-muted: #cbd5e1;
                --workbit-purple: #a855f7;
                --workbit-electric-purple: #c084fc;
                --workbit-purple-dark: #ddd6fe;
                --workbit-purple-soft: #151b3a;
                --workbit-lavender: #2b2054;
                --workbit-border: rgba(192, 132, 252, 0.28);
                --workbit-card: linear-gradient(180deg, rgba(17,25,54,0.98) 0%, rgba(11,16,36,0.98) 100%);
                --workbit-app-bg: radial-gradient(circle at 82% 0%, rgba(168,85,247,0.22), transparent 30%),
                  radial-gradient(circle at 12% 8%, rgba(124,58,237,0.18), transparent 24%),
                  linear-gradient(180deg, #070a18 0%, #0b1024 100%);
                --workbit-gradient: linear-gradient(135deg, #1d1647 0%, #7c3aed 48%, #c084fc 100%);
                --workbit-gradient-soft: linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(168,85,247,0.16) 45%, rgba(192,132,252,0.18) 100%);
                --workbit-shadow: 0 20px 52px rgba(0, 0, 0, 0.32);
                --workbit-shadow-strong: 0 24px 62px rgba(0, 0, 0, 0.46);
                --workbit-focus: 0 0 0 4px rgba(192, 132, 252, 0.24);
                --workbit-success: #4ade80;
                --workbit-warning: #fbbf24;
                --workbit-danger: #fb7185;
                --workbit-info: #38bdf8;
                --workbit-badge: rgba(124, 58, 237, 0.18);
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

              html[data-theme="dark"] .dashboard-panel,
              html[data-theme="dark"] .dashboard-item-card,
              html[data-theme="dark"] .dashboard-list-card,
              html[data-theme="dark"] .dashboard-week-card,
              html[data-theme="dark"] .dashboard-modal-panel,
              html[data-theme="dark"] .dashboard-card,
              html[data-theme="dark"] section[class*="dashboard"],
              html[data-theme="dark"] article[class*="dashboard"] {
                background: var(--workbit-card) !important;
                border-color: var(--workbit-border) !important;
                color: var(--workbit-text) !important;
                box-shadow: var(--workbit-shadow) !important;
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
                color: #94a3b8;
              }

              html[data-theme="dark"] strong,
              html[data-theme="dark"] h1,
              html[data-theme="dark"] h2,
              html[data-theme="dark"] h3 {
                color: var(--workbit-text) !important;
              }

              html[data-theme="dark"] p,
              html[data-theme="dark"] span,
              html[data-theme="dark"] label,
              html[data-theme="dark"] small,
              html[data-theme="dark"] div {
                border-color: var(--workbit-border);
              }

              html[data-theme="dark"] a {
                color: #d8b4fe;
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
              html[data-theme="dark"] [style*="color: rgb(51, 65, 85)"],
              html[data-theme="dark"] [style*="color: rgb(71, 85, 105)"],
              html[data-theme="dark"] [style*="color: rgb(100, 116, 139)"] {
                color: var(--workbit-text-secondary) !important;
              }

              html[data-theme="dark"] [style*="background: #ffffff"],
              html[data-theme="dark"] [style*="background:#ffffff"],
              html[data-theme="dark"] [style*="background: #fff"],
              html[data-theme="dark"] [style*="background:#fff"],
              html[data-theme="dark"] [style*="background: rgb(255, 255, 255)"],
              html[data-theme="dark"] [style*="background-color: #ffffff"],
              html[data-theme="dark"] [style*="background-color:#ffffff"],
              html[data-theme="dark"] [style*="background-color: rgb(255, 255, 255)"] {
                background: var(--workbit-surface) !important;
              }

              html[data-theme="dark"] [style*="background: #f8fafc"],
              html[data-theme="dark"] [style*="background:#f8fafc"],
              html[data-theme="dark"] [style*="background: #f1f5f9"],
              html[data-theme="dark"] [style*="background:#f1f5f9"],
              html[data-theme="dark"] [style*="background: rgb(248, 250, 252)"],
              html[data-theme="dark"] [style*="background: rgb(241, 245, 249)"] {
                background: var(--workbit-surface-secondary) !important;
              }

              html[data-theme="dark"] .dashboard-bottom-nav,
              html[data-theme="dark"] nav {
                background: var(--workbit-navigation) !important;
                border-color: var(--workbit-border) !important;
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
