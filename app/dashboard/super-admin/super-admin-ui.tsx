import type { ReactNode } from "react";
import Link from "next/link";
import { RevealOnScroll } from "@/app/components/workbit-animations";
import { EmptyState, Panel } from "../ui";

type AdminSection =
  | "home"
  | "owners"
  | "bars"
  | "billing"
  | "revenue"
  | "gps"
  | "legal"
  | "system"
  | "settings";

const superAdminItems: Array<{
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

function AdminIcon({ section, size = 18 }: { section: AdminSection; size?: number }) {
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
    neutral: "#0f172a",
    green: "#047857",
    purple: "#6d28d9",
    orange: "#c2410c",
  } as const;

  return (
    <div
      style={{
        display: "grid",
        gap: 5,
        padding: "16px 18px",
        borderRadius: 14,
        border: "1px solid #e7e5e4",
        borderLeft: `3px solid ${toneColor[tone]}`,
        background: "#ffffff",
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "#8a8580",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "#1c1917",
          fontSize: 26,
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          fontWeight: 700,
        }}
      >
        {value}
      </strong>
      {detail ? (
        <span style={{ color: "#a8a29e", fontSize: 12.5, lineHeight: 1.35 }}>{detail}</span>
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
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="super-admin-workspace">
      <RevealOnScroll as="header" className="super-admin-command">
        <span className="super-admin-eyebrow">Super Admin</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </RevealOnScroll>

      <nav className="super-admin-route-rail" aria-label="Sezioni Super Admin">
        {superAdminItems.map((item) => (
          <Link key={item.href} href={item.href} className="super-admin-route">
            <span className="super-admin-route-icon" aria-hidden="true">
              <AdminIcon section={item.section} />
            </span>
            {item.title}
          </Link>
        ))}
      </nav>

      <RevealOnScroll className="super-admin-content" delay={60}>
        {children}
      </RevealOnScroll>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-admin-workspace {
              display: grid;
              gap: 20px;
              min-width: 0;
              width: 100%;
            }

            .super-admin-command {
              display: grid;
              gap: 6px;
              padding: 2px 2px 4px;
            }

            .super-admin-eyebrow {
              color: #78716c;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }

            .super-admin-command h1 {
              margin: 0;
              font-size: clamp(24px, 3vw, 32px);
              line-height: 1.15;
              color: #1c1917;
              font-weight: 700;
              letter-spacing: -0.02em;
            }

            .super-admin-command p {
              margin: 0;
              max-width: 640px;
              color: #78716c;
              font-size: 14.5px;
              line-height: 1.5;
            }

            .super-admin-route-rail {
              display: flex;
              gap: 4px;
              min-width: 0;
              overflow-x: auto;
              scrollbar-width: none;
              padding-bottom: 2px;
              border-bottom: 1px solid #e7e5e4;
            }

            .super-admin-route-rail::-webkit-scrollbar {
              display: none;
            }

            .super-admin-route {
              display: inline-flex;
              align-items: center;
              gap: 7px;
              flex: 0 0 auto;
              padding: 9px 14px;
              border-radius: 10px 10px 0 0;
              color: #78716c;
              font-size: 13.5px;
              font-weight: 600;
              text-decoration: none;
              white-space: nowrap;
              transition: color 140ms ease, background 140ms ease;
            }

            .super-admin-route-icon {
              display: inline-flex;
              color: #a8a29e;
              transition: color 140ms ease;
            }

            .super-admin-route:hover {
              color: #1c1917;
              background: #f5f5f4;
            }

            .super-admin-route:hover .super-admin-route-icon {
              color: #7c3aed;
            }

            .super-admin-content {
              display: grid;
              gap: 18px;
              min-width: 0;
            }

            .super-admin-content .dashboard-list-card {
              transition: border-color 140ms ease, transform 140ms ease;
            }

            .super-admin-content .dashboard-list-card:hover {
              border-color: #d6d3d1;
              transform: translateY(-1px);
            }

            @media (max-width: 640px) {
              .super-admin-route {
                padding: 8px 12px;
                font-size: 13px;
              }
            }
          `,
        }}
      />
    </div>
  );
}
