import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ConfirmationToast } from "@/app/components/confirmation-toast";
import { PendingButton } from "@/app/components/pending-button";
import { RevealOnScroll } from "@/app/components/workbit-animations";
import { ActiveBottomNav } from "./bottom-nav";
import {
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  formatDateTimeLocalInTimeZone,
} from "@/lib/time-zone";
import type { DashboardNavItem } from "./context";
import { BarHeaderSwitcher } from "./bar-logo-switcher";
import { DashboardNavMenu } from "./dashboard-nav-menu";

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDate(value: Date | string): string {
  return formatDateInTimeZone(value);
}

export function formatDateTime(value: Date | string): string {
  return formatDateTimeInTimeZone(value);
}

export function formatDateTimeLocal(value: Date | string): string {
  return formatDateTimeLocalInTimeZone(value);
}

const shellCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(60, 60, 67, 0.12)",
  borderRadius: 18,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  backdropFilter: "none",
};

const softCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(60, 60, 67, 0.12)",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
};

const focusRing = "var(--workbit-focus)";

function resolveUiEmoji(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("riepilog") || normalized.includes("kpi")) return "\uD83D\uDCCA";
  if (normalized.includes("gestir") || normalized.includes("attivit")) return "\uD83D\uDDC2\uFE0F";
  if (normalized.includes("profil")) return "\uD83D\uDC64";
  if (normalized.includes("person") || normalized.includes("team") || normalized.includes("dipendent")) return "\uD83D\uDC65";
  if (normalized.includes("calend")) return "\uD83D\uDCC6";
  if (normalized.includes("turn")) return "\uD83D\uDD52";
  if (normalized.includes("richiest") || normalized.includes("chius") || normalized.includes("permess")) return "\uD83D\uDCDD";
  if (normalized.includes("mansion") || normalized.includes("note")) return "\u2705";
  if (normalized.includes("bacheca") || normalized.includes("messagg")) return "\uD83D\uDCE2";
  if (normalized.includes("cors") || normalized.includes("formaz")) return "\uD83C\uDF93";
  if (normalized.includes("document")) return "\uD83D\uDCC1";
  if (normalized.includes("timbr")) return "\uD83D\uDD58";
  if (normalized.includes("ore")) return "\u23F3";
  if (normalized.includes("impost")) return "\u2699\uFE0F";
  if (normalized.includes("export") || normalized.includes("report") || normalized.includes("pdf")) return "\uD83D\uDCC4";
  if (normalized.includes("sicurezza") || normalized.includes("password")) return "\uD83D\uDD12";
  if (normalized.includes("abbon") || normalized.includes("pagament") || normalized.includes("ricav")) return "\uD83D\uDCB3";
  if (normalized.includes("gps") || normalized.includes("posizion")) return "\uD83D\uDCCD";
  if (normalized.includes("dashboard") || normalized.includes("panoramica")) return "\uD83D\uDCCA";

  return "\uD83D\uDCCB";
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBottomNavItems(navItems: DashboardNavItem[]) {
  const preferredHrefs = [
    "/dashboard",
    "/dashboard/calendar",
    "/dashboard/tasks",
    "/dashboard/documents",
    "/dashboard/timelogs",
    "/dashboard/requests",
  ];
  const preferred = preferredHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is DashboardNavItem => Boolean(item));
  const fill = navItems.filter((item) => !preferred.some((selected) => selected.href === item.href));

  return [...preferred, ...fill].slice(0, 5);
}

function DashboardResponsiveStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .dashboard-shell {
        min-width: 0;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        padding-bottom: calc(128px + env(safe-area-inset-bottom)) !important;
        background: transparent !important;
      }

      .workbit-home-screen {
        display: grid;
        gap: 18px;
        padding-top: clamp(110px, 20vh, 190px);
      }

      .workbit-hours-hero-card,
      .workbit-today-shift-card,
      .workbit-next-shift-card {
        width: 100%;
        border-radius: 22px;
        background: #ffffff;
        border: 1px solid rgba(94, 92, 230, 0.10);
        box-shadow: 0 14px 28px rgba(61, 42, 153, 0.07);
      }

      .workbit-hours-hero-card {
        min-height: 122px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 18px;
      }

      .workbit-hours-hero-card strong {
        display: block;
        color: #0b1024;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: -0.02em;
      }

      .workbit-hours-hero-card span {
        color: #8e8e93;
        font-weight: 750;
      }

      .workbit-progress-ring {
        width: 74px;
        height: 74px;
        border-radius: 999px;
        padding: 8px;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
      }

      .workbit-progress-ring span {
        width: 52px;
        height: 52px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: #ffffff;
        color: #0b1024;
        font-size: 16px;
        font-weight: 900;
      }

      .workbit-clock-card {
        display: grid;
        gap: 20px;
        padding: 20px 24px 24px;
        border-radius: 22px;
        background: linear-gradient(135deg, #635BFF 0%, #4531D4 100%);
        color: #ffffff;
        box-shadow: 0 20px 34px rgba(69, 49, 212, 0.23);
      }

      .workbit-clock-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
      }

      .workbit-clock-card-header strong {
        display: block;
        font-size: 17px;
        font-weight: 900;
        letter-spacing: -0.02em;
      }

      .workbit-clock-card-header span {
        display: block;
        margin-top: 4px;
        color: rgba(255, 255, 255, 0.76);
        font-size: 13px;
        font-weight: 750;
      }

      .workbit-ready-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
        font-size: 12px;
        font-weight: 900;
      }

      .workbit-ready-pill i {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #34d399;
      }

      .workbit-ready-pill.is-muted i {
        background: #fbbf24;
      }

      .workbit-clock-card-actions {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 12px !important;
      }

      .workbit-clock-card .dashboard-button,
      .workbit-clock-card .dashboard-clock-button {
        min-height: 50px !important;
        border-radius: 13px !important;
        color: #ffffff !important;
        font-size: 16px !important;
        font-weight: 900 !important;
        box-shadow: none !important;
      }

      .workbit-clock-in {
        background: #34D35F !important;
        border-color: rgba(52, 211, 95, 0.55) !important;
      }

      .workbit-clock-out {
        background: #EF4444 !important;
        border-color: rgba(239, 68, 68, 0.55) !important;
      }

      .workbit-clock-card .dashboard-button:disabled {
        opacity: 0.62 !important;
      }

      .workbit-clock-feedback {
        margin: -8px 0 0;
        color: rgba(255, 255, 255, 0.84);
        font-size: 13px;
        font-weight: 750;
      }

      .workbit-today-shift-card,
      .workbit-next-shift-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 17px 20px;
      }

      .workbit-today-shift-card > span {
        width: 28px;
        height: 28px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: #f1edff;
        font-size: 14px;
      }

      .workbit-today-shift-card strong,
      .workbit-next-shift-card strong {
        display: block;
        color: #0b1024;
        font-size: 17px;
        font-weight: 900;
        line-height: 1.18;
      }

      .workbit-today-shift-card small {
        display: block;
        margin-top: 4px;
        color: #8e8e93;
        font-size: 13px;
        font-weight: 750;
      }

      .workbit-next-shift-card {
        padding-block: 14px;
      }

      .dashboard-profile-layout > div:first-child {
        order: 1;
      }

      .dashboard-profile-layout > .dashboard-panel {
        order: 2;
      }

      .dashboard-profile-layout > div:nth-child(2) {
        order: 3;
      }

      .dashboard-profile-layout > div:nth-child(2) > div {
        background: var(--workbit-card) !important;
        border: 1px solid var(--workbit-border) !important;
        box-shadow: var(--workbit-shadow) !important;
      }

      .dashboard-profile-layout > div:nth-child(2) > div strong {
        letter-spacing: -0.025em;
      }

      html[data-workbit-compact="true"] .dashboard-shell {
        padding-inline: 12px !important;
        overflow-x: hidden !important;
      }

      html[data-workbit-compact="true"] .dashboard-profile-summary-row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        align-items: stretch !important;
        justify-content: stretch !important;
      }

      html[data-workbit-compact="true"] .dashboard-profile-summary-row > * {
        min-width: 0 !important;
        width: 100% !important;
      }

      html[data-workbit-compact="true"] .dashboard-profile-hours-card {
        min-width: 0 !important;
        width: 100% !important;
      }

      html[data-workbit-compact="true"] .dashboard-profile-shift-grid {
        grid-template-columns: minmax(0, 1fr) !important;
        width: 100% !important;
      }

      html[data-workbit-compact="true"] .dashboard-clock-actions-row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        width: 100% !important;
      }

      html[data-workbit-compact="true"] .dashboard-shell-card,
      html[data-workbit-compact="true"] .dashboard-panel,
      html[data-workbit-compact="true"] .dashboard-card,
      html[data-workbit-compact="true"] .dashboard-item-card {
        max-width: 100% !important;
        overflow-x: hidden !important;
      }

      .dashboard-shell-inner,
      .dashboard-shell-card,
      .dashboard-panel,
      .dashboard-panel-header,
      .dashboard-shell-top,
      .dashboard-shell-header,
      .dashboard-shell-brand,
      .dashboard-top-nav,
      .dashboard-calendar-scroll,
      .dashboard-calendar-grid,
      .dashboard-week-strip,
      .dashboard-week-card,
      .dashboard-calendar-day,
      .dashboard-calendar-weekday,
      .dashboard-modal-wrap,
      .dashboard-modal-panel {
        min-width: 0;
        max-width: 100%;
      }

      .dashboard-shell *,
      .dashboard-modal-panel *,
      .super-admin-mobile-list * {
        box-sizing: border-box;
      }

      .dashboard-shell * {
        max-width: 100%;
      }

      .dashboard-button,
      .dashboard-menu-button,
      .dashboard-icon-button,
      .dashboard-bottom-nav a,
      .dashboard-work-session-timer,
      .dashboard-select-pill {
        transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease, background 140ms ease;
        touch-action: manipulation;
      }

      .dashboard-button {
        min-height: 38px !important;
        padding: 9px 15px !important;
        font-size: 13px !important;
        box-shadow: 0 7px 18px rgba(61, 42, 153, 0.08) !important;
      }

      .dashboard-icon-button {
        width: 36px !important;
        height: 36px !important;
        min-width: 36px !important;
        min-height: 36px !important;
        box-shadow: 0 5px 14px rgba(61, 42, 153, 0.055) !important;
      }

      .dashboard-select-pill {
        min-height: 42px !important;
        padding: 9px 13px !important;
        font-size: 14px !important;
        gap: 8px !important;
        box-shadow: 0 5px 14px rgba(61, 42, 153, 0.045) !important;
      }

      .dashboard-panel,
      .dashboard-card,
      .dashboard-item-card,
      .dashboard-modal-panel,
      .dashboard-empty-state {
        background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(253,252,255,0.94) 100%) !important;
        border-color: var(--workbit-border) !important;
        box-shadow: var(--workbit-shadow) !important;
      }

      .dashboard-button:hover:not(:disabled) {
        box-shadow: 0 12px 28px rgba(124, 58, 237, 0.14) !important;
      }

      .dashboard-button[style*="64748b"],
      .dashboard-button[style*="475569"] {
        background: linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%) !important;
        color: var(--workbit-navy) !important;
        border: 1px solid var(--workbit-border) !important;
      }

      .dashboard-select-pill,
      .dashboard-icon-button,
      .dashboard-menu-button {
        border-color: var(--workbit-border) !important;
        background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248,246,255,0.92) 100%) !important;
        color: var(--workbit-purple-dark) !important;
      }

      .dashboard-clock-button {
        min-height: 74px !important;
        padding: 0 18px !important;
        border-radius: 26px !important;
        font-size: 18px !important;
        font-weight: 850 !important;
        letter-spacing: -0.02em !important;
        box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12) !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .dashboard-button:active,
      .dashboard-menu-button:active,
      .dashboard-icon-button:active,
      .dashboard-bottom-nav a:active,
      .dashboard-select-pill:active {
        transform: scale(0.98);
      }

      .dashboard-panel,
      .dashboard-shell-card,
      .dashboard-item-card,
      .dashboard-list-card,
      .dashboard-summary-card,
      .dashboard-calendar-day,
      .dashboard-modal-panel {
        border-color: rgba(94, 92, 230, 0.13) !important;
      }

      .dashboard-form-field input:not([type="checkbox"]):not([type="radio"]),
      .dashboard-form-field select,
      .dashboard-form-field textarea,
      .dashboard-modal-panel input:not([type="checkbox"]):not([type="radio"]),
      .dashboard-modal-panel select,
      .dashboard-modal-panel textarea {
        border-radius: 18px !important;
        border: 1px solid var(--workbit-border) !important;
        background: var(--workbit-field-bg) !important;
        color: var(--workbit-text) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      .dashboard-form-field input:not([type="checkbox"]):not([type="radio"]):focus,
      .dashboard-form-field select:focus,
      .dashboard-form-field textarea:focus,
      .dashboard-modal-panel input:not([type="checkbox"]):not([type="radio"]):focus,
      .dashboard-modal-panel select:focus,
      .dashboard-modal-panel textarea:focus {
        outline: none !important;
        border-color: rgba(124, 58, 237, 0.48) !important;
        box-shadow: ${focusRing} !important;
      }

      .dashboard-form-field input[type="file"],
      .dashboard-modal-panel input[type="file"] {
        padding: 12px !important;
        cursor: pointer;
      }

      html[data-theme="dark"] .dashboard-form-field input[type="checkbox"],
      html[data-theme="dark"] .dashboard-form-field input[type="radio"],
      html[data-theme="dark"] .dashboard-modal-panel input[type="checkbox"],
      html[data-theme="dark"] .dashboard-modal-panel input[type="radio"] {
        color-scheme: light !important;
        accent-color: #7c3aed !important;
        background-color: #ffffff !important;
        border-color: #cbd5e1 !important;
      }

      .dashboard-button:hover:not(:disabled),
      .dashboard-icon-button:hover:not(:disabled),
      .dashboard-menu-button:hover:not(:disabled) {
        box-shadow: 0 14px 30px rgba(88, 28, 135, 0.14) !important;
      }

      .dashboard-bottom-nav a,
      .dashboard-menu-button,
      .dashboard-icon-button,
      .dashboard-arrow-link {
        border-color: rgba(124, 58, 237, 0.12) !important;
      }

      .dashboard-bottom-nav {
        width: min(360px, calc(var(--workbit-vw, 100vw) - 24px)) !important;
        max-width: calc(var(--workbit-vw, 100vw) - 24px) !important;
        left: max(12px, env(safe-area-inset-left)) !important;
        right: max(12px, env(safe-area-inset-right)) !important;
        margin-inline: auto !important;
        transform: translateZ(0) !important;
        contain: layout paint;
      }

      .dashboard-audience-options {
        grid-template-columns: 1fr 1fr;
      }

      @keyframes dashboardModalEnter {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .dashboard-form-actions,
      .dashboard-modal-actions,
      .dashboard-inline-actions,
      .dashboard-action-row,
      .dashboard-clock-actions,
      .dashboard-publish-row,
      .dashboard-toolbar {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .dashboard-inline-grid,
      .dashboard-member-grid,
      .dashboard-modal-body-grid,
      .dashboard-modal-members-grid,
      .dashboard-summary-grid {
        display: grid;
        gap: 12px;
      }

      .super-admin-mobile-list {
        display: none;
      }

      .dashboard-mobile-only {
        display: none !important;
      }

      .dashboard-desktop-only {
        display: block;
      }

      .dashboard-week-strip {
        display: none !important;
        align-items: flex-start;
        flex-wrap: nowrap;
        gap: 16px;
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 6px;
        scroll-snap-type: x proximity;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .dashboard-calendar-page .dashboard-week-strip {
        display: flex !important;
      }

      .dashboard-week-strip::-webkit-scrollbar {
        display: none;
      }

      .dashboard-week-card {
        display: none !important;
        flex: 0 0 min(360px, 100%);
        align-self: flex-start;
        width: min(360px, 100%);
        max-width: 100%;
        box-sizing: border-box;
        scroll-snap-align: start;
      }

      .dashboard-calendar-page .dashboard-week-card {
        display: grid !important;
      }

      .dashboard-week-card,
      .dashboard-week-card > *,
      .dashboard-calendar-day,
      .dashboard-calendar-day > * {
        min-width: 0;
        max-width: 100%;
      }

      .dashboard-calendar-page {
        width: 100%;
        max-width: 100%;
        overflow-x: clip;
        contain: layout paint;
        isolation: isolate;
      }

      @supports not (overflow: clip) {
        .dashboard-calendar-page {
          overflow-x: hidden;
        }
      }

      .dashboard-calendar-page .dashboard-week-strip,
      .dashboard-calendar-page .dashboard-calendar-scroll {
        contain: layout paint;
      }

      .dashboard-calendar-day {
        contain: layout paint;
      }

      .dashboard-modal-wrap {
        padding:
          max(16px, env(safe-area-inset-top))
          max(16px, env(safe-area-inset-right))
          max(16px, env(safe-area-inset-bottom))
          max(16px, env(safe-area-inset-left)) !important;
        overflow: hidden;
        overscroll-behavior: contain;
      }

      .dashboard-modal-panel {
        width: 100% !important;
        max-width: min(calc(var(--workbit-vw, 100vw) - 32px), 820px) !important;
        max-height: calc(var(--workbit-vh, 100dvh) - 32px) !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: clamp(18px, 2.8vw, 24px) !important;
        border-radius: 28px !important;
        box-shadow: 0 22px 56px rgba(88, 28, 135, 0.18) !important;
        animation: none;
        transform-origin: center;
        -webkit-overflow-scrolling: touch;
      }

      .dashboard-modal-panel > * {
        min-width: 0;
      }

      .dashboard-stack {
        align-items: start;
      }

      .dashboard-scroll-list {
        max-height: min(420px, calc(var(--workbit-vh, 100dvh) * 0.6));
        overflow-y: auto;
        padding-right: 0;
        overscroll-behavior: contain;
      }

      @media (max-width: 900px) {
        .dashboard-shell {
          padding: 12px !important;
          padding-bottom: calc(132px + env(safe-area-inset-bottom)) !important;
          font-size: 16px !important;
          overflow-x: hidden;
        }

        .dashboard-shell-card,
        .dashboard-panel {
          padding: 18px !important;
          border-radius: 24px !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        .dashboard-shell-top {
          gap: 14px !important;
        }

        .dashboard-modal-header,
        .dashboard-inline-actions,
        .dashboard-action-row,
        .dashboard-form-actions,
        .dashboard-toolbar {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .dashboard-shell-header {
          align-items: center !important;
        }

        .dashboard-shell-brand {
          gap: 6px !important;
        }

        .dashboard-shell-meta {
          display: none !important;
        }

        .dashboard-panel-title,
        .dashboard-item-card strong,
        .dashboard-list-card strong {
          font-size: 18px !important;
        }

        .dashboard-panel,
        .dashboard-item-card,
        .dashboard-list-card,
        .dashboard-summary-card,
        .dashboard-calendar-day,
        .dashboard-calendar-weekday {
          font-size: 15px !important;
        }

        .dashboard-form-actions .dashboard-button,
        .dashboard-inline-actions .dashboard-button,
        .dashboard-action-row .dashboard-button {
          width: 100% !important;
          min-width: 0 !important;
        }

        .dashboard-inline-actions > *,
        .dashboard-action-row > *,
        .dashboard-modal-actions > * {
          width: 100%;
        }

        .dashboard-top-nav {
          width: auto !important;
          justify-content: flex-end !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .dashboard-header-action,
        .dashboard-top-nav .dashboard-menu-button,
        .dashboard-top-nav .dashboard-icon-button {
          flex: 0 0 auto;
        }

        .dashboard-work-session-timer {
          min-height: 40px !important;
          padding: 8px 14px !important;
          gap: 8px !important;
        }

        .dashboard-work-session-timer-dot {
          width: 7px !important;
          height: 7px !important;
        }

        .dashboard-work-session-timer-value {
          font-size: 17px !important;
        }

        .dashboard-stack {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 16px !important;
          align-items: start !important;
          overflow: visible !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .dashboard-inline-grid,
        .dashboard-member-grid,
        .dashboard-stats-grid,
        .dashboard-summary-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .dashboard-item-card,
        .dashboard-list-card,
        .dashboard-summary-card {
          padding: 16px !important;
          border-radius: 18px !important;
        }

        .dashboard-calendar-scroll {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          margin-inline: 0;
          padding-bottom: 4px;
        }

        .dashboard-calendar-grid {
          grid-template-columns: repeat(7, minmax(148px, 1fr)) !important;
          min-width: 1040px;
          gap: 10px !important;
        }

        .dashboard-calendar-day {
          min-height: 180px !important;
          padding: 14px !important;
          border-radius: 18px !important;
        }

        .dashboard-modal-wrap {
          padding:
            max(16px, env(safe-area-inset-top))
            max(16px, env(safe-area-inset-right))
            max(16px, env(safe-area-inset-bottom))
            max(16px, env(safe-area-inset-left)) !important;
          place-items: center !important;
        }

        .dashboard-modal-panel {
          width: 100% !important;
          max-width: min(420px, calc(var(--workbit-vw, 100vw) - 32px)) !important;
          max-height: calc(var(--workbit-vh, 100dvh) - 32px) !important;
          padding: 18px !important;
          border-radius: 24px !important;
          overscroll-behavior: contain;
        }

        .dashboard-modal-body-grid,
        .dashboard-modal-members-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .dashboard-modal-actions > * {
          width: 100%;
        }

        .dashboard-compact-filters,
        .dashboard-publish-row {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .dashboard-publish-row > * {
          width: 100%;
        }

        .dashboard-clock-actions {
          flex-direction: column !important;
          align-items: stretch !important;
        }

      .dashboard-clock-actions > * {
        width: 100%;
      }

        .calendar-publish-panel {
          width: 100% !important;
        }

        .calendar-publish-actions {
          display: flex !important;
          align-items: center !important;
          justify-content: stretch !important;
          gap: 8px !important;
          width: 100% !important;
        }

        .calendar-publish-actions > * {
          width: 100% !important;
          min-width: 0 !important;
        }

        .calendar-publish-actions > span {
          grid-column: 1 / -1;
          text-align: center;
          font-size: 12px !important;
        }

        .dashboard-list-button {
          flex-direction: column !important;
          align-items: flex-start !important;
        }

        .dashboard-list-button-arrow {
          align-self: flex-end;
        }

        .dashboard-audience-options {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          gap: 8px !important;
        }

        .dashboard-select-pill {
          min-height: 42px !important;
          font-size: 14px !important;
        }

        .dashboard-table-desktop {
          display: none !important;
        }

        .dashboard-mobile-only {
          display: grid !important;
        }

        .dashboard-desktop-only {
          display: none !important;
        }

        .dashboard-mobile-only.dashboard-week-strip {
          display: flex !important;
          align-items: flex-start !important;
          flex-wrap: nowrap !important;
          gap: 12px !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding-inline: 0 !important;
          margin: 0 !important;
          padding-bottom: 6px;
          scroll-snap-type: x mandatory !important;
          scroll-padding-inline: 0 !important;
        }

        .dashboard-bottom-nav {
          width: min(360px, calc(var(--workbit-vw, 100vw) - 24px)) !important;
          left: max(12px, env(safe-area-inset-left)) !important;
          right: max(12px, env(safe-area-inset-right)) !important;
          margin-inline: auto !important;
          transform: translateZ(0) !important;
          justify-content: space-between !important;
          gap: 6px !important;
        }

        .dashboard-bottom-nav a {
          width: clamp(52px, 16vw, 58px) !important;
          min-height: 52px !important;
        }

        .dashboard-week-card {
          flex: 0 0 100% !important;
          align-self: flex-start !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          scroll-snap-align: start !important;
          scroll-snap-stop: always !important;
          content-visibility: visible !important;
          contain-intrinsic-size: none !important;
        }

        .super-admin-mobile-list {
          display: grid;
          gap: 12px;
        }

        .dashboard-scroll-list {
          max-height: 320px !important;
        }
      }

      .dashboard-shell-card {
        padding: 20px !important;
        border-radius: 34px !important;
        background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%) !important;
        border: 1px solid rgba(94, 92, 230, 0.14) !important;
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
      .dashboard-empty-state {
        background: linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(255,255,255,0.94) 58%, rgba(250,248,255,0.92) 100%) !important;
        border: 1px solid rgba(94, 92, 230, 0.13) !important;
        box-shadow: 0 8px 24px rgba(61, 42, 153, 0.075) !important;
      }

      .dashboard-page-hero,
      .dashboard-panel,
      .dashboard-card {
        border-radius: 32px !important;
      }

      .dashboard-item-card,
      .dashboard-list-card,
      .dashboard-compact-list-item,
      .dashboard-summary-card,
      .dashboard-calendar-day {
        border-radius: 24px !important;
      }

      .dashboard-modal-wrap,
      .dashboard-menu-overlay {
        background: rgba(24, 18, 42, 0.28) !important;
        backdrop-filter: blur(20px) saturate(145%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(145%) !important;
      }

      .dashboard-modal-panel {
        background: linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(252,250,255,0.97) 100%) !important;
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
        background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(244,239,255,0.96) 100%) !important;
        border-color: rgba(124, 58, 237, 0.18) !important;
        box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.06), 0 12px 28px rgba(124, 58, 237, 0.16) !important;
      }

      .dashboard-menu-button,
      .dashboard-icon-button,
      .dashboard-select-pill,
      .dashboard-form-field input:not([type="checkbox"]):not([type="radio"]),
      .dashboard-form-field select,
      .dashboard-form-field textarea,
      .dashboard-modal-panel input:not([type="checkbox"]):not([type="radio"]),
      .dashboard-modal-panel select,
      .dashboard-modal-panel textarea {
        background: rgba(255,255,255,0.92) !important;
        border: 1px solid rgba(94, 92, 230, 0.14) !important;
        box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset !important;
      }

      .dashboard-panel-title,
      .dashboard-section-header h3,
      .dashboard-shell h1,
      .dashboard-shell h2 {
        color: #111827 !important;
        font-weight: 780 !important;
        letter-spacing: -0.045em !important;
      }

      /* Workbit Apple PDF skin: applied last so it wins over legacy inline styles. */
      .dashboard-shell {
        background: #efebfa !important;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, sans-serif !important;
        color: #1c1c1e !important;
      }

      .dashboard-shell-inner {
        gap: 16px !important;
      }

      .dashboard-shell-card {
        background: #ffffff !important;
        border: 1px solid rgba(60, 60, 67, 0.12) !important;
        border-radius: 28px !important;
        box-shadow: 0 6px 16px rgba(61, 42, 153, 0.08) !important;
        padding: 14px 18px !important;
      }

      .dashboard-shell-top {
        align-items: center !important;
      }

      .dashboard-shell-brand {
        gap: 8px !important;
      }

      .dashboard-page-hero {
        background: #ffffff !important;
        border: 1px solid rgba(60, 60, 67, 0.12) !important;
        border-radius: 26px !important;
        box-shadow: 0 6px 16px rgba(61, 42, 153, 0.08) !important;
        padding: 16px 18px !important;
      }

      .dashboard-page-hero > div:first-child {
        gap: 5px !important;
      }

      .dashboard-page-hero h2,
      .dashboard-shell h1,
      .dashboard-section-header h3,
      .dashboard-panel-title {
        color: #1c1c1e !important;
        font-weight: 850 !important;
        letter-spacing: -0.035em !important;
      }

      .dashboard-page-hero p,
      .dashboard-shell p,
      .dashboard-section-header div,
      .dashboard-panel label,
      .dashboard-panel small {
        color: #8e8e93 !important;
      }

      .dashboard-stack,
      .dashboard-item-list {
        gap: 16px !important;
      }

      .dashboard-panel,
      .dashboard-card,
      .dashboard-item-card,
      .dashboard-list-card,
      .dashboard-compact-list-item,
      .dashboard-summary-card,
      .dashboard-calendar-day,
      .dashboard-calendar-weekday,
      .dashboard-empty-state {
        background: #ffffff !important;
        border: 1px solid rgba(60, 60, 67, 0.12) !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
      }

      .dashboard-panel,
      .dashboard-card {
        border-radius: 18px !important;
        padding: 16px !important;
      }

      .dashboard-card-grid,
      .dashboard-summary-grid,
      .dashboard-stats-grid {
        gap: 10px !important;
      }

      .dashboard-item-card,
      .dashboard-list-card,
      .dashboard-compact-list-item,
      .dashboard-summary-card,
      .dashboard-calendar-day,
      .dashboard-empty-state {
        border-radius: 18px !important;
      }

      .dashboard-item-card,
      .dashboard-compact-list-item {
        padding: 14px 16px !important;
      }

      .dashboard-panel-header {
        margin-bottom: 12px !important;
        padding: 0 4px 2px !important;
      }

      .dashboard-panel-header > div:first-child > span,
      .dashboard-section-header span[aria-hidden="true"] {
        font-size: 22px !important;
        line-height: 1 !important;
      }

      .dashboard-panel-header > div:first-child,
      .dashboard-section-header > div > div:first-child {
        gap: 9px !important;
      }

      .dashboard-button,
      .dashboard-menu-button,
      .dashboard-icon-button,
      .dashboard-select-pill,
      .dashboard-arrow-link,
      .dashboard-list-button,
      .dashboard-work-session-timer {
        border-radius: 999px !important;
        border: 1px solid rgba(94, 92, 230, 0.18) !important;
        box-shadow: none !important;
      }

      .dashboard-button:not([style*="linear-gradient"]):not([style*="#dc2626"]):not([style*="#ef4444"]),
      .dashboard-menu-button,
      .dashboard-icon-button,
      .dashboard-select-pill {
        background: #f5f3fc !important;
        color: #3d2a99 !important;
      }

      .dashboard-button[style*="linear-gradient"],
      .dashboard-button[style*="#5b21b6"],
      .dashboard-button[style*="#7c3aed"],
      .dashboard-button[style*="var(--workbit-gradient)"] {
        background: linear-gradient(135deg, #3d2a99 0%, #5e5ce6 58%, #8b5cf6 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 16px 32px rgba(76, 60, 220, 0.28) !important;
      }

      .dashboard-button[style*="#dc2626"],
      .dashboard-button[style*="#ef4444"],
      button[style*="#dc2626"],
      button[style*="#ef4444"] {
        background: linear-gradient(135deg, #dc2626 0%, #ff3b30 100%) !important;
        color: #ffffff !important;
        border-color: rgba(255, 59, 48, 0.32) !important;
      }

      .dashboard-form-field input:not([type="checkbox"]):not([type="radio"]),
      .dashboard-form-field select,
      .dashboard-form-field textarea,
      .dashboard-modal-panel input:not([type="checkbox"]):not([type="radio"]),
      .dashboard-modal-panel select,
      .dashboard-modal-panel textarea {
        background: #ffffff !important;
        border: 1px solid rgba(60, 60, 67, 0.12) !important;
        border-radius: 14px !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
        color: #1c1c1e !important;
      }

      .dashboard-modal-wrap,
      .dashboard-menu-overlay {
        background: rgba(28, 28, 30, 0.28) !important;
        backdrop-filter: blur(20px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(140%) !important;
      }

      .dashboard-modal-panel {
        background: #ffffff !important;
        border: 1px solid rgba(60, 60, 67, 0.12) !important;
        border-radius: 28px !important;
        box-shadow: 0 28px 70px rgba(28, 28, 30, 0.24) !important;
        padding: 20px !important;
      }

      .dashboard-bottom-nav {
        width: min(390px, calc(var(--workbit-vw, 100vw) - 36px)) !important;
        padding: 12px 8px !important;
        border-radius: 30px !important;
        background: rgba(255, 255, 255, 0.88) !important;
        border: 1px solid rgba(60, 60, 67, 0.12) !important;
        box-shadow: 0 10px 24px rgba(61, 42, 153, 0.14) !important;
        backdrop-filter: blur(20px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(140%) !important;
      }

      .dashboard-bottom-nav a {
        width: 58px !important;
        min-height: 58px !important;
        border-radius: 24px !important;
        background: transparent !important;
        border-color: transparent !important;
        box-shadow: none !important;
        color: #3d2a99 !important;
        gap: 5px !important;
      }

      .dashboard-bottom-nav a[aria-current="page"] {
        background: #edecfc !important;
        border: 1px solid rgba(94, 92, 230, 0.22) !important;
        box-shadow: 0 0 0 6px rgba(94, 92, 230, 0.10) !important;
      }

      @media (min-width: 901px) {
        .dashboard-shell-inner {
          max-width: 1180px !important;
        }
      }

      @media (max-width: 900px) {
        .dashboard-shell {
          padding: 14px 16px !important;
          padding-bottom: calc(132px + env(safe-area-inset-bottom)) !important;
        }

        .dashboard-shell-inner {
          max-width: 430px !important;
          margin: 0 auto !important;
        }

        .dashboard-shell-card {
          border-radius: 28px !important;
        }

        .dashboard-page-hero {
          border-radius: 26px !important;
        }

        .dashboard-page-hero h2 {
          font-size: 21px !important;
        }

        .dashboard-panel-title,
        .dashboard-section-header h3 {
          font-size: 17px !important;
        }
      }

      .dashboard-clock-actions {
        gap: 10px !important;
      }

      .dashboard-clock-actions-row {
        display: flex !important;
        gap: 10px !important;
        align-items: stretch !important;
      }

      .dashboard-clock-button {
        min-height: 58px !important;
        border-radius: 16px !important;
        font-size: 16px !important;
        font-weight: 850 !important;
        letter-spacing: 0.04em !important;
        color: #ffffff !important;
        box-shadow: none !important;
      }

      .dashboard-clock-actions-row .dashboard-clock-button:first-child {
        background: linear-gradient(135deg, #16a34a 0%, #22c55e 58%, #34c759 100%) !important;
        border: 1px solid rgba(52, 199, 89, 0.78) !important;
        box-shadow: 0 12px 26px rgba(52, 199, 89, 0.24) !important;
      }

      .dashboard-clock-actions-row .dashboard-clock-button:last-child {
        background: linear-gradient(135deg, #dc2626 0%, #ef4444 58%, #ff3b30 100%) !important;
        border: 1px solid rgba(255, 59, 48, 0.78) !important;
        box-shadow: 0 12px 26px rgba(255, 59, 48, 0.22) !important;
      }

      .dashboard-clock-actions-row .dashboard-clock-button:disabled {
        filter: saturate(0.55);
        opacity: 0.55 !important;
      }

      .dashboard-clock-actions-row .dashboard-clock-button:first-child:disabled {
        background: linear-gradient(135deg, #bbf7d0 0%, #dcfce7 100%) !important;
        color: #15803d !important;
        box-shadow: none !important;
      }

      .dashboard-clock-actions-row .dashboard-clock-button:last-child:disabled {
        background: linear-gradient(135deg, #fecaca 0%, #fee2e2 100%) !important;
        color: #b91c1c !important;
        box-shadow: none !important;
      }

      .dashboard-shell {
        background:
          radial-gradient(circle at 74% 6%, rgba(255,255,255,0.62), transparent 28%),
          linear-gradient(180deg, #F1ECFC 0%, #ECE7F8 100%) !important;
      }

      .dashboard-shell-content > .dashboard-panel:first-child,
      .dashboard-shell-content > .dashboard-page-hero:first-child {
        margin-top: clamp(96px, 17vh, 170px) !important;
      }

      .dashboard-shell-card {
        border-radius: 26px !important;
        background: rgba(255, 255, 255, 0.92) !important;
        border: 1px solid rgba(94, 92, 230, 0.11) !important;
        box-shadow: 0 14px 30px rgba(61, 42, 153, 0.08) !important;
      }

      .dashboard-menu-button,
      .dashboard-icon-button {
        background: #F7F5FF !important;
        color: #3D2A99 !important;
        border: 1px solid rgba(94, 92, 230, 0.18) !important;
        box-shadow: none !important;
      }

      .dashboard-panel,
      .dashboard-card,
      .dashboard-item-card,
      .dashboard-list-card,
      .dashboard-summary-card,
      .dashboard-calendar-day,
      .dashboard-modal-panel {
        border-radius: 22px !important;
        background: #ffffff !important;
        border: 1px solid rgba(94, 92, 230, 0.10) !important;
        box-shadow: 0 12px 26px rgba(61, 42, 153, 0.055) !important;
      }

      .dashboard-panel-header,
      .dashboard-section-header {
        align-items: center !important;
      }

      .dashboard-panel-title,
      .dashboard-section-header h3,
      .dashboard-page-hero h2 {
        color: #151526 !important;
        letter-spacing: -0.03em !important;
      }

      .dashboard-calendar-page {
        padding-top: clamp(110px, 19vh, 180px) !important;
      }

      .dashboard-calendar-page .dashboard-panel:first-child,
      .dashboard-calendar-page .dashboard-page-hero:first-child {
        margin-top: 0 !important;
      }

      .dashboard-calendar-day {
        overflow: hidden !important;
      }

      .dashboard-calendar-day strong {
        color: #151526 !important;
      }

      .dashboard-calendar-day .dashboard-item-card {
        padding: 8px 10px !important;
        border-radius: 13px !important;
        box-shadow: none !important;
      }

      .dashboard-bottom-nav {
        background: rgba(255, 255, 255, 0.92) !important;
        border: 1px solid rgba(94, 92, 230, 0.12) !important;
        box-shadow: 0 18px 34px rgba(61, 42, 153, 0.14) !important;
      }

      .dashboard-bottom-nav a[aria-current="page"] {
        background: #EFECFF !important;
        outline: 6px solid rgba(94, 92, 230, 0.10) !important;
        outline-offset: 0 !important;
        box-shadow: none !important;
      }

      .dashboard-menu-overlay nav {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        padding-inline: 18px !important;
      }

      .dashboard-menu-overlay nav > div:nth-child(2),
      .dashboard-menu-overlay nav > div:nth-child(3) {
        border-radius: 16px !important;
      }

      @media (max-width: 900px) {
        .dashboard-clock-button {
          min-height: 62px !important;
          border-radius: 16px !important;
        }

        .dashboard-shell-card {
          width: min(306px, calc(100vw - 56px)) !important;
          margin: 34px auto 0 !important;
          padding: 12px 18px !important;
          border-radius: 24px !important;
        }

        .dashboard-shell-top {
          gap: 10px !important;
        }

        .dashboard-shell-brand > a {
          font-size: 20px !important;
          font-weight: 900 !important;
        }

        .dashboard-menu-button,
        .dashboard-icon-button {
          width: 40px !important;
          height: 40px !important;
          min-width: 40px !important;
          min-height: 40px !important;
        }

        .dashboard-shell-content {
          gap: 16px !important;
        }

        .dashboard-shell-content > .dashboard-panel:first-child,
        .dashboard-shell-content > .dashboard-page-hero:first-child {
          margin-top: clamp(110px, 20vh, 185px) !important;
        }

        .workbit-home-screen,
        .dashboard-calendar-page {
          padding-top: clamp(132px, 24vh, 210px) !important;
        }

        .workbit-hours-hero-card,
        .workbit-clock-card,
        .workbit-today-shift-card,
        .workbit-next-shift-card {
          border-radius: 22px !important;
        }

        .dashboard-panel,
        .dashboard-card,
        .dashboard-item-card,
        .dashboard-list-card,
        .dashboard-summary-card {
          border-radius: 20px !important;
        }
      }
    `,
      }}
    />
  );
}

export function DashboardShell({
  userName,
  role,
  barName,
  appName,
  menuLabel,
  navItems,
  menuContent,
  headerAction,
  belowHeader,
  brandContent,
  headerSwitch,
  children,
}: {
  userName: string;
  role: string;
  barName: string;
  appName: string;
  menuLabel: string;
  navItems: DashboardNavItem[];
  menuContent?: ReactNode;
  headerAction?: ReactNode;
  belowHeader?: ReactNode;
  brandContent?: ReactNode;
  headerSwitch?: {
    activeBarId: string | null;
    bars: Array<{ id: string; name: string }>;
  };
  children: ReactNode;
}) {
  const bottomNavItems = getBottomNavItems(navItems);
  const menuNavItems =
    bottomNavItems.length > 1
      ? navItems.filter(
          (item) => !bottomNavItems.some((bottomItem) => bottomItem.href === item.href)
        )
      : navItems;

  const headerCard = (
    <RevealOnScroll
      as="section"
      className="dashboard-shell-card"
      style={{
        ...shellCardStyle,
        borderRadius: 28,
        padding: "14px 18px",
        boxShadow: "0 6px 16px rgba(61, 42, 153, 0.08)",
      }}
    >
      <div
        className="dashboard-shell-top"
        style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
        }}
      >
        <div
          className="dashboard-shell-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div className="dashboard-shell-brand" style={{ display: "grid", gap: 6, minWidth: 0 }}>
            {brandContent ?? (
              <BrandLogo
                href={navItems[0]?.href ?? "/dashboard"}
                size={34}
                showIcon
                label={appName}
                style={{ gap: 10 }}
              />
            )}
            <div className="dashboard-shell-meta" style={{ display: "grid", gap: 4 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  lineHeight: 1.05,
                  color: "var(--workbit-navy)",
                  fontWeight: 800,
                }}
              >
                {barName}
              </h1>
              <p style={{ margin: 0, color: "var(--workbit-muted)", lineHeight: 1.35, fontSize: 13, fontWeight: 600 }}>
                {userName} - {role}
              </p>
            </div>
          </div>
        </div>

        <div
          className="dashboard-top-nav"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {headerAction ? <div className="dashboard-header-action">{headerAction}</div> : null}
          <DashboardNavMenu
            navItems={menuNavItems}
            menuLabel={menuLabel}
            menuContent={menuContent}
            brandHref={navItems[0]?.href ?? "/dashboard"}
          />
        </div>
      </div>
    </RevealOnScroll>
  );

  return (
    <main
      className="dashboard-shell workbit-animated-page"
      style={{
        position: "relative",
        isolation: "isolate",
        minHeight: "var(--workbit-vh, 100dvh)",
        background: "transparent",
        padding: 18,
      }}
    >
      <div
        className="dashboard-shell-inner workbit-animated-page__content"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1320,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        {headerSwitch ? (
          <BarHeaderSwitcher activeBarId={headerSwitch.activeBarId} bars={headerSwitch.bars}>
            {headerCard}
          </BarHeaderSwitcher>
        ) : (
          headerCard
        )}

        {belowHeader ? (
          <div
            className="dashboard-shell-below-header"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 0,
              marginTop: -6,
              marginBottom: -2,
              pointerEvents: "none",
            }}
          >
            {belowHeader}
          </div>
        ) : null}

        <div className="dashboard-shell-content" style={{ display: "grid", gap: 18, alignItems: "start", minWidth: 0 }}>{children}</div>
      </div>
      <ActiveBottomNav navItems={navItems} />
      <DashboardResponsiveStyles />
    </main>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <RevealOnScroll
      as="section"
      className="dashboard-page-hero"
      style={{
        ...shellCardStyle,
        padding: "16px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            aria-hidden="true"
            style={{
              width: "auto",
              height: "auto",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "var(--workbit-purple-dark)",
              fontSize: 25,
            }}
          >
            {resolveUiEmoji(title)}
          </span>
          <p
            style={{
              margin: 0,
              color: "var(--workbit-muted)",
              fontSize: 12,
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.16em",
            }}
          >
            {eyebrow ?? "Workspace"}
          </p>
        </div>
        <h2 style={{ margin: 0, fontSize: 21, color: "#1C1C1E", fontWeight: 850, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
        <p style={{ margin: 0, color: "var(--workbit-muted)", lineHeight: 1.45, fontSize: 13.5, fontWeight: 500 }}>
          {subtitle}
        </p>
      </div>
      {action ? <div>{action}</div> : null}
    </RevealOnScroll>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RevealOnScroll
      as="section"
      className={joinClassNames("dashboard-panel", className)}
      style={{
        ...shellCardStyle,
        padding: 16,
      }}
    >
      <div
        className="dashboard-panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: "auto",
              height: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "inherit",
              fontSize: 21,
              flex: "0 0 auto",
            }}
          >
            {resolveUiEmoji(title)}
          </span>
          <h3 className="dashboard-panel-title" style={{ margin: 0, fontSize: 17, color: "#1C1C1E", fontWeight: 800 }}>
            {title}
          </h3>
        </div>
        {action ? <div style={{ color: "#64748b", fontWeight: 600 }}>{action}</div> : null}
      </div>
      {children}
    </RevealOnScroll>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <RevealOnScroll
      as="section"
      className={joinClassNames("dashboard-card", className)}
      style={{
        ...shellCardStyle,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </RevealOnScroll>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="dashboard-section-header"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: "auto",
              height: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "inherit",
              fontSize: 18,
              flex: "0 0 auto",
            }}
          >
            {resolveUiEmoji(title)}
          </span>
          <h3 style={{ margin: 0, color: "#0f172a", fontSize: 20, letterSpacing: "-0.02em" }}>
            {title}
          </h3>
        </div>
        {subtitle ? (
          <div style={{ color: "#64748b", lineHeight: 1.55, fontSize: 14 }}>{subtitle}</div>
        ) : null}
      </div>
      {action ? <div style={{ flex: "0 0 auto" }}>{action}</div> : null}
    </div>
  );
}

export function Modal({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className="dashboard-modal-wrap"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        background: "rgba(15, 23, 42, 0.22)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <section
        className="dashboard-modal-panel"
        style={{ ...shellCardStyle, display: "grid", gap: 14, padding: 20, borderRadius: 30 }}
      >
        <div
          className="dashboard-modal-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <SectionHeader title={title} />
          {onClose ? (
            <IconButton type="button" onClick={onClose} aria-label="Chiudi">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>{children}</div>
        {footer ? <div className="dashboard-modal-actions">{footer}</div> : null}
      </section>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="dashboard-empty-state"
      style={{
        ...softCardStyle,
        borderRadius: 18,
        padding: 14,
        color: "var(--workbit-muted)",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

export function Stack({
  children,
  columns = "repeat(auto-fit, minmax(280px, 1fr))",
  className,
}: {
  children: ReactNode;
  columns?: string;
  className?: string;
}) {
  return (
    <div
      className={joinClassNames("dashboard-stack", className)}
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        gap: 18,
        alignItems: "start",
      }}
    >
      {children}
    </div>
  );
}

export function ItemList({
  children,
  scrollable = false,
  maxHeight,
}: {
  children: ReactNode;
  scrollable?: boolean;
  maxHeight?: number | string;
}) {
  return (
    <div
      className={joinClassNames("dashboard-item-list", scrollable ? "dashboard-scroll-list" : undefined)}
      style={{
        display: "grid",
        gap: 12,
        ...(scrollable
          ? {
              maxHeight:
                typeof maxHeight === "number"
                  ? `${maxHeight}px`
                  : maxHeight ?? "min(420px, calc(var(--workbit-vh, 100dvh) * 0.6))",
              overflowY: "auto",
              paddingRight: 0,
            }
          : {}),
      }}
    >
      {children}
    </div>
  );
}

export function ItemCard({
  title,
  subtitle,
  meta,
  footer,
  className,
  style,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <RevealOnScroll
      className={joinClassNames("dashboard-item-card", className)}
      style={{
        ...softCardStyle,
        padding: 14,
        borderRadius: 18,
        display: "grid",
        gap: 6,
        ...style,
      }}
    >
      <strong style={{ color: "#1C1C1E", fontSize: 14.5, fontWeight: 700 }}>{title}</strong>
      {subtitle ? <div style={{ color: "#8E8E93", fontSize: 13.5, lineHeight: 1.45 }}>{subtitle}</div> : null}
      {meta ? <div style={{ color: "var(--workbit-muted)", fontSize: 14 }}>{meta}</div> : null}
      {footer ? <div style={{ marginTop: 8 }}>{footer}</div> : null}
    </RevealOnScroll>
  );
}

export function CompactListItem({
  title,
  subtitle,
  meta,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <RevealOnScroll
      className="dashboard-compact-list-item"
      style={{
        ...softCardStyle,
        borderRadius: 18,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <strong style={{ color: "#1C1C1E", fontSize: 14.5, fontWeight: 700 }}>{title}</strong>
        {subtitle ? <span style={{ color: "#8E8E93", fontSize: 12.5, lineHeight: 1.35 }}>{subtitle}</span> : null}
        {meta ? <span style={{ color: "var(--workbit-muted)", fontSize: 12, fontWeight: 700 }}>{meta}</span> : null}
      </div>
      {action ? <div style={{ flex: "0 0 auto" }}>{action}</div> : null}
    </RevealOnScroll>
  );
}

export function FormField({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={joinClassNames("dashboard-form-field", className)} style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 600, color: "var(--workbit-navy)" }}>{label}</span>
      {children}
      {hint ? <span style={{ color: "var(--workbit-muted)", fontSize: 13 }}>{hint}</span> : null}
    </label>
  );
}

const fieldStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(60, 60, 67, 0.12)",
  padding: "13px 15px",
  fontSize: 15,
  background: "#ffffff",
  width: "100%",
  color: "#1C1C1E",
  boxSizing: "border-box",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  if (props.type !== "date") {
    return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
  }

  const today = getTodayInputValue();
  const min = typeof props.min === "string" && props.min > today ? props.min : today;
  const value = typeof props.value === "string" && props.value && props.value < min ? min : props.value;

  return (
    <input
      {...props}
      min={min}
      value={value}
      style={{ ...fieldStyle, ...props.style }}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        ...fieldStyle,
        minHeight: 110,
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        ...fieldStyle,
        appearance: "none",
        backgroundImage:
          "linear-gradient(45deg, transparent 50%, var(--workbit-purple-dark) 50%), linear-gradient(135deg, var(--workbit-purple-dark) 50%, transparent 50%)",
        backgroundPosition: "calc(100% - 18px) 52%, calc(100% - 12px) 52%",
        backgroundSize: "6px 6px, 6px 6px",
        backgroundRepeat: "no-repeat",
        paddingRight: 38,
        ...props.style,
      }}
    />
  );
}

export function PrimaryButton({
  children,
  tone = "dark",
  pendingLabel,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "dark" | "green" | "red" | "sand";
  pendingLabel?: React.ReactNode;
}) {
  const backgrounds = {
    dark: "var(--workbit-gradient)",
    green: "linear-gradient(135deg, #15803d 0%, #22c55e 58%, #4ade80 100%)",
    red: "linear-gradient(135deg, #b91c1c 0%, #ef4444 58%, #fb7185 100%)",
    sand: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
  };

  return (
    <PendingButton
      {...props}
      pendingLabel={pendingLabel}
      className={joinClassNames("dashboard-button", props.className)}
      style={{
        background: backgrounds[tone],
        color: tone === "sand" ? "var(--workbit-navy)" : "#ffffff",
        border: tone === "sand" ? "1px solid var(--workbit-border)" : tone === "red" ? "1px solid rgba(239, 68, 68, 0.75)" : tone === "green" ? "1px solid rgba(34, 197, 94, 0.75)" : 0,
        borderRadius: 999,
        minHeight: 38,
        padding: "9px 15px",
        fontSize: 13,
        fontWeight: 760,
        letterSpacing: "-0.01em",
        boxShadow: "0 10px 22px rgba(124, 58, 237, 0.13)",
        transition: "transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
        touchAction: "manipulation",
        ...props.style,
      }}
      idleStyle={{
        cursor: "pointer",
        opacity: 1,
      }}
      pendingStyle={{
        cursor: "default",
        opacity: 0.65,
      }}
    >
      {children}
    </PendingButton>
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "dark" | "green" | "red" | "sand";
  pendingLabel?: React.ReactNode;
}) {
  return <PrimaryButton {...props} />;
}

export function IconButton({
  children,
  pendingLabel,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: React.ReactNode;
}) {
  return (
    <PendingButton
      {...props}
      pendingLabel={pendingLabel}
      className={joinClassNames("dashboard-icon-button", props.className)}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: "1px solid var(--workbit-border)",
        background: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
        color: "var(--workbit-purple-dark)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 18px rgba(124, 58, 237, 0.08)",
        touchAction: "manipulation",
        ...props.style,
      }}
      idleStyle={{
        cursor: "pointer",
        opacity: 1,
      }}
      pendingStyle={{
        cursor: "default",
        opacity: 0.65,
      }}
    >
      {children}
    </PendingButton>
  );
}

export function ArrowLinkButton({
  href,
}: {
  href: string;
}) {
  return (
    <Link
      href={href}
      className="dashboard-arrow-link"
      aria-label="Apri sezione"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 999,
        textDecoration: "none",
        background: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
        color: "var(--workbit-purple-dark)",
        border: "1px solid var(--workbit-border)",
        fontSize: 16,
        fontWeight: 700,
        boxShadow: "0 8px 18px rgba(124, 58, 237, 0.08)",
      }}
    >
      {">"}
    </Link>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const palette = {
    neutral: { background: "#f7f3ff", color: "#5b21b6", border: "1px solid rgba(124, 58, 237, 0.16)" },
    success: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
    warning: { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" },
    danger: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tone === "success" ? 6 : 0,
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        ...palette[tone],
      }}
    >
      {tone === "success" ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.25 6.25 4.75 8.75 9.75 3.75"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {label}
    </span>
  );
}

export function Badge(props: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return <StatusPill {...props} />;
}

export function SuccessCallout({
  children,
  style: _style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  void _style;
  return <ConfirmationToast>{children}</ConfirmationToast>;
}

export function BillingRequiredState({
  role,
  showManageButton = true,
}: {
  role: string;
  showManageButton?: boolean;
}) {
  const canManageBilling = role === "OWNER" && showManageButton;

  return (
    <Panel title="Abbonamento richiesto">
      <div style={{ display: "grid", gap: 14 }}>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
          Questo locale e attualmente bloccato perche l&apos;abbonamento non e attivo.
        </p>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.7 }}>
          {canManageBilling
            ? "Attiva o rinnova l’abbonamento per sbloccare turni, timbrature, mansioni, bacheca e report."
            : "Contatta il titolare del locale per riattivare l’abbonamento e sbloccare le funzionalita operative."}
        </p>
        {canManageBilling ? (
          <div>
            <Link
              href="/dashboard/settings?billing=1"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f172a",
                color: "#ffffff",
                borderRadius: 999,
                padding: "12px 18px",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 10px 20px rgba(15, 23, 42, 0.14)",
              }}
            >
              Vai all&apos;abbonamento
            </Link>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
