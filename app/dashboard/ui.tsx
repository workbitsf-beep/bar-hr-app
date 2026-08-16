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

      .dashboard-shell-card,
      .dashboard-top-nav,
      .dashboard-header-action,
      .dashboard-menu-button {
        position: relative;
        z-index: 30;
        pointer-events: auto;
      }

      .dashboard-shell-content {
        position: relative;
        z-index: 1;
        margin-top: 24px;
      }

      .dashboard-shell-below-header {
        margin-top: 24px !important;
        margin-bottom: 0 !important;
      }

      .dashboard-shell-below-header:empty {
        display: none !important;
      }

      .dashboard-shell-below-header:not(:empty) + .dashboard-shell-content {
        margin-top: 16px;
      }

      .workbit-home {
        display: grid;
        gap: 16px;
      }

      .workbit-home-title {
        display: grid;
        gap: 2px;
        padding-inline: 4px;
      }

      .workbit-home-title span {
        color: #5E5CE6;
        font-size: 14px;
        font-weight: 800;
      }

      .workbit-home-title h1 {
        margin: 0;
        color: #20202A;
        font-size: 30px;
        line-height: 1;
        letter-spacing: -0.045em;
        font-weight: 950;
      }

      .workbit-home-hours,
      .workbit-home-shift {
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid rgba(94, 92, 230, 0.08);
        box-shadow: 0 10px 22px rgba(61, 42, 153, 0.045);
      }

      .workbit-home-hours {
        min-height: 108px;
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 18px;
      }

      .workbit-home-ring {
        width: 72px;
        height: 72px;
        flex: 0 0 auto;
        border-radius: 999px;
        padding: 7px;
        display: grid;
        place-items: center;
      }

      .workbit-home-ring span {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: #ffffff;
        color: #151526;
        font-size: 16px;
        font-weight: 950;
      }

      .workbit-home-hours strong {
        display: block;
        color: #151526;
        font-size: 18px;
        font-weight: 950;
        letter-spacing: -0.025em;
      }

      .workbit-home-hours small,
      .workbit-home-shift small {
        display: block;
        color: #8E8E93;
        font-size: 14px;
        font-weight: 760;
        line-height: 1.2;
      }

      .workbit-home-clock-card {
        display: grid;
        gap: 20px;
        border-radius: 20px;
        padding: 22px 20px 20px;
        background: linear-gradient(135deg, #6958F5 0%, #442ACD 100%);
        color: #ffffff;
        box-shadow: 0 18px 28px rgba(68, 42, 205, 0.18);
      }

      .workbit-home-clock-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .workbit-home-clock-top strong {
        display: block;
        font-size: 17px;
        line-height: 1.1;
        font-weight: 950;
      }

      .workbit-home-clock-top span {
        display: block;
        margin-top: 4px;
        color: rgba(255, 255, 255, 0.76);
        font-size: 13px;
        font-weight: 760;
      }

      .workbit-home-ready {
        display: inline-flex !important;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        margin-top: 0 !important;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff !important;
        font-size: 12px !important;
        font-weight: 900 !important;
        line-height: 1;
      }

      .workbit-home-clock-tools {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }

      .workbit-home-clock-tools button {
        width: 30px;
        height: 30px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.24);
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 900;
        cursor: pointer;
      }

      .workbit-home-clock-tools button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .workbit-home-ready i {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #31D158;
      }

      .workbit-home-ready.is-waiting i {
        background: #FFCC00;
      }

      .workbit-home-clock-actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
      }

      .workbit-home-clock-button {
        min-height: 54px !important;
        border-radius: 15px !important;
        color: #ffffff !important;
        font-size: 17px !important;
        font-weight: 900 !important;
        box-shadow: none !important;
        border: 0 !important;
      }

      .workbit-home-clock-in {
        background: #34D35F !important;
      }

      .workbit-home-clock-out {
        background: #EF4444 !important;
      }

      .workbit-home-clock-button:disabled {
        opacity: 0.78 !important;
        filter: saturate(0.95);
      }

      .workbit-home-clock-in:disabled {
        background: #34D35F !important;
        color: #ffffff !important;
      }

      .workbit-home-clock-out:disabled {
        background: #EF4444 !important;
        color: #ffffff !important;
      }

      .workbit-home-clock-message {
        margin: -10px 0 0;
        color: rgba(255, 255, 255, 0.86);
        font-size: 13px;
        font-weight: 760;
      }

      .workbit-home-shift {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 17px 18px;
      }

      .workbit-home-shift > span {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: #E9F7EF;
        font-size: 17px;
        flex: 0 0 auto;
      }

      .workbit-home-shift strong {
        display: block;
        color: #151526;
        font-size: 16px;
        line-height: 1.15;
        font-weight: 950;
        letter-spacing: -0.02em;
      }

      .workbit-home-next-shift {
        margin-top: -4px;
      }

      .workbit-timelog-history-content {
        gap: 14px !important;
      }

      .workbit-timelog-history-list .dashboard-item-list {
        gap: 12px !important;
      }

      .workbit-timelog-day-card {
        gap: 0 !important;
        padding: 16px !important;
        border-radius: 18px !important;
        background: #ffffff !important;
        border: 1px solid rgba(60, 60, 67, 0.10) !important;
        box-shadow: 0 5px 14px rgba(61, 42, 153, 0.055) !important;
      }

      .workbit-timelog-day-header {
        align-items: center !important;
      }

      .workbit-timelog-day-title {
        color: #111118 !important;
        font-size: 16px !important;
        font-weight: 900 !important;
        line-height: 1.15 !important;
        letter-spacing: -0.02em;
      }

      .workbit-timelog-duration {
        min-width: 52px;
        padding: 5px 9px !important;
        text-align: center;
        background: #efecff !important;
        border: 0 !important;
        color: #6255ed !important;
        font-size: 13px !important;
        font-weight: 900 !important;
        font-variant-numeric: tabular-nums;
      }

      .workbit-timelog-day-subtitle {
        margin-top: 5px;
        color: #8e8e93 !important;
        font-size: 13px !important;
        font-weight: 500;
        line-height: 1.25;
      }

      .workbit-timelog-day-entries {
        margin-top: 12px !important;
      }

      .workbit-timelog-day-entries > div {
        gap: 9px !important;
      }

      .workbit-timelog-entry {
        min-width: 0;
        min-height: 43px;
        box-shadow: none !important;
      }

      .workbit-timelog-entry--in {
        background: #e5f8eb !important;
        border-color: #d9f3e1 !important;
      }

      .workbit-timelog-entry--out {
        background: #fde8e8 !important;
        border-color: #fbdada !important;
      }

      .workbit-time-page {
        display: grid;
        gap: 28px;
        min-width: 0;
      }

      .workbit-time-overview {
        display: grid;
        gap: 16px;
        padding-inline: 4px;
      }

      .workbit-time-heading {
        display: grid;
        gap: 3px;
      }

      .workbit-time-heading > span {
        color: #6255ed;
        font-size: 14px;
        font-weight: 850;
        line-height: 1;
      }

      .workbit-time-heading > h2 {
        margin: 0;
        color: #1c1c1e !important;
        font-size: 29px !important;
        font-weight: 950 !important;
        line-height: 1.05;
        letter-spacing: -0.045em;
      }

      .workbit-time-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .workbit-time-summary-card {
        display: grid;
        gap: 6px;
        min-width: 0;
        padding: 17px 16px;
        border-radius: 19px;
        background: #ffffff;
        border: 1px solid rgba(60, 60, 67, 0.08);
        box-shadow: 0 4px 12px rgba(61, 42, 153, 0.045);
      }

      .workbit-time-summary-card > span {
        color: #8e8e93;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.15;
      }

      .workbit-time-summary-card > strong {
        color: #111118;
        font-size: 27px;
        font-weight: 950;
        line-height: 1;
        letter-spacing: -0.04em;
        font-variant-numeric: tabular-nums;
      }

      .workbit-personal-timelog-panel {
        padding: 0 4px !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      .workbit-personal-timelog-panel > .dashboard-panel-header {
        display: none !important;
      }

      .workbit-personal-timelog-panel .workbit-timelog-history-content {
        gap: 18px !important;
      }

      .workbit-timelog-today-total {
        padding: 0 12px !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        color: #6255ed !important;
        font-size: 16px;
        font-weight: 900 !important;
        line-height: 1.15;
      }

      .workbit-timelog-today-total > span {
        display: block;
      }

      .workbit-time-section-label {
        color: #8e8e93;
        font-size: 12px;
        font-weight: 850;
        line-height: 1;
        letter-spacing: 0.035em;
        text-transform: uppercase;
      }

      .workbit-timelog-filters {
        overflow: hidden;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid rgba(60, 60, 67, 0.09);
        box-shadow: 0 4px 12px rgba(61, 42, 153, 0.04);
      }

      .workbit-timelog-filter-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        min-height: 46px;
        padding: 0 16px;
      }

      .workbit-timelog-filter-row + .workbit-timelog-filter-row {
        border-top: 1px solid rgba(60, 60, 67, 0.11);
      }

      .workbit-timelog-filter-row > strong {
        color: #111118;
        font-size: 15px;
        font-weight: 850;
      }

      .workbit-timelog-filter-row > select {
        width: min(68%, 210px) !important;
        min-height: 44px !important;
        padding: 0 20px 0 8px !important;
        border: 0 !important;
        border-radius: 0 !important;
        background-color: transparent !important;
        box-shadow: none !important;
        color: #8e8e93 !important;
        font-size: 15px !important;
        font-weight: 500 !important;
        text-align: right;
        text-align-last: right;
      }

      .workbit-requests-page {
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .workbit-requests-heading {
        display: grid;
        gap: 3px;
        padding-inline: 4px;
      }

      .workbit-requests-heading > span {
        color: #6255ed;
        font-size: 14px;
        font-weight: 850;
        line-height: 1;
      }

      .workbit-requests-heading > h2 {
        margin: 0;
        color: #1c1c1e !important;
        font-size: 29px !important;
        font-weight: 950 !important;
        line-height: 1.05;
        letter-spacing: -0.045em;
      }

      .workbit-requests-stack {
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 14px !important;
      }

      .workbit-request-launch-card {
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr) 40px;
        align-items: center;
        gap: 11px;
        min-height: 62px;
        padding: 10px 20px 10px 12px;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid rgba(60, 60, 67, 0.09);
        box-shadow: 0 5px 14px rgba(61, 42, 153, 0.05);
      }

      .workbit-request-launch-icon {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 0;
        background: transparent;
        font-size: 20px;
      }

      .workbit-request-launch-copy {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .workbit-request-launch-copy > strong {
        color: #111118;
        font-size: 16px;
        font-weight: 900;
        line-height: 1.1;
      }

      .workbit-request-launch-copy > span {
        overflow: hidden;
        color: #8e8e93;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .workbit-request-launch-action {
        display: grid;
        place-items: center;
      }

      .workbit-request-plus,
      .workbit-request-launch-action > button {
        width: 36px !important;
        min-width: 36px !important;
        height: 36px !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        color: #b0aeb8 !important;
      }

      .workbit-request-plus svg,
      .workbit-request-launch-action > button svg {
        width: 15px;
        height: 15px;
      }

      .workbit-requests-list-panel {
        padding: 0 4px !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .workbit-requests-list-panel > .dashboard-panel-header {
        margin-bottom: 9px !important;
        padding-inline: 0;
      }

      .workbit-requests-list-panel > .dashboard-panel-header > div:first-child > span {
        display: none !important;
      }

      .workbit-requests-list-panel > .dashboard-panel-header .dashboard-panel-title {
        color: #8e8e93 !important;
        font-size: 12px !important;
        font-weight: 850 !important;
        line-height: 1 !important;
        letter-spacing: 0.035em !important;
        text-transform: uppercase;
      }

      .workbit-requests-list-panel > .dashboard-panel-header > div:last-child {
        color: #aaa7b2 !important;
        font-size: 12px;
        font-weight: 700 !important;
      }

      .workbit-requests-list-panel .dashboard-item-list {
        gap: 10px !important;
      }

      .workbit-requests-list-panel .dashboard-item-card {
        padding: 14px 16px !important;
        border-radius: 17px !important;
        background: #ffffff !important;
        border: 1px solid rgba(60, 60, 67, 0.09) !important;
        box-shadow: 0 4px 12px rgba(61, 42, 153, 0.04) !important;
      }

      .workbit-requests-list-panel .dashboard-empty-state {
        padding: 4px 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        color: #9a98a2 !important;
        font-size: 13px !important;
      }

      .workbit-availability-panel .dashboard-item-card {
        position: relative;
        padding-left: 58px !important;
        min-height: 62px;
      }

      .workbit-availability-panel .dashboard-item-card::before {
        content: "👤";
        position: absolute;
        left: 14px;
        top: 50%;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 0;
        background: transparent;
        transform: translateY(-50%);
      }

      .workbit-menu-heading-copy {
        display: grid;
        gap: 3px;
      }

      .workbit-menu-heading-copy > span {
        color: #6255ed;
        font-size: 14px;
        font-weight: 800;
        line-height: 1;
      }

      .workbit-menu-heading-copy > strong {
        color: #1c1c1e;
        font-size: 29px;
        font-weight: 950;
        line-height: 1.05;
        letter-spacing: -0.045em;
      }

      .workbit-menu-section-label {
        color: #8e8e93 !important;
        font-size: 12px !important;
        font-weight: 850 !important;
        line-height: 1 !important;
        letter-spacing: 0.045em !important;
        text-transform: uppercase;
      }

      .workbit-menu-header-card {
        display: none;
      }

      .workbit-page-heading {
        grid-column: 1 / -1;
        display: grid;
        gap: 3px;
        padding-inline: 4px;
      }

      .workbit-page-heading > span {
        color: #6255ed;
        font-size: 14px;
        font-weight: 850;
        line-height: 1;
      }

      .workbit-page-heading > h1 {
        margin: 0;
        color: #1c1c1e;
        font-size: 30px;
        font-weight: 950;
        line-height: 1;
        letter-spacing: -0.045em;
      }

      @media (max-width: 1180px) {
        body:has(.workbit-menu-page-overlay) .dashboard-shell {
          isolation: auto !important;
        }

        .dashboard-menu-overlay.workbit-menu-page-overlay {
          background: #efebfa !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .workbit-menu-panel {
          z-index: 41;
          width: min(100%, 430px) !important;
          max-width: 430px !important;
          margin-inline: auto;
          border: 0 !important;
          border-radius: 0 !important;
          background: #efebfa !important;
          box-shadow: none !important;
        }

        .workbit-menu-header-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          min-height: 70px;
          padding: 11px 13px;
          border: 1px solid rgba(94, 92, 230, 0.10);
          border-radius: 25px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 7px 18px rgba(61, 42, 153, 0.06);
        }

        .workbit-menu-header-card .brand-logo-label {
          color: #111118 !important;
          font-size: 20px !important;
          font-weight: 900 !important;
          letter-spacing: -0.025em !important;
        }

        .workbit-menu-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .workbit-menu-header-actions button {
          width: 42px !important;
          height: 42px !important;
          min-width: 42px !important;
          padding: 0 !important;
          border-radius: 999px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: none !important;
        }

        .workbit-menu-header-logout button {
          border: 1px solid rgba(94, 92, 230, 0.16) !important;
          background: #f8f7ff !important;
          color: #3d2a99 !important;
        }

        .workbit-menu-heading {
          min-height: 58px;
          margin-top: 50px;
          border: 0 !important;
        }

        .workbit-menu-close {
          width: 36px !important;
          height: 36px !important;
          border: 0 !important;
          background: rgba(255,255,255,0.26) !important;
          box-shadow: none !important;
          color: #9a98a2 !important;
        }

        .workbit-menu-navigation {
          gap: 8px !important;
        }

        .workbit-menu-navigation-list {
          overflow: hidden;
          border-radius: 18px;
          background: #ffffff;
          border: 1px solid rgba(60, 60, 67, 0.09);
          box-shadow: 0 4px 12px rgba(61, 42, 153, 0.04);
        }

        .workbit-menu-link {
          min-height: 46px;
          padding: 0 15px !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          color: #111118 !important;
          font-size: 15px !important;
          font-weight: 850 !important;
        }

        .workbit-menu-link + .workbit-menu-link {
          border-top: 1px solid rgba(60, 60, 67, 0.11) !important;
        }

        .workbit-menu-link-copy {
          gap: 0 !important;
        }

        .workbit-menu-link-icon {
          display: none !important;
        }

        .workbit-menu-link-arrow {
          color: #c1bec8 !important;
        }

        .workbit-menu-link-arrow svg {
          width: 14px;
          height: 14px;
        }

        .workbit-menu-content {
          gap: 0 !important;
          padding-top: 0 !important;
          border-top: 0 !important;
        }

        .workbit-menu-details {
          gap: 0 !important;
        }

        .workbit-menu-account-card {
          margin-bottom: 18px;
          padding: 13px 15px !important;
          border: 0 !important;
          border-radius: 17px !important;
          background: #ffffff !important;
          box-shadow: 0 4px 12px rgba(61, 42, 153, 0.04);
        }

        .workbit-menu-details > .workbit-menu-section-label {
          margin: 0 4px 8px;
        }

        .workbit-menu-select-row {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 12px !important;
          min-height: 48px;
          padding: 0 15px;
          background: #ffffff;
        }

        .workbit-menu-select-row:first-of-type {
          border-radius: 17px 17px 0 0;
        }

        .workbit-menu-select-row + .workbit-menu-select-row {
          border-top: 1px solid rgba(60, 60, 67, 0.11);
        }

        .workbit-menu-select-row:last-child {
          border-radius: 0 0 17px 17px;
        }

        .workbit-menu-select-row > span {
          color: #111118 !important;
          font-size: 15px !important;
          font-weight: 850 !important;
          letter-spacing: 0 !important;
          text-transform: none !important;
        }

        .workbit-menu-select-row > select {
          width: min(52vw, 180px) !important;
          min-height: 44px !important;
          padding: 0 18px 0 6px !important;
          border: 0 !important;
          border-radius: 0 !important;
          background-color: transparent !important;
          box-shadow: none !important;
          color: #8e8e93 !important;
          font-size: 15px !important;
          font-weight: 500 !important;
          text-align: right;
          text-align-last: right;
        }

        .dashboard-bottom-nav a {
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
        }

        .dashboard-bottom-nav a > span {
          display: block !important;
          width: 100% !important;
          text-align: center !important;
          white-space: nowrap !important;
        }

        .dashboard-bottom-nav a > svg {
          margin-inline: auto !important;
          flex: 0 0 auto !important;
        }
      }

      @media (max-width: 900px) {
        .dashboard-shell-content,
        .dashboard-shell-below-header {
          margin-top: 56px !important;
        }

        .workbit-documents-page {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 0 !important;
        }

        .workbit-documents-overview,
        .workbit-document-folders-panel {
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .workbit-documents-overview .dashboard-panel-header {
          align-items: flex-end !important;
          margin: 0 0 2px !important;
          padding-inline: 4px;
          flex-wrap: nowrap !important;
        }

        .workbit-documents-overview .dashboard-panel-header > div:first-child {
          display: grid !important;
          gap: 2px !important;
        }

        .workbit-documents-overview .dashboard-panel-header > div:first-child > span {
          display: none !important;
        }

        .workbit-documents-overview .dashboard-panel-title {
          display: grid;
          gap: 2px;
          color: #1c1c1e !important;
          font-size: 30px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
          letter-spacing: -0.045em !important;
        }

        .workbit-documents-overview .dashboard-panel-title::before {
          content: "Archivio";
          color: #6255ed;
          font-size: 14px;
          font-weight: 850;
          line-height: 1;
          letter-spacing: 0;
        }

        .workbit-documents-overview .dashboard-panel-header > div:last-child button {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          padding: 0 !important;
          border: 0 !important;
          background: #6255ed !important;
          color: #ffffff !important;
          box-shadow: none !important;
          font-size: 0 !important;
        }

        .workbit-documents-overview .dashboard-panel-header > div:last-child button svg {
          width: 18px;
          height: 18px;
        }

        .workbit-documents-count {
          margin: 5px 4px 0 !important;
          color: #8e8e93 !important;
          font-size: 14px;
          font-weight: 650;
          line-height: 1.2 !important;
        }

        .workbit-documents-overview form {
          margin-top: 16px !important;
        }

        .workbit-document-folders-panel {
          margin-top: 18px;
        }

        .workbit-document-folders-panel > .dashboard-panel-header {
          min-height: 16px;
          margin: 0 4px 9px !important;
        }

        .workbit-document-folders-panel > .dashboard-panel-header > div > span {
          display: none !important;
        }

        .workbit-document-folders-panel .dashboard-panel-title {
          color: #8e8e93 !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          line-height: 1 !important;
          letter-spacing: 0.055em !important;
          text-transform: uppercase;
        }

        .workbit-document-folder-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 10px !important;
        }

        .workbit-document-folder-card {
          padding: 0 !important;
          border: 0 !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 6px 16px rgba(61, 42, 153, 0.045) !important;
          overflow: hidden;
        }

        .workbit-document-folder-row {
          min-height: 62px;
          padding: 10px 13px;
          gap: 11px !important;
        }

        .workbit-document-folder-icon {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #efecff;
          font-size: 18px;
        }

        .workbit-document-folder-copy {
          flex: 1 1 auto;
        }

        .workbit-document-folder-copy strong {
          display: block;
          overflow: hidden;
          color: #17171f !important;
          font-size: 15px;
          font-weight: 900;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .workbit-document-folder-copy div {
          margin-top: 2px;
          color: #8e8e93 !important;
          font-size: 13px !important;
          line-height: 1.15;
        }

        .workbit-document-folder-open button {
          min-width: 58px !important;
          height: 36px !important;
          padding: 0 15px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: #efecff !important;
          color: #6255ed !important;
          box-shadow: none !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .workbit-notes-page {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 12px !important;
        }

        .workbit-notes-panel {
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .workbit-notes-panel > .dashboard-panel-header {
          align-items: flex-end !important;
          margin: 0 4px 15px !important;
          flex-wrap: nowrap !important;
        }

        .workbit-notes-panel > .dashboard-panel-header > div:first-child {
          display: grid !important;
          gap: 2px !important;
        }

        .workbit-notes-panel > .dashboard-panel-header > div:first-child > span {
          display: none !important;
        }

        .workbit-notes-panel .dashboard-panel-title {
          display: grid;
          gap: 2px;
          color: #1c1c1e !important;
          font-size: 30px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
          letter-spacing: -0.045em !important;
        }

        .workbit-notes-panel .dashboard-panel-title::before {
          content: "Team";
          color: #6255ed;
          font-size: 14px;
          font-weight: 850;
          line-height: 1;
          letter-spacing: 0;
        }

        .workbit-notes-panel > .dashboard-panel-header > div:last-child {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px !important;
          flex-wrap: nowrap !important;
        }

        .workbit-notes-panel > .dashboard-panel-header > div:last-child > button {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          padding: 0 !important;
          border: 0 !important;
          background: #6255ed !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }

        .workbit-notes-panel > .dashboard-item-list {
          gap: 11px !important;
        }

        .workbit-note-card {
          gap: 7px !important;
          padding: 20px !important;
          border: 0 !important;
          border-radius: 20px !important;
          background: #ffffff !important;
          box-shadow: 0 7px 18px rgba(61, 42, 153, 0.045) !important;
        }

        .workbit-note-card > strong {
          color: #17171f !important;
          font-size: 18px !important;
          font-weight: 950 !important;
          line-height: 1.2 !important;
          letter-spacing: -0.025em;
        }

        .workbit-note-card > div:nth-of-type(1),
        .workbit-note-card > div:nth-of-type(2) {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: #8e8e93 !important;
          font-size: 13px !important;
          line-height: 1.3 !important;
        }

        .workbit-note-card > div:nth-of-type(1)::before {
          content: "🗓️";
          flex: 0 0 auto;
          font-size: 12px;
        }

        .workbit-note-card > div:nth-of-type(2)::before {
          content: "👥";
          flex: 0 0 auto;
          font-size: 12px;
        }

        .workbit-note-card > div:last-child {
          margin-top: 6px !important;
          padding-top: 13px;
          border-top: 1px solid rgba(60, 60, 67, 0.11);
        }

        .workbit-note-card > div:last-child > div {
          gap: 8px !important;
        }

        .workbit-note-card .dashboard-status-pill {
          min-height: 25px !important;
          padding: 4px 11px !important;
          border: 0 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          text-transform: uppercase;
          box-shadow: none !important;
        }

        .workbit-note-card form button[aria-label="Completa nota"] {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: #e5f8eb !important;
          color: #24b954 !important;
          box-shadow: none !important;
          font-size: 21px !important;
        }

        .workbit-notes-panel > .dashboard-empty-state {
          padding: 4px !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .workbit-courses-page,
        .workbit-people-page,
        .workbit-export-page,
        .workbit-settings-page {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 12px !important;
        }

        .workbit-courses-panel,
        .workbit-people-panel {
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .workbit-courses-panel > .dashboard-panel-header,
        .workbit-people-panel > .dashboard-panel-header {
          align-items: flex-end !important;
          margin: 0 4px 15px !important;
          flex-wrap: nowrap !important;
        }

        .workbit-courses-panel > .dashboard-panel-header > div:first-child,
        .workbit-people-panel > .dashboard-panel-header > div:first-child {
          display: grid !important;
          gap: 2px !important;
        }

        .workbit-courses-panel > .dashboard-panel-header > div:first-child > span,
        .workbit-people-panel > .dashboard-panel-header > div:first-child > span {
          display: none !important;
        }

        .workbit-courses-panel .dashboard-panel-title,
        .workbit-people-panel .dashboard-panel-title {
          display: grid;
          gap: 2px;
          color: #1c1c1e !important;
          font-size: 30px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
          letter-spacing: -0.045em !important;
        }

        .workbit-courses-panel .dashboard-panel-title::before {
          content: "Formazione";
          color: #6255ed;
          font-size: 14px;
          font-weight: 850;
          line-height: 1;
          letter-spacing: 0;
        }

        .workbit-people-panel .dashboard-panel-title::before {
          content: "Organizza";
          color: #6255ed;
          font-size: 14px;
          font-weight: 850;
          line-height: 1;
          letter-spacing: 0;
        }

        .workbit-courses-panel > .dashboard-panel-header > div:last-child,
        .workbit-people-panel > .dashboard-panel-header > div:last-child {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px !important;
          color: #8e8e93 !important;
          font-size: 13px;
          font-weight: 700;
          flex-wrap: nowrap !important;
        }

        .workbit-courses-panel > .dashboard-item-list,
        .workbit-people-panel > .dashboard-item-list {
          gap: 10px !important;
        }

        .workbit-course-card,
        .workbit-person-card {
          gap: 6px !important;
          padding: 16px !important;
          border: 0 !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 6px 16px rgba(61, 42, 153, 0.045) !important;
        }

        .workbit-course-card > strong,
        .workbit-person-card > strong {
          color: #17171f !important;
          font-size: 16px !important;
          font-weight: 900 !important;
          line-height: 1.2 !important;
        }

        .workbit-course-card > div,
        .workbit-person-card > div {
          color: #8e8e93 !important;
          font-size: 13px !important;
          line-height: 1.35 !important;
        }

        .workbit-person-card > div:last-child form {
          display: flex;
          justify-content: flex-end;
        }

        .workbit-export-generator,
        .workbit-export-preview {
          padding: 16px !important;
          border: 0 !important;
          border-radius: 20px !important;
          background: #ffffff !important;
          box-shadow: 0 6px 16px rgba(61, 42, 153, 0.045) !important;
        }

        .workbit-export-generator > .dashboard-panel-header,
        .workbit-export-preview > .dashboard-panel-header {
          margin-bottom: 14px !important;
        }

        .workbit-export-generator .dashboard-panel-title,
        .workbit-export-preview .dashboard-panel-title {
          font-size: 18px !important;
          font-weight: 900 !important;
        }

        .workbit-export-page .dashboard-form-field {
          gap: 6px !important;
        }

        .workbit-export-page .dashboard-form-actions,
        .workbit-export-generator form + div {
          gap: 8px !important;
        }

        .workbit-settings-page {
          gap: 10px !important;
        }

        .workbit-settings-page > .workbit-page-heading {
          margin-bottom: 5px;
        }

        .workbit-settings-card {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px !important;
          min-height: 76px;
          padding: 13px 14px !important;
          border: 0 !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 6px 16px rgba(61, 42, 153, 0.045) !important;
        }

        .workbit-settings-card[data-tone="danger"] {
          background: #fff7f7 !important;
        }

        .workbit-settings-card > div:first-child {
          min-width: 0;
        }

        .workbit-settings-card > div:first-child > div:first-child {
          gap: 10px !important;
        }

        .workbit-settings-card > div:first-child > div:first-child > span {
          width: 36px !important;
          height: 36px !important;
          border-radius: 10px !important;
          font-size: 18px !important;
        }

        .workbit-settings-card > div:first-child strong {
          color: #17171f !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          line-height: 1.15;
        }

        .workbit-settings-card > div:first-child strong + span {
          margin-top: 1px;
          color: #8e8e93 !important;
          font-size: 12px !important;
          line-height: 1.25 !important;
        }

        .workbit-settings-card > div:first-child > .dashboard-status-pill {
          display: none !important;
        }

        .workbit-settings-card > div:last-child {
          justify-content: flex-end !important;
        }

        .workbit-settings-card > div:last-child .dashboard-popup-trigger--label {
          min-width: 56px !important;
        }

        .dashboard-shell-below-header:not(:empty) + .dashboard-shell-content {
          margin-top: 16px !important;
        }

        .workbit-timelog-history-panel {
          padding: 14px !important;
        }

        .workbit-personal-timelog-panel {
          padding: 0 4px !important;
        }

        .workbit-timelog-day-card {
          padding: 15px !important;
        }

        .workbit-timelog-entry {
          padding: 11px 12px !important;
        }
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
        .workbit-home {
          margin-top: 4px;
        }

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
        gap: 0 !important;
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
      .dashboard-popup-trigger,
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

      @media (max-width: 900px) {
        .dashboard-clock-button {
          min-height: 62px !important;
          border-radius: 16px !important;
        }
      }

      .workbit-home .workbit-home-clock-tools button {
        width: 42px !important;
        height: 42px !important;
        min-width: 42px !important;
        border-radius: 14px !important;
        background: rgba(255, 255, 255, 0.18) !important;
        color: #ffffff !important;
        font-size: 24px !important;
        font-weight: 950 !important;
        line-height: 1 !important;
        display: inline-grid !important;
        place-items: center !important;
        opacity: 1 !important;
      }

      .workbit-home .workbit-home-clock-button,
      .workbit-home .workbit-home-clock-button:disabled {
        min-height: 62px !important;
        border-radius: 16px !important;
        color: #ffffff !important;
        font-size: 18px !important;
        font-weight: 950 !important;
        opacity: 1 !important;
        filter: none !important;
        box-shadow: none !important;
      }

      .dashboard-popup-trigger,
      .dashboard-icon-button[data-intent="add"] {
        width: 38px !important;
        min-width: 38px !important;
        height: 38px !important;
        min-height: 38px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: #6255ed !important;
        color: #ffffff !important;
        box-shadow: none !important;
        font-size: 0 !important;
      }

      .dashboard-popup-trigger--label {
        width: auto !important;
        min-width: 0 !important;
        height: 36px !important;
        min-height: 36px !important;
        padding: 0 14px !important;
        background: #efecff !important;
        color: #6255ed !important;
        font-size: 13px !important;
        font-weight: 900 !important;
      }

      .dashboard-popup-trigger svg,
      .dashboard-icon-button svg {
        display: block !important;
        flex: 0 0 auto !important;
        width: 18px !important;
        height: 18px !important;
        overflow: visible !important;
      }

      .dashboard-button[data-tone="red"],
      .dashboard-icon-button[data-intent="danger"],
      button[aria-label^="Elimina"],
      button[aria-label^="Rimuovi"],
      button[aria-label^="Cancella"] {
        border-color: rgba(239, 68, 68, 0.28) !important;
        background: linear-gradient(135deg, #dc2626 0%, #ff3b30 100%) !important;
        color: #ffffff !important;
        box-shadow: none !important;
      }

      .dashboard-button[data-tone="green"],
      .dashboard-icon-button[data-intent="confirm"] {
        border-color: rgba(34, 197, 94, 0.28) !important;
        background: #e5f8eb !important;
        color: #168a3e !important;
        box-shadow: none !important;
      }

      .dashboard-button[data-tone="sand"] {
        border-color: rgba(94, 92, 230, 0.14) !important;
        background: #f5f3fc !important;
        color: #3d2a99 !important;
        box-shadow: none !important;
      }

      .workbit-home .workbit-home-clock-in,
      .workbit-home .workbit-home-clock-in:disabled,
      .workbit-home .workbit-home-clock-in:hover,
      .workbit-home .workbit-home-clock-in:active {
        background: #34D35F !important;
        border-color: rgba(52, 211, 95, 0.7) !important;
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
      }

      .workbit-home .workbit-home-clock-out,
      .workbit-home .workbit-home-clock-out:disabled,
      .workbit-home .workbit-home-clock-out:hover,
      .workbit-home .workbit-home-clock-out:active {
        background: #EF4444 !important;
        border-color: rgba(239, 68, 68, 0.7) !important;
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
      }

      .workbit-home .workbit-home-clock-in:disabled {
        background: #bce9c8 !important;
        border-color: rgba(66, 153, 91, 0.28) !important;
        color: #39764a !important;
        -webkit-text-fill-color: #39764a !important;
      }

      .workbit-home .workbit-home-clock-out:disabled {
        background: #f1c2c2 !important;
        border-color: rgba(185, 80, 80, 0.26) !important;
        color: #8a4141 !important;
        -webkit-text-fill-color: #8a4141 !important;
      }

      @media (max-width: 900px) {
        .dashboard-calendar-page > .dashboard-panel {
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .dashboard-calendar-page > .dashboard-panel > .dashboard-panel-header {
          display: none !important;
        }

        .workbit-calendar-toolbar {
          gap: 16px !important;
          margin: 0 0 14px !important;
          padding-inline: 2px;
        }

        .workbit-calendar-day-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          padding-inline: 4px;
        }

        .workbit-calendar-day-heading > div {
          display: grid;
          gap: 2px;
        }

        .workbit-calendar-week-heading {
          display: grid;
          gap: 2px;
          padding-inline: 4px;
        }

        .workbit-calendar-week-heading span {
          color: #5e5ce6;
          font-size: 13px;
          font-weight: 850;
          line-height: 1.1;
        }

        .workbit-calendar-week-heading strong {
          color: #17171f;
          font-size: 28px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .workbit-calendar-day-heading span {
          color: #5e5ce6;
          font-size: 13px;
          font-weight: 850;
          line-height: 1.1;
        }

        .workbit-calendar-day-heading strong {
          color: #17171f;
          font-size: 28px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .workbit-calendar-add-shift {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: #5e5ce6 !important;
          color: #ffffff !important;
          font-size: 22px !important;
          font-weight: 700 !important;
          box-shadow: none !important;
        }

        .workbit-calendar-segments {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 50px !important;
          min-height: 50px !important;
          padding: 3px !important;
          border: 0 !important;
          border-radius: 12px !important;
          background: #ece9f2 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .workbit-calendar-segments.has-publish {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 50px 40px !important;
        }

        .workbit-calendar-segments .calendar-publish-actions {
          width: 34px !important;
          min-width: 34px !important;
          justify-self: center;
          align-self: center;
        }

        .workbit-calendar-segments .calendar-publish-actions .dashboard-icon-button {
          width: 34px !important;
          height: 34px !important;
          min-width: 34px !important;
          min-height: 34px !important;
          border: 0 !important;
          border-radius: 9px !important;
          background: rgba(255, 255, 255, 0.42) !important;
          color: #5e5ce6 !important;
          font-size: 19px !important;
          box-shadow: none !important;
        }

        .workbit-calendar-segments > button {
          min-height: 34px !important;
          height: 34px !important;
          padding: 0 10px !important;
          border-radius: 9px !important;
          background: transparent !important;
          color: #929096 !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          box-shadow: none !important;
        }

        .workbit-calendar-segments > button.is-active {
          background: #ffffff !important;
          color: #17171f !important;
          box-shadow: 0 2px 7px rgba(28, 28, 30, 0.10) !important;
        }

        .workbit-calendar-today-segment {
          flex: 0 0 46px !important;
          min-width: 46px !important;
          width: 46px !important;
          max-width: 46px !important;
          height: 46px !important;
          min-height: 46px !important;
          max-height: 46px !important;
          aspect-ratio: 1 / 1 !important;
          padding: 0 !important;
          border: 1px solid rgba(98, 85, 237, 0.15) !important;
          border-radius: 50% !important;
          background: #f4f1fb !important;
          color: #6255ed !important;
          box-shadow: none !important;
        }

        .workbit-calendar-day-strip {
          gap: 12px !important;
          padding: 0 0 12px !important;
          scroll-padding-inline: 0 !important;
        }

        .workbit-calendar-day-card {
          flex: 0 0 100% !important;
          width: 100% !important;
          max-width: 100% !important;
          gap: 16px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .workbit-calendar-day-card[data-calendar-closed="true"] {
          padding: 12px !important;
          border: 1px solid rgba(185, 78, 91, 0.20) !important;
          border-radius: 18px !important;
          background: linear-gradient(180deg, #fff8f8 0%, #fff2f3 100%) !important;
          box-shadow: 0 8px 20px rgba(145, 61, 73, 0.06) !important;
        }

        .workbit-calendar-day-card-heading {
          display: none !important;
        }

        .workbit-calendar-day-section {
          min-width: 0;
          max-width: 100%;
        }

        .workbit-calendar-day-shifts {
          gap: 0 !important;
          overflow: hidden;
          border: 1px solid rgba(94, 92, 230, 0.08);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 8px 20px rgba(61, 42, 153, 0.045);
        }

        .workbit-calendar-day-shifts > .workbit-calendar-day-section-title {
          display: none !important;
        }

        .workbit-calendar-day-shifts .workbit-day-shift-row {
          padding: 11px 13px !important;
          border: 0 !important;
          border-bottom: 1px solid #ecebf0 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        .workbit-calendar-day-shifts > :last-child .workbit-day-shift-row,
        .workbit-calendar-day-shifts > .workbit-day-shift-row:last-child {
          border-bottom: 0 !important;
        }

        .workbit-day-shift-row > div {
          flex-wrap: nowrap !important;
          gap: 10px !important;
          min-height: 22px;
        }

        .workbit-day-shift-row > div > strong {
          min-width: 90px;
          color: #15151d !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          white-space: nowrap;
        }

        .workbit-day-shift-row > div > span:not(:last-child) {
          min-width: 0;
          color: #1f1f29 !important;
          font-size: 13px !important;
          line-height: 1.15;
        }

        .workbit-day-shift-row > div > span:last-child {
          width: 23px;
          height: 23px;
          flex: 0 0 23px;
          border-radius: 999px;
          background: #e4f8e9;
        }

        .workbit-day-shift-row > div > span[aria-label="In attesa"] {
          background: #fff3dc;
        }

        .workbit-calendar-day-notes {
          gap: 9px !important;
        }

        .workbit-calendar-day-notes > .workbit-calendar-day-section-title {
          min-height: 24px;
          padding: 0 4px;
          color: #8e8e93;
          font-size: 0 !important;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .workbit-calendar-day-notes > .workbit-calendar-day-section-title strong {
          color: #8e8e93 !important;
          font-size: 0 !important;
        }

        .workbit-calendar-day-notes > .workbit-calendar-day-section-title strong::after {
          content: "NOTE";
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .workbit-calendar-day-notes > .workbit-calendar-day-section-title .dashboard-icon-button {
          width: 32px !important;
          height: 32px !important;
          min-width: 32px !important;
          min-height: 32px !important;
          color: #5e5ce6 !important;
          font-size: 18px !important;
        }

        .workbit-calendar-day-notes .workbit-day-note-card {
          padding: 14px !important;
          border: 1px solid rgba(94, 92, 230, 0.08) !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 8px 20px rgba(61, 42, 153, 0.045) !important;
        }

        .dashboard-calendar-page .dashboard-week-strip {
          gap: 12px !important;
          padding: 0 0 12px !important;
          scroll-snap-type: x mandatory !important;
          scroll-padding-inline: 0 !important;
        }

        .dashboard-calendar-page .dashboard-week-card {
          flex: 0 0 100% !important;
          width: 100% !important;
          max-width: 100% !important;
          gap: 10px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          scroll-snap-align: start !important;
        }

        .workbit-week-range {
          padding: 0 2px;
        }

        .workbit-week-range span {
          color: #74747f !important;
          font-size: 13px !important;
          font-weight: 750;
          line-height: 1.2 !important;
          white-space: nowrap;
        }

        .workbit-week-day-card {
          gap: 0 !important;
          padding: 0 !important;
          overflow: hidden;
          border: 1px solid rgba(94, 92, 230, 0.09) !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 8px 20px rgba(61, 42, 153, 0.045) !important;
        }

        .workbit-week-day-card[data-calendar-today="true"] {
          border: 1.5px solid rgba(94, 92, 230, 0.42) !important;
          opacity: 1 !important;
        }

        .workbit-week-day-card[data-calendar-closed="true"] {
          border-color: rgba(185, 78, 91, 0.24) !important;
          background: #fff3f4 !important;
          box-shadow: 0 8px 20px rgba(145, 61, 73, 0.07) !important;
        }

        .workbit-week-day-card[data-calendar-closed="true"] .workbit-week-day-header > strong {
          color: #8f3e49 !important;
        }

        .workbit-week-day-card[data-calendar-closed="true"] .workbit-day-shift-row {
          background: #fff8f8 !important;
        }

        .workbit-week-day-header {
          min-height: 42px;
          padding: 9px 11px 7px;
          flex-wrap: nowrap !important;
        }

        .workbit-week-day-header > strong {
          color: #737178 !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          white-space: nowrap;
        }

        .workbit-week-day-card[data-calendar-today="true"] .workbit-week-day-header > strong {
          color: #17171f !important;
        }

        .workbit-week-details {
          min-height: 24px !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: #5e5ce6 !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          box-shadow: none !important;
        }

        .workbit-week-details svg {
          display: none !important;
        }

        .workbit-week-shifts {
          gap: 0 !important;
        }

        .workbit-week-shifts .workbit-day-shift-row {
          padding: 10px 12px !important;
          border: 0 !important;
          border-top: 1px solid #ecebf0 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        .workbit-week-shifts .workbit-day-shift-row > div {
          flex-wrap: nowrap !important;
          gap: 10px !important;
          min-height: 24px;
        }

        .workbit-week-shifts .workbit-day-shift-row > div > strong {
          min-width: 90px;
          color: #a7a5ac !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          white-space: nowrap;
        }

        .workbit-week-day-card[data-calendar-today="true"] .workbit-day-shift-row > div > strong {
          color: #17171f !important;
        }

        .workbit-week-shifts .workbit-day-shift-row > div > span:not(:last-child) {
          min-width: 0;
          color: #8e8e93 !important;
          font-size: 13px !important;
          line-height: 1.15;
        }

        .workbit-week-day-card[data-calendar-today="true"] .workbit-day-shift-row > div > span:not(:last-child) {
          color: #17171f !important;
          font-weight: 850;
        }

        .workbit-week-shifts .workbit-day-shift-row > div > span:last-child {
          width: 23px;
          height: 23px;
          flex: 0 0 23px;
          border-radius: 999px;
          background: #e4f8e9;
        }

        .workbit-week-shifts .workbit-day-shift-row > div > span[aria-label="In attesa"] {
          background: #fff3dc;
        }

        .workbit-week-badges {
          gap: 6px !important;
          padding: 8px 11px 10px;
          border-top: 1px solid #ecebf0;
        }

        .workbit-week-badges > button {
          min-height: 24px !important;
          padding: 4px 9px !important;
          border: 0 !important;
          font-size: 11px !important;
          box-shadow: none !important;
        }
      }

      /* Keep add actions legible after page-specific mobile overrides. */
      .dashboard-icon-button[data-intent="add"],
      .dashboard-popup-trigger:not(.dashboard-popup-trigger--label) {
        position: relative !important;
        background: #6255ed !important;
        color: #ffffff !important;
        font-size: 0 !important;
      }

      .dashboard-icon-button[data-intent="add"] > svg,
      .dashboard-popup-trigger:not(.dashboard-popup-trigger--label) > svg {
        display: none !important;
      }

      .dashboard-icon-button[data-intent="add"]::after,
      .dashboard-popup-trigger:not(.dashboard-popup-trigger--label)::after {
        content: "+";
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: #ffffff;
        font-size: 24px;
        font-weight: 500;
        line-height: 1;
        pointer-events: none;
      }

      /* Keep the five navigation labels aligned and inside the floating bar. */
      .dashboard-bottom-nav {
        display: grid !important;
        grid-auto-flow: column !important;
        grid-auto-columns: minmax(0, 1fr) !important;
        align-items: stretch !important;
        gap: 2px !important;
        padding: 10px 8px !important;
      }

      .dashboard-bottom-nav a,
      .dashboard-bottom-nav a[aria-current="page"] {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 58px !important;
        display: grid !important;
        grid-template-rows: 26px 14px !important;
        align-content: center !important;
        justify-items: center !important;
        gap: 4px !important;
        padding: 6px 0 4px !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .dashboard-bottom-nav a > svg {
        align-self: center;
      }

      .dashboard-bottom-nav a > span {
        width: 100% !important;
        min-width: 0 !important;
        align-self: end !important;
        color: rgba(61, 42, 153, 0.86) !important;
        font-size: clamp(8.8px, 2.55vw, 10.5px) !important;
        line-height: 1 !important;
        letter-spacing: -0.035em !important;
        text-align: center !important;
        white-space: nowrap !important;
      }

      .dashboard-bottom-nav a[aria-current="page"] > svg {
        color: #6255ed !important;
        filter: drop-shadow(0 0 6px rgba(98, 85, 237, 0.34));
      }

      .dashboard-bottom-nav a[aria-current="page"] > span {
        color: #3d2a99 !important;
      }

      /* Every request add action shares the same right-hand column. */
      .workbit-requests-page .workbit-request-launch-action,
      .workbit-requests-page .dashboard-panel-header > div:last-child {
        width: 40px !important;
        min-width: 40px !important;
        margin-left: auto !important;
        display: grid !important;
        place-items: center !important;
      }

      .workbit-requests-page .dashboard-panel-header {
        align-items: center !important;
        flex-wrap: nowrap !important;
      }

      .workbit-requests-page .workbit-request-plus {
        width: 36px !important;
        min-width: 36px !important;
        height: 36px !important;
        min-height: 36px !important;
        margin: 0 !important;
        align-self: center !important;
        justify-self: center !important;
      }

      /* Menu selectors stay on one centered row on every mobile breakpoint. */
      .workbit-menu-details .workbit-menu-select-row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(112px, 48%) !important;
        align-items: center !important;
        gap: 12px !important;
        min-height: 52px !important;
        padding: 0 15px !important;
      }

      .workbit-menu-details .workbit-menu-select-row > span {
        width: auto !important;
        align-self: center !important;
        margin: 0 !important;
        line-height: 1.2 !important;
      }

      .workbit-menu-details .workbit-menu-select-row > select {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 44px !important;
        align-self: center !important;
        margin: 0 !important;
        line-height: 1.2 !important;
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
            headerAction={headerAction}
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
            gap: 0,
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
              marginTop: 16,
              marginBottom: 0,
              pointerEvents: "none",
            }}
          >
            {belowHeader}
          </div>
        ) : null}

        <div
          className="dashboard-shell-content"
          style={{ display: "grid", gap: 18, alignItems: "start", minWidth: 0 }}
        >
          {children}
        </div>
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
        zIndex: 2147483646,
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
      data-tone={tone}
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
  const ariaLabel = typeof props["aria-label"] === "string" ? props["aria-label"] : "";
  const intent = /elimina|rimuovi|cancella/i.test(ariaLabel)
    ? "danger"
    : /aggiungi|nuov[oa]/i.test(ariaLabel)
      ? "add"
      : /completa|conferma|salva|approva/i.test(ariaLabel)
        ? "confirm"
        : "neutral";
  const symbol = typeof children === "string" ? children.trim() : "";
  const iconChildren =
    symbol === "+" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ) : symbol === "✓" || symbol === "✔" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m5.5 12.5 4 4 9-9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      children
    );

  return (
    <PendingButton
      {...props}
      data-intent={intent}
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
      {iconChildren}
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
      className="dashboard-status-pill"
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
