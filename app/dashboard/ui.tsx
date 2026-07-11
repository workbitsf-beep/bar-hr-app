import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ConfirmationToast } from "@/app/components/confirmation-toast";
import { PendingButton } from "@/app/components/pending-button";
import { ActiveBottomNav } from "./bottom-nav";
import {
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  formatDateTimeLocalInTimeZone,
} from "@/lib/time-zone";
import type { DashboardNavItem } from "./context";
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
  background: "var(--workbit-card)",
  border: "1px solid var(--workbit-border)",
  borderRadius: 30,
  boxShadow: "var(--workbit-shadow)",
  backdropFilter: "blur(16px)",
};

const softCardStyle: CSSProperties = {
  background: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-surface-secondary) 100%)",
  border: "1px solid var(--workbit-border)",
  boxShadow: "var(--workbit-shadow)",
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
        background: var(--workbit-app-bg) !important;
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
      .dashboard-select-pill {
        transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease, background 140ms ease;
        touch-action: manipulation;
      }

      .dashboard-button {
        min-height: 38px !important;
        padding: 9px 15px !important;
        font-size: 13px !important;
        box-shadow: 0 8px 18px rgba(88, 28, 135, 0.10) !important;
      }

      .dashboard-icon-button {
        width: 36px !important;
        height: 36px !important;
        min-width: 36px !important;
        min-height: 36px !important;
        box-shadow: 0 6px 14px rgba(88, 28, 135, 0.06) !important;
      }

      .dashboard-select-pill {
        min-height: 42px !important;
        padding: 9px 13px !important;
        font-size: 14px !important;
        gap: 8px !important;
        box-shadow: 0 6px 14px rgba(15, 23, 42, 0.035) !important;
      }

      .dashboard-panel,
      .dashboard-card,
      .dashboard-item-card,
      .dashboard-modal-panel,
      .dashboard-empty-state {
        background: var(--workbit-card) !important;
        border-color: var(--workbit-border) !important;
        box-shadow: var(--workbit-shadow) !important;
      }

      .dashboard-button:hover:not(:disabled) {
        box-shadow: 0 16px 34px rgba(124, 58, 237, 0.18) !important;
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
        background: linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%) !important;
        color: var(--workbit-purple-dark) !important;
      }

      .dashboard-modal-wrap::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 82% 10%, rgba(168, 85, 247, 0.12), transparent 28%),
          radial-gradient(circle at 18% 18%, rgba(11, 16, 36, 0.06), transparent 24%);
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
        border-color: rgba(124, 58, 237, 0.10) !important;
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

      .dashboard-calendar-day {
        content-visibility: auto;
        contain-intrinsic-size: auto 360px;
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
        animation: dashboardModalEnter 140ms cubic-bezier(0.22, 1, 0.36, 1);
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
        padding-right: 4px;
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
  children: ReactNode;
}) {
  const bottomNavItems = getBottomNavItems(navItems);
  const menuNavItems =
    bottomNavItems.length > 1
      ? navItems.filter(
          (item) => !bottomNavItems.some((bottomItem) => bottomItem.href === item.href)
        )
      : navItems;

  return (
    <main
      className="dashboard-shell"
      style={{
        minHeight: "var(--workbit-vh, 100dvh)",
        background:
          "var(--workbit-app-bg)",
        padding: 18,
      }}
    >
      <div
        className="dashboard-shell-inner"
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <section
          className="dashboard-shell-card"
          style={{
            ...shellCardStyle,
            padding: 22,
          }}
        >
          <div
            className="dashboard-shell-top"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <div
              className="dashboard-shell-header"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                minWidth: 0,
              }}
            >
              <div className="dashboard-shell-brand" style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <BrandLogo
                  href={navItems[0]?.href ?? "/dashboard"}
                  size={40}
                  showIcon
                  label={appName}
                  style={{ gap: 12 }}
                />
                <div className="dashboard-shell-meta" style={{ display: "grid", gap: 4 }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 28,
                      lineHeight: 1.05,
                      color: "var(--workbit-navy)",
                      fontWeight: 700,
                    }}
                  >
                    {barName}
                  </h1>
                  <p style={{ margin: 0, color: "var(--workbit-muted)", lineHeight: 1.6 }}>
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
        </section>

        <div style={{ display: "grid", gap: 18, alignItems: "start" }}>{children}</div>
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
    <section
      style={{
        ...shellCardStyle,
        padding: 28,
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
              width: 28,
              height: 28,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--workbit-gradient-soft)",
              color: "var(--workbit-purple-dark)",
              fontSize: 15,
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
        <h2 style={{ margin: 0, fontSize: 30, color: "var(--workbit-navy)" }}>{title}</h2>
        <p style={{ margin: 0, color: "var(--workbit-muted)", lineHeight: 1.7 }}>{subtitle}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </section>
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
    <section
      className={joinClassNames("dashboard-panel", className)}
      style={{
        ...shellCardStyle,
        padding: 22,
      }}
    >
      <div
        className="dashboard-panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
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
              fontSize: 18,
              flex: "0 0 auto",
            }}
          >
            {resolveUiEmoji(title)}
          </span>
          <h3 className="dashboard-panel-title" style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>
            {title}
          </h3>
        </div>
        {action ? <div style={{ color: "#64748b", fontWeight: 600 }}>{action}</div> : null}
      </div>
      {children}
    </section>
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
    <section
      className={joinClassNames("dashboard-card", className)}
      style={{
        ...shellCardStyle,
        padding: 22,
        ...style,
      }}
    >
      {children}
    </section>
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
      <section className="dashboard-modal-panel" style={{ ...shellCardStyle, display: "grid", gap: 18 }}>
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
        borderRadius: 20,
        padding: 16,
        color: "var(--workbit-muted)",
        lineHeight: 1.7,
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
              paddingRight: 4,
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
    <div
      className={joinClassNames("dashboard-item-card", className)}
      style={{
        ...softCardStyle,
        padding: 16,
        borderRadius: 20,
        display: "grid",
        gap: 6,
        ...style,
      }}
    >
      <strong style={{ color: "var(--workbit-navy)" }}>{title}</strong>
      {subtitle ? <div style={{ color: "#334155" }}>{subtitle}</div> : null}
      {meta ? <div style={{ color: "var(--workbit-muted)", fontSize: 14 }}>{meta}</div> : null}
      {footer ? <div style={{ marginTop: 8 }}>{footer}</div> : null}
    </div>
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
    <div
      className="dashboard-compact-list-item"
      style={{
        ...softCardStyle,
        borderRadius: 18,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <strong style={{ color: "var(--workbit-navy)", fontSize: 15 }}>{title}</strong>
        {subtitle ? <span style={{ color: "#475569", fontSize: 14 }}>{subtitle}</span> : null}
        {meta ? <span style={{ color: "var(--workbit-muted)", fontSize: 12, fontWeight: 700 }}>{meta}</span> : null}
      </div>
      {action ? <div style={{ flex: "0 0 auto" }}>{action}</div> : null}
    </div>
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
  borderRadius: 18,
  border: "1px solid var(--workbit-border)",
  padding: "13px 15px",
  fontSize: 15,
  background: "linear-gradient(180deg, var(--workbit-field-bg) 0%, var(--workbit-surface-secondary) 100%)",
  width: "100%",
  color: "var(--workbit-navy)",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 8px 18px rgba(124, 58, 237, 0.035)",
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
