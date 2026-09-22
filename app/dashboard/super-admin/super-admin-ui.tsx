import type { ReactNode } from "react";
import { RevealOnScroll } from "@/app/components/workbit-animations";
import { EmptyState, Panel } from "../ui";

export type AdminSection =
  | "home"
  | "owners"
  | "bars"
  | "billing"
  | "revenue"
  | "gps"
  | "legal"
  | "system"
  | "settings"
  | "new"
  | "people";

export const superAdminItems: Array<{
  href: string;
  title: string;
  section: AdminSection;
}> = [
  { href: "/dashboard/super-admin", title: "Panoramica", section: "home" },
  { href: "/dashboard/super-admin/owners", title: "Titolari", section: "owners" },
  { href: "/dashboard/super-admin/bars", title: "Attivita", section: "bars" },
  { href: "/dashboard/super-admin/people", title: "Dipendenti", section: "people" },
  { href: "/dashboard/super-admin/billing", title: "Abbonamenti", section: "billing" },
  { href: "/dashboard/super-admin/revenue", title: "Ricavi", section: "revenue" },
  { href: "/dashboard/super-admin/gps", title: "GPS globale", section: "gps" },
  { href: "/dashboard/super-admin/legal", title: "Documenti legali", section: "legal" },
  { href: "/dashboard/super-admin/system", title: "Utilizzo", section: "system" },
  { href: "/dashboard/super-admin/settings", title: "Impostazioni", section: "settings" },
];

export function AdminIcon({ section, size = 18 }: { section: AdminSection; size?: number }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (section === "owners") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15.5 19v-1.1a4.2 4.2 0 0 0-4.2-4.2H8a4.2 4.2 0 0 0-4.2 4.2V19" {...common} />
        <circle cx="9.6" cy="7.5" r="3.3" {...common} />
        <path d="M17 8h4M19 6v4" {...common} />
      </svg>
    );
  }

  if (section === "people") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8.5" cy="8" r="3" {...common} />
        <circle cx="16" cy="9.5" r="2.4" {...common} />
        <path d="M3.5 19v-.8a4.6 4.6 0 0 1 4.6-4.6h.8a4.6 4.6 0 0 1 4.6 4.6V19" {...common} />
        <path d="M14.5 14.3h.6a3.7 3.7 0 0 1 3.7 3.7v1" {...common} />
      </svg>
    );
  }

  if (section === "bars") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10h16v10H4V10Z" {...common} />
        <path d="m3 10 2-6h14l2 6M8 20v-6h4v6M16 14h1.5" {...common} />
      </svg>
    );
  }

  if (section === "billing") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" {...common} />
        <path d="M3 10h18M7 15h4" {...common} />
      </svg>
    );
  }

  if (section === "revenue") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" {...common} />
        <path d="M12 7.5v9M14.8 9.7c0-1.1-1.25-2-2.8-2s-2.8.9-2.8 2 1.25 1.8 2.8 1.8 2.8.7 2.8 1.9-1.25 2-2.8 2-2.8-.9-2.8-2" {...common} />
      </svg>
    );
  }

  if (section === "gps") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" {...common} />
        <circle cx="12" cy="10" r="2.2" {...common} />
      </svg>
    );
  }

  if (section === "legal") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" {...common} />
        <path d="M14 3.5V8h4M9 12h6M9 15.5h6M9 19h3" {...common} />
      </svg>
    );
  }

  if (section === "system") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" {...common} />
        <path d="M7 5h10a3 3 0 0 1 3 3v8" {...common} />
      </svg>
    );
  }

  if (section === "settings") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3.4" {...common} />
        <path d="M19 12a7 7 0 0 0-.12-1.3l2.02-1.54-2-3.46-2.38.96a7.3 7.3 0 0 0-2.24-1.3L14 2.8h-4l-.28 2.56a7.3 7.3 0 0 0-2.24 1.3L5.1 5.7l-2 3.46 2.02 1.54A7 7 0 0 0 5 12c0 .44.04.87.12 1.3L3.1 14.84l2 3.46 2.38-.96a7.3 7.3 0 0 0 2.24 1.3L10 21.2h4l.28-2.56a7.3 7.3 0 0 0 2.24-1.3l2.38.96 2-3.46-2.02-1.54c.08-.43.12-.86.12-1.3Z" {...common} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...common} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...common} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...common} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" {...common} />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "green" | "purple" | "orange";
}) {
  const toneColor = {
    neutral: "#111827",
    green: "#047857",
    purple: "#7b2ff7",
    orange: "#c2410c",
  } as const;

  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "16px 18px",
        borderRadius: 14,
        border: "1px solid var(--workbit-border)",
        background: "#ffffff",
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "#8b90ab",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: toneColor[tone],
          fontSize: 27,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          fontWeight: 700,
        }}
      >
        {value}
      </strong>
      {detail ? (
        <span style={{ color: "#8b90ab", fontSize: 12.5, lineHeight: 1.35 }}>{detail}</span>
      ) : null}
    </div>
  );
}

export function SuperAdminForbidden() {
  return (
    <Panel title="Super Admin">
      <EmptyState message="Questa area e riservata al super admin." />
    </Panel>
  );
}

