import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { PwaRegister } from "@/app/components/pwa-register";
import { PasskeySetupPrompt } from "@/app/components/passkey-setup-prompt";
import { RuntimeLanguageSync } from "@/app/components/runtime-language-sync";
import { ViewportResizeSync } from "@/app/components/viewport-resize-sync";
import { WorkbitRouteTransition } from "@/app/components/workbit-route-transition";
import { LANGUAGE_COOKIE_NAME, normalizeLanguage } from "@/lib/language";

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

  return (
    <html lang={htmlLang} style={{ colorScheme: "light" }}>
      <head>
        <meta name="color-scheme" content="light" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html {
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
                overscroll-behavior-x: none;
                background: #f7f3ff;
                color-scheme: light;
              }

              body {
                width: 100%;
                max-width: 100%;
                min-height: var(--workbit-vh, 100dvh);
                overflow-x: hidden;
                overscroll-behavior-x: none;
                position: relative;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, sans-serif;
                background: var(--workbit-background);
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
                --workbit-background: #efebfa;
                --workbit-surface: #ffffff;
                --workbit-surface-secondary: #f6f3ff;
                --workbit-surface-elevated: #ffffff;
                --workbit-field-bg: #ffffff;
                --workbit-popup: #ffffff;
                --workbit-navigation: rgba(255,255,255,0.86);
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
                --workbit-purple-soft: #f3edff;
                --workbit-lavender: #e7ddff;
                --workbit-border: rgba(94, 92, 230, 0.14);
                --workbit-card: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(253,252,255,0.94) 100%);
                --workbit-app-bg: linear-gradient(180deg, #ffffff 0%, #f7f4ff 38%, #efebfa 100%);
                --workbit-gradient: linear-gradient(135deg, #0b1024 0%, #5b21b6 48%, #a855f7 100%);
                --workbit-gradient-soft: linear-gradient(135deg, rgba(11,16,36,0.08) 0%, rgba(91,33,182,0.10) 45%, rgba(168,85,247,0.14) 100%);
                --workbit-shadow: 0 8px 26px rgba(61, 42, 153, 0.08), 0 1px 0 rgba(255,255,255,0.82) inset;
                --workbit-shadow-strong: 0 22px 58px rgba(28, 16, 76, 0.18);
                --workbit-focus: 0 0 0 4px rgba(168, 85, 247, 0.18);
                --workbit-success: #16a34a;
                --workbit-warning: #f59e0b;
                --workbit-danger: #ef4444;
                --workbit-info: #0284c7;
                --workbit-badge: #f5f3ff;
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
                  radial-gradient(circle at 50% -8%, rgba(124, 58, 237, 0.13), transparent 30%),
                  linear-gradient(180deg, #ffffff 0%, #f8f5ff 38%, #efebfa 100%);
                animation: none;
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

              html[data-workbit-overlay-open="true"] .workbit-global-ambient,
              html[data-workbit-overlay-open="true"] .workbit-global-ambient *,
              html[data-workbit-overlay-open="true"] .workbit-animated-background,
              html[data-workbit-overlay-open="true"] .workbit-animated-background * {
                animation: none !important;
                transform: none !important;
                will-change: auto !important;
              }

              html[data-workbit-overlay-open="true"] .workbit-global-ambient {
                opacity: 0.38;
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
                  radial-gradient(circle at 92% 0%, rgba(255,255,255,0.72), transparent 30%),
                  linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(253,252,255,0.94) 100%) !important;
                border-color: var(--workbit-border) !important;
                box-shadow: var(--workbit-shadow) !important;
              }

              .dashboard-shell-card,
              .workbit-login-card {
                border-radius: 34px !important;
              }

              .dashboard-panel,
              .dashboard-card,
              .sa-overview-card,
              .sa-overview-metric {
                border-radius: 28px !important;
              }

              .dashboard-item-card,
              .dashboard-list-card,
              .dashboard-compact-list-item,
              .dashboard-calendar-day,
              .dashboard-empty-state {
                border-radius: 22px !important;
                background:
                  linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,248,255,0.92) 100%) !important;
                border-color: rgba(94, 92, 230, 0.12) !important;
                box-shadow: 0 4px 14px rgba(61, 42, 153, 0.055) !important;
              }

              .dashboard-modal-wrap {
                background: rgba(18, 18, 31, 0.24) !important;
                backdrop-filter: blur(18px) saturate(130%) !important;
                -webkit-backdrop-filter: blur(18px) saturate(130%) !important;
              }

              .dashboard-modal-panel {
                border-radius: 30px !important;
                border: 1px solid rgba(94, 92, 230, 0.16) !important;
                box-shadow: 0 24px 70px rgba(28, 16, 76, 0.22) !important;
              }

              .dashboard-bottom-nav {
                background: rgba(255, 255, 255, 0.84) !important;
                border: 1px solid rgba(94, 92, 230, 0.13) !important;
                box-shadow: 0 18px 48px rgba(61, 42, 153, 0.16) !important;
                backdrop-filter: blur(24px) saturate(145%) !important;
                -webkit-backdrop-filter: blur(24px) saturate(145%) !important;
              }

              .dashboard-bottom-nav a,
              .dashboard-bottom-nav button,
              .dashboard-menu-button,
              .dashboard-icon-button,
              .dashboard-select-pill {
                background:
                  linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,244,255,0.90) 100%) !important;
                border-color: rgba(94, 92, 230, 0.13) !important;
              }

              .dashboard-button,
              .workbit-login-page button[type="submit"] {
                border-radius: 999px !important;
                letter-spacing: -0.01em;
              }

              input:not([type="checkbox"]):not([type="radio"]),
              select,
              textarea {
                border-radius: 18px !important;
                border-color: rgba(94, 92, 230, 0.14) !important;
                background:
                  linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(253,252,255,0.96) 100%) !important;
                box-shadow: 0 1px 0 rgba(255,255,255,0.76) inset;
              }

              .dashboard-panel-title,
              .dashboard-section-header h3,
              .dashboard-shell h1,
              .dashboard-shell h2,
              .dashboard-shell h3,
              .workbit-login-card h1 {
                letter-spacing: -0.035em !important;
              }

              .workbit-login-card {
                box-shadow: 0 24px 70px rgba(61, 42, 153, 0.14) !important;
              }

              .workbit-login-page {
                background: linear-gradient(180deg, #ffffff 0%, #f7f4ff 42%, #efebfa 100%) !important;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, sans-serif !important;
              }

              .workbit-login-card {
                background: #ffffff !important;
                border: 1px solid rgba(60, 60, 67, 0.12) !important;
                border-radius: 34px !important;
                box-shadow: 0 18px 54px rgba(61, 42, 153, 0.14) !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
              }

              .workbit-login-card input:not([type="checkbox"]):not([type="radio"]) {
                background: #ffffff !important;
                border: 1px solid rgba(60, 60, 67, 0.12) !important;
                border-radius: 14px !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important;
                color: #1c1c1e !important;
              }

              .workbit-login-card button[type="submit"] {
                background: linear-gradient(135deg, #3d2a99 0%, #5e5ce6 58%, #8b5cf6 100%) !important;
                color: #ffffff !important;
                box-shadow: 0 16px 32px rgba(76, 60, 220, 0.28) !important;
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

              .dashboard-modal-wrap,
              .dashboard-menu-overlay {
                animation: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
              }

              .dashboard-modal-wrap *,
              .dashboard-menu-overlay * {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
              }

              .dashboard-modal-panel {
                animation: none !important;
                box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16) !important;
              }

              .workbit-global-ambient {
                background:
                  radial-gradient(circle at 52% 10%, rgba(124, 58, 237, 0.12), transparent 34%),
                  radial-gradient(circle at 12% 4%, rgba(94, 92, 230, 0.10), transparent 30%),
                  radial-gradient(circle at 88% 18%, rgba(168, 85, 247, 0.10), transparent 34%),
                  linear-gradient(180deg, #ffffff 0%, #f7f4ff 46%, #efebfa 100%) !important;
                animation: none !important;
              }

              .dashboard-shell-inner {
                gap: 16px !important;
              }

              .dashboard-shell-card {
                padding: 20px !important;
                background:
                  linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%) !important;
                border: 1px solid rgba(94, 92, 230, 0.14) !important;
                border-radius: 34px !important;
                box-shadow: 0 14px 42px rgba(61, 42, 153, 0.10) !important;
              }

              .dashboard-page-hero,
              .dashboard-panel,
              .dashboard-card,
              .dashboard-item-card,
              .dashboard-list-card,
              .dashboard-compact-list-item,
              .dashboard-summary-card,
              .dashboard-calendar-day,
              .sa-overview-card,
              .sa-overview-metric,
              .workbit-login-card {
                background:
                  linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(255,255,255,0.94) 58%, rgba(250,248,255,0.92) 100%) !important;
                border: 1px solid rgba(94, 92, 230, 0.13) !important;
                box-shadow: 0 8px 24px rgba(61, 42, 153, 0.075) !important;
              }

              .dashboard-page-hero,
              .dashboard-panel,
              .dashboard-card,
              .workbit-login-card {
                border-radius: 32px !important;
              }

              .dashboard-item-card,
              .dashboard-list-card,
              .dashboard-compact-list-item,
              .dashboard-summary-card,
              .dashboard-calendar-day {
                border-radius: 24px !important;
              }

              .dashboard-panel-header,
              .dashboard-section-header {
                padding-bottom: 2px;
              }

              .dashboard-panel-title,
              .dashboard-section-header h3,
              .dashboard-shell h1,
              .dashboard-shell h2,
              .workbit-login-card h1 {
                color: #111827 !important;
                font-weight: 780 !important;
                letter-spacing: -0.045em !important;
              }

              .dashboard-shell p,
              .dashboard-panel p,
              .dashboard-card p,
              .dashboard-item-card p,
              .dashboard-list-card p {
                color: var(--workbit-muted);
              }

              .dashboard-modal-wrap,
              .dashboard-menu-overlay {
                background: rgba(24, 18, 42, 0.28) !important;
                backdrop-filter: blur(20px) saturate(145%) !important;
                -webkit-backdrop-filter: blur(20px) saturate(145%) !important;
              }

              .dashboard-modal-wrap *,
              .dashboard-menu-overlay * {
                backdrop-filter: initial;
                -webkit-backdrop-filter: initial;
              }

              .dashboard-modal-panel {
                background:
                  linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(252,250,255,0.97) 100%) !important;
                border: 1px solid rgba(94, 92, 230, 0.16) !important;
                border-radius: 32px !important;
                box-shadow: 0 28px 86px rgba(24, 18, 42, 0.26) !important;
              }

              .dashboard-bottom-nav {
                padding: 10px !important;
                border-radius: 30px !important;
                background: rgba(255, 255, 255, 0.86) !important;
                border: 1px solid rgba(94, 92, 230, 0.14) !important;
                box-shadow: 0 20px 54px rgba(61, 42, 153, 0.18) !important;
                backdrop-filter: blur(26px) saturate(150%) !important;
                -webkit-backdrop-filter: blur(26px) saturate(150%) !important;
              }

              .dashboard-bottom-nav a {
                border-radius: 22px !important;
                background: transparent !important;
                border-color: transparent !important;
                box-shadow: none !important;
              }

              .dashboard-bottom-nav a[aria-current="page"] {
                background:
                  linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(244,239,255,0.96) 100%) !important;
                border-color: rgba(124, 58, 237, 0.18) !important;
                box-shadow:
                  0 0 0 1px rgba(124, 58, 237, 0.06),
                  0 12px 28px rgba(124, 58, 237, 0.16) !important;
              }

              .dashboard-menu-button,
              .dashboard-icon-button,
              .dashboard-select-pill,
              input:not([type="checkbox"]):not([type="radio"]),
              select,
              textarea {
                background: rgba(255,255,255,0.92) !important;
                border: 1px solid rgba(94, 92, 230, 0.14) !important;
                box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset !important;
              }

              .dashboard-button,
              .workbit-login-page button[type="submit"] {
                box-shadow: 0 12px 28px rgba(91, 33, 182, 0.18) !important;
              }

              .dashboard-button[style*="background: var(--workbit-gradient)"],
              .dashboard-button[style*="linear-gradient"],
              .workbit-login-page button[type="submit"] {
                color: #ffffff !important;
              }

              @media (max-width: 900px) {
                .dashboard-shell {
                  padding: 14px !important;
                  padding-bottom: calc(130px + env(safe-area-inset-bottom)) !important;
                }

                .dashboard-shell-card {
                  border-radius: 30px !important;
                  padding: 18px !important;
                }

                .dashboard-panel,
                .dashboard-card,
                .workbit-login-card {
                  border-radius: 28px !important;
                }

                .dashboard-modal-panel {
                  border-radius: 28px !important;
                }
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

              /* Keep dark mode authoritative after the light visual skin above. */
              /* Unified Workbit night skin: one continuous navy canvas and violet glass surfaces. */
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
                .workbit-global-ambient,
                .workbit-global-ambient *,
                .workbit-animated-background,
                .workbit-animated-background * {
                  animation: none !important;
                  will-change: auto !important;
                }

                .workbit-animated-background--minimal .workbit-animated-background__fog {
                  display: none;
                }

                .workbit-animated-background__orb {
                  filter: blur(6px);
                  opacity: 0.48;
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
                  opacity: 0.16;
                  filter: blur(4px);
                }

                .workbit-global-ambient__smoke {
                  display: none;
                }

                .workbit-global-ambient__beam {
                  display: none;
                }

                .workbit-global-ambient__orbit {
                  opacity: 0.14;
                  filter: blur(7px);
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
