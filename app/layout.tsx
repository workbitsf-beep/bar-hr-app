import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { PwaRegister } from "@/app/components/pwa-register";
import { PasskeySetupPrompt } from "@/app/components/passkey-setup-prompt";
import { RuntimeLanguageSync } from "@/app/components/runtime-language-sync";
import { RuntimeThemeSync } from "@/app/components/runtime-theme-sync";
import { ViewportResizeSync } from "@/app/components/viewport-resize-sync";
import { WorkbitRouteTransition } from "@/app/components/workbit-route-transition";
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
                position: relative;
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
                --workbit-app-bg: radial-gradient(circle at 88% 2%, rgba(168,85,247,0.11), transparent 30%),
                  radial-gradient(circle at 8% 4%, rgba(91,33,182,0.06), transparent 28%),
                  linear-gradient(180deg, #ffffff 0%, #fbf8ff 48%, #f6f0ff 100%);
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
                --workbit-app-bg: radial-gradient(circle at 86% 2%, rgba(168,85,247,0.18), transparent 31%),
                  radial-gradient(circle at 12% 4%, rgba(124,58,237,0.10), transparent 28%),
                  linear-gradient(180deg, #fbf8ff 0%, #f1eaff 54%, #e9ddff 100%);
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

              html,
              body,
              .dashboard-shell,
              .dashboard-shell *,
              .dashboard-modal-wrap,
              .dashboard-modal-wrap *,
              .dashboard-menu-overlay,
              .dashboard-menu-overlay *,
              .workbit-login-page,
              .workbit-login-page * {
                scrollbar-width: none;
                -ms-overflow-style: none;
              }

              html::-webkit-scrollbar,
              body::-webkit-scrollbar,
              .dashboard-shell::-webkit-scrollbar,
              .dashboard-shell *::-webkit-scrollbar,
              .dashboard-modal-wrap::-webkit-scrollbar,
              .dashboard-modal-wrap *::-webkit-scrollbar,
              .dashboard-menu-overlay::-webkit-scrollbar,
              .dashboard-menu-overlay *::-webkit-scrollbar,
              .workbit-login-page::-webkit-scrollbar,
              .workbit-login-page *::-webkit-scrollbar {
                width: 0;
                height: 0;
                display: none;
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

              .workbit-animated-page {
                position: relative;
                isolation: isolate;
                min-width: 0;
              }

              .workbit-animated-page__content {
                position: relative;
                z-index: 1;
                min-width: 0;
              }

              .workbit-app-content {
                position: relative;
                z-index: 1;
                min-height: var(--workbit-vh, 100dvh);
              }

              .workbit-global-ambient {
                position: fixed;
                inset: 0;
                z-index: 0;
                pointer-events: none;
                background:
                  radial-gradient(circle at 18% 12%, rgba(124, 58, 237, 0.11), transparent 34%),
                  radial-gradient(circle at 86% 18%, rgba(59, 130, 246, 0.09), transparent 36%),
                  radial-gradient(circle at 48% 88%, rgba(168, 85, 247, 0.10), transparent 38%),
                  linear-gradient(140deg, #ffffff 0%, #f8f4ff 44%, #f2f6ff 100%);
                animation: workbit-global-bg-pan 24s ease-in-out infinite alternate;
                will-change: transform, background-position;
                overflow: clip;
              }

              .workbit-global-ambient__light,
              .workbit-global-ambient__smoke,
              .workbit-global-ambient__beam,
              .workbit-global-ambient__veil,
              .workbit-global-ambient__orbit {
                position: absolute;
                display: block;
                pointer-events: none;
                transform: translate3d(0, 0, 0);
              }

              .workbit-global-ambient__light {
                width: 38vmax;
                height: 38vmax;
                border-radius: 999px;
                filter: blur(12px);
                opacity: 0.20;
                background: radial-gradient(circle, rgba(168, 85, 247, 0.24), rgba(59, 130, 246, 0.08) 44%, transparent 74%);
                animation: workbit-global-light-one 28s ease-in-out infinite alternate;
              }

              .workbit-global-ambient__light--one {
                top: -8%;
                left: -10%;
              }

              .workbit-global-ambient__light--two {
                right: -12%;
                top: 12%;
                opacity: 0.18;
                background: radial-gradient(circle, rgba(59, 130, 246, 0.20), rgba(168, 85, 247, 0.08) 46%, transparent 76%);
                animation-name: workbit-global-light-two;
                animation-duration: 32s;
              }

              .workbit-global-ambient__light--three {
                display: none;
                left: 18%;
                bottom: -24%;
                width: 70vmax;
                height: 70vmax;
                opacity: 0.52;
                background: radial-gradient(circle, rgba(124, 58, 237, 0.44), rgba(14, 165, 233, 0.18) 45%, transparent 76%);
                animation-name: workbit-global-light-three;
                animation-duration: 12s;
              }

              .workbit-global-ambient__smoke {
                inset: 0;
                opacity: 0.14;
                background:
                  radial-gradient(ellipse at 18% 24%, rgba(255,255,255,0.24), transparent 36%),
                  radial-gradient(ellipse at 74% 32%, rgba(255,255,255,0.16), transparent 38%);
                animation: workbit-global-smoke 38s ease-in-out infinite alternate;
              }

              .workbit-global-ambient__beam {
                display: none;
                width: 118vmax;
                height: 24vmax;
                left: 50%;
                top: 28%;
                border-radius: 999px;
                opacity: 0.42;
                filter: blur(13px);
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.26), rgba(168,85,247,0.42), rgba(59,130,246,0.24), transparent);
                transform: translate3d(-50%, 0, 0) rotate(-14deg);
                animation: workbit-global-beam 7s ease-in-out infinite alternate;
              }

              .workbit-global-ambient__veil {
                display: none;
                inset: -8%;
                opacity: 0.34;
                background:
                  linear-gradient(105deg, transparent 4%, rgba(255,255,255,0.32) 34%, transparent 58%),
                  linear-gradient(28deg, transparent 18%, rgba(124,58,237,0.20) 44%, transparent 68%);
                filter: blur(8px);
                animation: workbit-global-veil 13s ease-in-out infinite alternate;
              }

              .workbit-global-ambient__orbit {
                display: block;
                left: 50%;
                top: 50%;
                width: 18vmax;
                height: 18vmax;
                border-radius: 999px;
                opacity: 0.28;
                filter: blur(18px);
                mix-blend-mode: multiply;
                background: radial-gradient(circle, rgba(197,181,255,0.42), rgba(168,85,247,0.22) 32%, transparent 70%);
                transform-origin: 0 0;
                animation: workbit-global-orbit-one 24s linear infinite;
              }

              .workbit-global-ambient__orbit--two {
                width: 16vmax;
                height: 16vmax;
                opacity: 0.24;
                background: radial-gradient(circle, rgba(191,219,254,0.38), rgba(59,130,246,0.18) 34%, transparent 72%);
                animation-name: workbit-global-orbit-two;
                animation-duration: 30s;
                animation-direction: reverse;
              }

              .workbit-global-ambient__orbit--three {
                width: 12vmax;
                height: 12vmax;
                opacity: 0.20;
                background: radial-gradient(circle, rgba(245,208,254,0.36), rgba(124,58,237,0.18) 34%, transparent 72%);
                animation-name: workbit-global-orbit-three;
                animation-duration: 36s;
              }

              html[data-theme="dark"] .workbit-global-ambient {
                background:
                  radial-gradient(circle at 16% 12%, rgba(124, 58, 237, 0.18), transparent 34%),
                  radial-gradient(circle at 86% 18%, rgba(14, 165, 233, 0.10), transparent 36%),
                  radial-gradient(circle at 48% 88%, rgba(168, 85, 247, 0.14), transparent 38%),
                  linear-gradient(140deg, #fbf8ff 0%, #f1eaff 48%, #e9ddff 100%);
              }

              html[data-theme="dark"] .workbit-global-ambient__light {
                mix-blend-mode: multiply;
                opacity: 0.22;
              }

              html[data-theme="dark"] .workbit-global-ambient__smoke {
                opacity: 0.16;
              }

              html[data-theme="dark"] .workbit-global-ambient__orbit {
                mix-blend-mode: multiply;
                opacity: 0.24;
              }

              html[data-workbit-overlay-open="true"] .workbit-global-ambient,
              html[data-workbit-overlay-open="true"] .workbit-global-ambient *,
              html[data-workbit-overlay-open="true"] .workbit-animated-background,
              html[data-workbit-overlay-open="true"] .workbit-animated-background * {
                animation-play-state: paused !important;
              }

              html[data-workbit-overlay-open="true"] .workbit-global-ambient {
                opacity: 0.55;
              }

              .dashboard-shell,
              .workbit-login-page {
                background: transparent !important;
              }

              .dashboard-modal-panel {
                isolation: isolate;
                overflow-x: hidden !important;
                background:
                  radial-gradient(circle at 18% 18%, rgba(168,85,247,0.10), transparent 32%),
                  radial-gradient(circle at 84% 28%, rgba(59,130,246,0.07), transparent 34%),
                  linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(250,247,255,0.96) 100%) !important;
              }

              .workbit-animated-background {
                position: absolute;
                inset: 0;
                z-index: 0;
                overflow: hidden;
                pointer-events: none;
                border-radius: inherit;
                contain: layout paint;
              }

              .workbit-animated-background::before,
              .workbit-animated-background::after {
                content: "";
                position: absolute;
                pointer-events: none;
                transform: translate3d(0, 0, 0);
              }

              .workbit-animated-background::before {
                width: 90vmax;
                height: 90vmax;
                left: 50%;
                top: 50%;
                border-radius: 999px;
                opacity: 0.34;
                background:
                  radial-gradient(circle, rgba(168, 85, 247, 0.30), transparent 34%),
                  radial-gradient(circle at 34% 42%, rgba(59, 130, 246, 0.18), transparent 30%);
                filter: blur(24px);
                animation: workbit-deep-light-drift 17s ease-in-out infinite alternate;
              }

              .workbit-animated-background::after {
                inset: -12%;
                opacity: 0.38;
                background:
                  radial-gradient(ellipse at 12% 18%, rgba(255,255,255,0.48), transparent 32%),
                  radial-gradient(ellipse at 78% 62%, rgba(216,180,254,0.40), transparent 36%),
                  linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.30) 38%, transparent 68%);
                filter: blur(18px);
                animation: workbit-smoke-roll 13s ease-in-out infinite alternate;
              }

              .workbit-animated-background__orb,
              .workbit-animated-background__fog,
              .workbit-animated-background__mesh,
              .workbit-animated-background__ray {
                position: absolute;
                display: block;
                pointer-events: none;
                transform: translate3d(0, 0, 0);
              }

              .workbit-animated-background__orb {
                width: 48vmax;
                height: 48vmax;
                max-width: 760px;
                max-height: 760px;
                border-radius: 999px;
                opacity: 0.72;
                filter: blur(22px);
                background: radial-gradient(circle, rgba(168, 85, 247, 0.48), rgba(59, 130, 246, 0.18) 44%, transparent 72%);
                animation: workbit-orb-drift 9s ease-in-out infinite alternate;
              }

              .dashboard-shell > .workbit-animated-background {
                position: fixed;
                border-radius: 0;
                min-height: var(--workbit-vh, 100dvh);
              }

              .workbit-animated-background__orb--one {
                top: -10%;
                right: -8%;
              }

              .workbit-animated-background__orb--two {
                left: -12%;
                bottom: -12%;
                opacity: 0.52;
                background: radial-gradient(circle, rgba(11, 16, 36, 0.26), rgba(124, 58, 237, 0.28) 42%, transparent 72%);
                animation-duration: 12s;
                animation-direction: alternate-reverse;
              }

              .workbit-animated-background__mesh {
                inset: -18%;
                opacity: 0.44;
                background:
                  linear-gradient(115deg, transparent 12%, rgba(124, 58, 237, 0.28) 38%, transparent 62%),
                  linear-gradient(28deg, transparent 18%, rgba(59, 130, 246, 0.20) 42%, transparent 68%);
                filter: blur(1px);
                animation: workbit-mesh-shift 8s ease-in-out infinite alternate;
              }

              .workbit-animated-background__ray {
                width: 88vmax;
                height: 24vmax;
                left: 50%;
                top: 14%;
                border-radius: 999px;
                opacity: 0.34;
                background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.52), rgba(59, 130, 246, 0.34), transparent);
                filter: blur(14px);
                transform: translate3d(-50%, 0, 0) rotate(-12deg);
                animation: workbit-ray-drift 10s ease-in-out infinite alternate;
              }

              .workbit-animated-background__fog {
                inset: -18%;
                opacity: 0.58;
                background:
                  linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.54) 34%, transparent 64%),
                  radial-gradient(ellipse at 42% 12%, rgba(255,255,255,0.44), transparent 34%),
                  radial-gradient(ellipse at 62% 78%, rgba(196,181,253,0.34), transparent 38%);
                mix-blend-mode: screen;
                filter: blur(16px);
                animation: workbit-fog-drift 11s ease-in-out infinite alternate;
              }

              .workbit-animated-background--full .workbit-animated-background__orb {
                opacity: 0.82;
              }

              .workbit-animated-background--soft .workbit-animated-background__orb {
                opacity: 0.72;
                filter: blur(20px);
              }

              .workbit-animated-background--minimal .workbit-animated-background__orb {
                opacity: 0.24;
                filter: blur(12px);
                animation-duration: 24s;
              }

              .workbit-animated-background--minimal .workbit-animated-background__mesh,
              .workbit-animated-background--minimal .workbit-animated-background__ray {
                opacity: 0.16;
              }

              html[data-theme="dark"] .workbit-animated-background__orb {
                background: radial-gradient(circle, rgba(168, 85, 247, 0.34), rgba(14, 165, 233, 0.12) 44%, transparent 72%);
              }

              html[data-theme="dark"] .workbit-animated-background__orb--two {
                background: radial-gradient(circle, rgba(11, 16, 36, 0.16), rgba(124, 58, 237, 0.22) 44%, transparent 72%);
              }

              html[data-theme="dark"] .workbit-animated-background__fog {
                opacity: 0.18;
              }

              .workbit-reveal {
                opacity: 0;
                transform: translate3d(0, 22px, 0) scale(.992);
                transition:
                  opacity 340ms ease,
                  transform 340ms cubic-bezier(.2, .8, .2, 1);
                transition-delay: calc(var(--workbit-reveal-delay, 0ms) + var(--workbit-reveal-extra-delay, 0ms));
                will-change: opacity, transform;
              }

              .workbit-reveal--left {
                transform: translate3d(-18px, 0, 0);
              }

              .workbit-reveal--right {
                transform: translate3d(18px, 0, 0);
              }

              .workbit-reveal--scale {
                transform: scale(.985);
              }

              .workbit-reveal--visible {
                opacity: 1;
                transform: translate3d(0, 0, 0) scale(1);
                will-change: auto;
              }

              .dashboard-stack > .workbit-reveal:nth-child(2),
              .dashboard-item-list > .workbit-reveal:nth-child(2),
              .sa-overview-grid > .workbit-reveal:nth-child(2) {
                --workbit-reveal-extra-delay: 45ms;
              }

              .dashboard-stack > .workbit-reveal:nth-child(3),
              .dashboard-item-list > .workbit-reveal:nth-child(3),
              .sa-overview-grid > .workbit-reveal:nth-child(3) {
                --workbit-reveal-extra-delay: 80ms;
              }

              .dashboard-stack > .workbit-reveal:nth-child(n + 4),
              .dashboard-item-list > .workbit-reveal:nth-child(n + 4),
              .sa-overview-grid > .workbit-reveal:nth-child(n + 4) {
                --workbit-reveal-extra-delay: 110ms;
              }

              .workbit-animated-card,
              .dashboard-panel,
              .dashboard-card,
              .dashboard-item-card,
              .dashboard-list-card,
              .sa-overview-card,
              .sa-overview-metric {
                transform: translate3d(0, 0, 0);
                transition:
                  transform 140ms ease,
                  box-shadow 140ms ease,
                  border-color 140ms ease,
                  background 140ms ease;
              }

              .dashboard-shell-card,
              .dashboard-panel,
              .dashboard-card,
              .dashboard-item-card,
              .dashboard-list-card,
              .dashboard-compact-list-item,
              .sa-overview-card,
              .sa-overview-metric,
              .workbit-login-card {
                position: relative;
                overflow: visible;
                background:
                  radial-gradient(circle at 92% 0%, rgba(255,255,255,0.52), transparent 28%),
                  linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247,243,255,0.88) 100%) !important;
              }

              .dashboard-shell-card::before,
              .dashboard-panel::before,
              .dashboard-card::before,
              .dashboard-item-card::before,
              .dashboard-list-card::before,
              .dashboard-compact-list-item::before,
              .sa-overview-card::before,
              .sa-overview-metric::before,
              .workbit-login-card::before {
                content: none;
              }

              .dashboard-shell-card > *,
              .dashboard-panel > *,
              .dashboard-card > *,
              .dashboard-item-card > *,
              .dashboard-list-card > *,
              .dashboard-compact-list-item > *,
              .sa-overview-card > *,
              .sa-overview-metric > *,
              .workbit-login-card > * {
                position: relative;
                z-index: 1;
              }

              .workbit-route-transition {
                position: fixed;
                inset: 0;
                z-index: 2147483000;
                pointer-events: none;
                opacity: 0;
                background:
                  radial-gradient(circle at 50% 44%, rgba(168, 85, 247, 0.22), transparent 32%),
                  linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.42) 42%, transparent 64%);
                transform: translate3d(-18%, 0, 0) scale(1.04);
              }

              .workbit-route-transition--active {
                animation: workbit-route-sweep 520ms cubic-bezier(.2, .8, .2, 1) both;
              }

              .workbit-scroll-reveal {
                opacity: 1;
                transform: none;
                transition: none;
              }

              .workbit-scroll-reveal--visible {
                opacity: 1;
                transform: translate3d(0, 0, 0) scale(1);
                will-change: auto;
              }

              .workbit-press-feedback,
              .dashboard-button,
              .dashboard-icon-button,
              .dashboard-bottom-nav a,
              .dashboard-clock-button,
              button[type="submit"],
              button[type="button"],
              a[role="button"] {
                -webkit-tap-highlight-color: transparent;
                transition:
                  transform 120ms ease,
                  box-shadow 120ms ease,
                  opacity 120ms ease,
                  background 120ms ease,
                  border-color 120ms ease;
              }

              .workbit-press-feedback:active,
              .dashboard-button:active,
              .dashboard-icon-button:active,
              .dashboard-bottom-nav a:active,
              .dashboard-clock-button:active,
              button[type="submit"]:active,
              button[type="button"]:active,
              a[role="button"]:active {
                transform: scale(.985);
              }

              .dashboard-button:hover:not(:disabled),
              .dashboard-icon-button:hover:not(:disabled),
              .workbit-press-feedback:hover {
                box-shadow: 0 14px 30px rgba(124, 58, 237, 0.16);
              }

              .dashboard-modal-wrap {
                animation: workbit-modal-backdrop 150ms ease both;
              }

              .dashboard-modal-panel {
                animation: workbit-modal-enter 170ms cubic-bezier(.2, .8, .2, 1) both;
              }

              .dashboard-bottom-nav a[aria-current="page"] {
                animation: workbit-nav-active 180ms ease both;
              }

              .dashboard-bottom-nav {
                z-index: 2147482500 !important;
                overflow: visible !important;
                contain: none !important;
                isolation: isolate;
              }

              .dashboard-bottom-nav,
              .dashboard-bottom-nav * {
                will-change: auto !important;
              }

              .dashboard-clock-button {
                position: relative;
                overflow: hidden;
                isolation: isolate;
              }

              .dashboard-clock-button::after {
                content: "";
                position: absolute;
                inset: -30%;
                z-index: -1;
                opacity: 0;
                background: radial-gradient(circle, rgba(255,255,255,0.52), transparent 48%);
                transform: scale(.45);
                transition: opacity 160ms ease, transform 220ms ease;
              }

              .dashboard-clock-button:active::after {
                opacity: .75;
                transform: scale(1);
              }

              .workbit-success-pulse {
                position: absolute;
                inset: -12px;
                border-radius: inherit;
                pointer-events: none;
                animation: workbit-success-pulse 620ms ease-out both;
              }

              .workbit-success-pulse--green {
                color: rgba(34, 197, 94, .34);
                box-shadow: 0 0 0 0 rgba(34, 197, 94, .34);
              }

              .workbit-success-pulse--red {
                color: rgba(239, 68, 68, .32);
                box-shadow: 0 0 0 0 rgba(239, 68, 68, .32);
              }

              .workbit-success-pulse--purple {
                color: rgba(124, 58, 237, .30);
                box-shadow: 0 0 0 0 rgba(124, 58, 237, .30);
              }

              @keyframes workbit-orb-drift {
                from {
                  transform: translate3d(-8%, -4%, 0) scale(1);
                }
                to {
                  transform: translate3d(10%, 7%, 0) scale(1.12);
                }
              }

              @keyframes workbit-page-gradient {
                from {
                  background-position: 0% 0%;
                }
                to {
                  background-position: 100% 100%;
                }
              }

              @keyframes workbit-global-bg-pan {
                from {
                  transform: translate3d(-2%, -1%, 0) scale(1.02);
                  background-position: 0% 0%;
                }
                to {
                  transform: translate3d(2%, 1.5%, 0) scale(1.06);
                  background-position: 100% 100%;
                }
              }

              @keyframes workbit-global-light-one {
                from {
                  transform: translate3d(-8%, -5%, 0) scale(.96);
                }
                to {
                  transform: translate3d(26%, 18%, 0) scale(1.14);
                }
              }

              @keyframes workbit-global-light-two {
                from {
                  transform: translate3d(10%, -8%, 0) scale(1);
                }
                to {
                  transform: translate3d(-24%, 20%, 0) scale(1.18);
                }
              }

              @keyframes workbit-global-light-three {
                from {
                  transform: translate3d(-16%, 10%, 0) scale(.94);
                }
                to {
                  transform: translate3d(18%, -18%, 0) scale(1.12);
                }
              }

              @keyframes workbit-global-smoke {
                from {
                  transform: translate3d(-5%, -3%, 0) rotate(-1deg) scale(1);
                  opacity: .48;
                }
                to {
                  transform: translate3d(6%, 4%, 0) rotate(1deg) scale(1.06);
                  opacity: .72;
                }
              }

              @keyframes workbit-global-beam {
                from {
                  transform: translate3d(-62%, -10%, 0) rotate(-18deg) scale(.96);
                  opacity: .28;
                }
                to {
                  transform: translate3d(-38%, 18%, 0) rotate(-7deg) scale(1.12);
                  opacity: .58;
                }
              }

              @keyframes workbit-global-veil {
                from {
                  transform: translate3d(-6%, -2%, 0) rotate(-1deg);
                  opacity: .22;
                }
                to {
                  transform: translate3d(6%, 3%, 0) rotate(1deg);
                  opacity: .44;
                }
              }

              @keyframes workbit-global-orbit-one {
                from {
                  transform: rotate(0deg) translate3d(30vmax, -4vmax, 0) rotate(0deg) scale(.92);
                }
                to {
                  transform: rotate(360deg) translate3d(30vmax, -4vmax, 0) rotate(-360deg) scale(1.08);
                }
              }

              @keyframes workbit-global-orbit-two {
                from {
                  transform: rotate(0deg) translate3d(-24vmax, 16vmax, 0) rotate(0deg) scale(1.04);
                }
                to {
                  transform: rotate(360deg) translate3d(-24vmax, 16vmax, 0) rotate(-360deg) scale(.92);
                }
              }

              @keyframes workbit-global-orbit-three {
                from {
                  transform: rotate(0deg) translate3d(12vmax, 28vmax, 0) rotate(0deg) scale(.96);
                }
                to {
                  transform: rotate(360deg) translate3d(12vmax, 28vmax, 0) rotate(-360deg) scale(1.12);
                }
              }

              @keyframes workbit-popup-orbit {
                from {
                  transform: translate3d(-3%, -2%, 0) rotate(-2deg) scale(1);
                  opacity: .72;
                }
                to {
                  transform: translate3d(3%, 2%, 0) rotate(2deg) scale(1.04);
                  opacity: .92;
                }
              }

              @keyframes workbit-mesh-shift {
                from {
                  transform: translate3d(-5%, -3%, 0) rotate(-2deg);
                  opacity: .34;
                }
                to {
                  transform: translate3d(5%, 4%, 0) rotate(2deg);
                  opacity: .54;
                }
              }

              @keyframes workbit-ray-drift {
                from {
                  transform: translate3d(-62%, -8%, 0) rotate(-16deg) scale(.96);
                  opacity: .22;
                }
                to {
                  transform: translate3d(-38%, 12%, 0) rotate(-7deg) scale(1.10);
                  opacity: .44;
                }
              }

              @keyframes workbit-deep-light-drift {
                from {
                  transform: translate3d(-58%, -54%, 0) scale(.94);
                  opacity: .28;
                }
                to {
                  transform: translate3d(-42%, -42%, 0) scale(1.08);
                  opacity: .44;
                }
              }

              @keyframes workbit-smoke-roll {
                from {
                  transform: translate3d(-4%, -2%, 0) scale(1);
                  opacity: .30;
                }
                to {
                  transform: translate3d(4%, 3%, 0) scale(1.04);
                  opacity: .48;
                }
              }

              @keyframes workbit-container-sheen {
                from {
                  transform: translate3d(-8%, 0, 0);
                  opacity: .22;
                }
                to {
                  transform: translate3d(8%, 0, 0);
                  opacity: .44;
                }
              }

              @keyframes workbit-route-sweep {
                0% {
                  opacity: 0;
                  transform: translate3d(-22%, 0, 0) scale(1.04);
                }
                38% {
                  opacity: 1;
                }
                100% {
                  opacity: 0;
                  transform: translate3d(18%, 0, 0) scale(1.04);
                }
              }

              @keyframes workbit-fog-drift {
                from {
                  transform: translate3d(-7%, -2%, 0) scale(1);
                }
                to {
                  transform: translate3d(7%, 4%, 0) scale(1.04);
                }
              }

              @keyframes workbit-modal-backdrop {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }

              @keyframes workbit-modal-enter {
                from {
                  opacity: 0;
                  transform: translate3d(0, 6px, 0) scale(.98);
                }
                to {
                  opacity: 1;
                  transform: translate3d(0, 0, 0) scale(1);
                }
              }

              @keyframes workbit-nav-active {
                from {
                  transform: translateY(0) scale(.98);
                }
                to {
                  transform: translateY(-3px) scale(1);
                }
              }

              @keyframes workbit-success-pulse {
                0% {
                  opacity: .9;
                  box-shadow: 0 0 0 0 currentColor;
                }
                100% {
                  opacity: 0;
                  box-shadow: 0 0 0 18px transparent;
                }
              }

              @media (prefers-reduced-motion: reduce) {
                *,
                *::before,
                *::after {
                  animation-duration: 1ms !important;
                  animation-iteration-count: 1 !important;
                  scroll-behavior: auto !important;
                  transition-duration: 1ms !important;
                }

                .workbit-animated-background__orb,
                .workbit-animated-background__fog,
                .workbit-animated-background__mesh,
                .workbit-animated-background__ray,
                .workbit-global-ambient,
                .workbit-global-ambient *,
                .workbit-route-transition {
                  animation: none !important;
                  transform: none !important;
                }

                .workbit-reveal {
                  opacity: 1 !important;
                  transform: none !important;
                }

                .workbit-scroll-reveal {
                  opacity: 1 !important;
                  transform: none !important;
                }
              }

              @media (max-width: 720px), (pointer: coarse) {
                .workbit-animated-background--minimal .workbit-animated-background__fog {
                  display: none;
                }

                .workbit-animated-background__orb {
                  filter: blur(10px);
                  opacity: 0.62;
                }

                .workbit-animated-background__mesh {
                  opacity: 0.42;
                }

                .workbit-animated-background__ray {
                  opacity: 0.32;
                }

                .workbit-global-ambient {
                  inset: 0;
                }

                .workbit-global-ambient__light {
                  width: 52vmax;
                  height: 52vmax;
                  opacity: 0.24;
                  filter: blur(6px);
                }

                .workbit-global-ambient__smoke {
                  opacity: 0.14;
                }

                .workbit-global-ambient__beam {
                  opacity: 0.48;
                  filter: blur(11px);
                }
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
        <WorkbitRouteTransition />
        <div className="workbit-global-ambient" aria-hidden="true">
          <span className="workbit-global-ambient__light workbit-global-ambient__light--one" />
          <span className="workbit-global-ambient__light workbit-global-ambient__light--two" />
          <span className="workbit-global-ambient__light workbit-global-ambient__light--three" />
          <span className="workbit-global-ambient__smoke" />
          <span className="workbit-global-ambient__beam" />
          <span className="workbit-global-ambient__veil" />
          <span className="workbit-global-ambient__orbit workbit-global-ambient__orbit--one" />
          <span className="workbit-global-ambient__orbit workbit-global-ambient__orbit--two" />
          <span className="workbit-global-ambient__orbit workbit-global-ambient__orbit--three" />
        </div>
        <div className="workbit-app-content">{children}</div>
      </body>
    </html>
  );
}