export function SuperAdminFrame({
  title,
  description,
  section,
  children,
}: {
  title: string;
  description: string;
  section: AdminSection;
  children: ReactNode;
}) {
  return (
    <div className="super-admin-shell" aria-label={title}>
      {section !== "home" ? <h1 className="super-admin-title">{title}</h1> : null}

      {description ? <p className="super-admin-description">{description}</p> : null}

      <RevealOnScroll className="super-admin-content" delay={60}>
        {children}
      </RevealOnScroll>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-admin-shell {
              display: grid;
              gap: 14px;
              min-width: 0;
              width: 100%;
            }

            .super-admin-title {
              margin: 0;
              font-size: 22px;
              font-weight: 800;
              letter-spacing: -0.01em;
              color: var(--workbit-ink);
            }

            .super-admin-description {
              margin: 0;
              max-width: 640px;
              color: var(--workbit-muted);
              font-size: 13.5px;
              line-height: 1.5;
            }

            .super-admin-content {
              display: grid;
              gap: 18px;
              min-width: 0;
            }

            .super-admin-content .dashboard-panel {
              border-color: var(--workbit-border) !important;
              box-shadow: var(--workbit-shadow) !important;
            }

            .super-admin-content .dashboard-list-card,
            .super-admin-content .dashboard-item-card,
            .super-admin-content .dashboard-compact-list-item {
              padding: 16px !important;
              transition: border-color 140ms ease, transform 140ms ease;
            }

            .super-admin-content .dashboard-list-card:hover,
            .super-admin-content .dashboard-item-card:hover,
            .super-admin-content .dashboard-compact-list-item:hover {
              border-color: rgba(123, 47, 247, 0.32) !important;
              transform: translateY(-1px);
            }

            .super-admin-content button {
              min-height: 40px;
            }

            .sa-search {
              display: flex;
              align-items: center;
              gap: 10px;
              background: #ffffff;
              border: 1px solid var(--workbit-border);
              border-radius: 999px;
              padding: 13px 16px;
              box-shadow: var(--workbit-shadow);
            }

            .sa-search-icon {
              color: #98a2b3;
              display: inline-flex;
              flex-shrink: 0;
            }

            .sa-search input {
              border: none;
              outline: none;
              background: transparent;
              font-size: 14.5px;
              color: var(--workbit-ink);
              width: 100%;
            }

            .sa-row-head {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
              flex-wrap: wrap;
            }

            .sa-pill-btn {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              border-radius: 999px;
              border: none;
              padding: 10px 18px;
              font-size: 13.5px;
              font-weight: 800;
              color: #ffffff;
              background: linear-gradient(135deg, #7b2ff7, #a855f7);
              box-shadow: 0 12px 22px rgba(123, 47, 247, 0.22);
              cursor: pointer;
              white-space: nowrap;
            }

            .sa-badge {
              display: inline-flex;
              align-items: center;
              border-radius: 999px;
              padding: 5px 11px;
              font-size: 11.5px;
              font-weight: 700;
              background: #f4f2fe;
              color: #5b21b6;
            }

            .sa-card {
              display: grid;
              gap: 6px;
              background: #ffffff;
              border: 1px solid var(--workbit-border);
              box-shadow: var(--workbit-shadow);
              border-radius: 18px;
              padding: 16px;
            }

            .sa-actions {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }

            .sa-action {
              border-radius: 20px;
              padding: 16px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              gap: 20px;
              min-height: 96px;
              text-decoration: none;
            }

            .sa-action-primary {
              background: linear-gradient(135deg, #7b2ff7, #a855f7);
              color: #ffffff;
              box-shadow: 0 14px 26px rgba(123, 47, 247, 0.22);
            }

            .sa-action-secondary {
              background: #ffffff;
              border: 1px solid var(--workbit-border);
              color: var(--workbit-ink);
              box-shadow: var(--workbit-shadow);
            }

            .sa-action-icon {
              width: 32px;
              height: 32px;
              border-radius: 10px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 15px;
            }

            .sa-action-primary .sa-action-icon {
              background: rgba(255, 255, 255, 0.2);
            }

            .sa-action-secondary .sa-action-icon {
              background: #f4f2fe;
              color: #7b2ff7;
            }

            .sa-action-text {
              font-size: 13.5px;
              font-weight: 800;
              line-height: 1.25;
            }

            .sa-scrollstats {
              display: flex;
              gap: 10px;
              overflow-x: auto;
              padding-bottom: 2px;
            }

            .sa-stat {
              flex: 0 0 auto;
              width: 118px;
              display: grid;
              gap: 5px;
              padding: 14px 16px;
              border-radius: 16px;
              background: #ffffff;
              border: 1px solid var(--workbit-border);
              box-shadow: var(--workbit-shadow);
            }

            .sa-stat-lab {
              font-size: 10.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #98a2b3;
            }

            .sa-stat-val {
              font-size: 22px;
              font-weight: 800;
              font-variant-numeric: tabular-nums;
              color: var(--workbit-ink);
            }

            .sa-stat-warn { color: #b45309; }

            .sa-section-title {
              font-size: 12.5px;
              font-weight: 800;
              color: var(--workbit-muted);
              margin-top: 4px;
            }

            .sa-bar-track {
              display: flex;
              width: 100%;
              height: 10px;
              border-radius: 999px;
              overflow: hidden;
              background: #eef0f8;
            }

            .sa-bar-legend {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              margin-top: 10px;
            }

            .sa-bar-legend-item {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
              color: var(--workbit-muted);
            }

            .sa-bar-legend-item strong {
              color: var(--workbit-ink);
              font-variant-numeric: tabular-nums;
            }

            .sa-bar-dot {
              width: 8px;
              height: 8px;
              border-radius: 999px;
            }

            /* Modals portal to document.body, so this target must not be
               scoped under .super-admin-content - it relies on the
               sa-modal-panel class name being unique to this section. */
            .sa-modal-panel {
              border-radius: 26px !important;
            }
          `,
        }}
      />
    </div>
  );
}
