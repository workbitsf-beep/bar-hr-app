import type { ReactNode } from "react";
import Link from "next/link";
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
  | "settings";

export const superAdminItems: Array<{
  href: string;
  title: string;
  section: AdminSection;
}> = [
  { href: "/dashboard/super-admin", title: "Panoramica", section: "home" },
  { href: "/dashboard/super-admin/owners", title: "Titolari", section: "owners" },
  { href: "/dashboard/super-admin/bars", title: "Attivita", section: "bars" },
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
      <aside className="super-admin-sidebar" aria-label="Sezioni Super Admin">
        <div className="super-admin-sidebar-brand">
          <span className="super-admin-sidebar-mark" aria-hidden="true" />
          Super Admin
        </div>
        <nav className="super-admin-sidebar-nav">
          {superAdminItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="super-admin-sidebar-item"
              aria-current={item.section === section ? "page" : undefined}
            >
              <span className="super-admin-sidebar-icon" aria-hidden="true">
                <AdminIcon section={item.section} />
              </span>
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="super-admin-main">
        {description ? <p className="super-admin-description">{description}</p> : null}

        <RevealOnScroll className="super-admin-content" delay={60}>
          {children}
        </RevealOnScroll>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-admin-shell {
              display: grid;
              grid-template-columns: 216px minmax(0, 1fr);
              gap: 22px;
              min-width: 0;
              width: 100%;
              align-items: start;
            }

            .super-admin-sidebar {
              position: sticky;
              top: 12px;
              display: flex;
              flex-direction: column;
              gap: 16px;
              padding: 14px 10px;
              border-radius: 16px;
              background: var(--workbit-navy);
            }

            .super-admin-sidebar-brand {
              display: flex;
              align-items: center;
              gap: 9px;
              padding: 2px 8px;
              color: #ffffff;
              font-size: 12.5px;
              font-weight: 700;
              letter-spacing: 0.01em;
            }

            .super-admin-sidebar-mark {
              width: 20px;
              height: 20px;
              border-radius: 6px;
              background: var(--workbit-purple);
              flex: 0 0 auto;
            }

            .super-admin-sidebar-nav {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .super-admin-sidebar-item {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 9px 10px;
              border-radius: 9px;
              color: #a3a8c3;
              font-size: 13px;
              font-weight: 500;
              text-decoration: none;
              transition: background 140ms ease, color 140ms ease;
            }

            .super-admin-sidebar-icon {
              display: inline-flex;
              flex: 0 0 auto;
            }

            .super-admin-sidebar-item:hover {
              background: rgba(255,255,255,0.06);
              color: #ffffff;
            }

            .super-admin-sidebar-item[aria-current="page"] {
              background: var(--workbit-purple);
              color: #ffffff;
              font-weight: 600;
            }

            .super-admin-main {
              display: grid;
              gap: 16px;
              min-width: 0;
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

            .super-admin-content .dashboard-list-card {
              transition: border-color 140ms ease, transform 140ms ease;
            }

            .super-admin-content .dashboard-list-card:hover {
              border-color: rgba(123, 47, 247, 0.28);
              transform: translateY(-1px);
            }

            @media (max-width: 900px) {
              .super-admin-shell {
                grid-template-columns: minmax(0, 1fr);
                gap: 14px;
              }

              .super-admin-sidebar {
                display: none;
              }
            }
          `,
        }}
      />
    </div>
  );
}
