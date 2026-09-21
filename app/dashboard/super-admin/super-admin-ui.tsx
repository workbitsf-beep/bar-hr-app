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
      {section !== "home" ? (
        <Link href="/dashboard/super-admin" className="super-admin-back-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m15 18-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Panoramica
        </Link>
      ) : null}

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

            .super-admin-back-link {
              display: inline-flex;
              align-items: center;
              gap: 7px;
              width: fit-content;
              color: #9296b8;
              font-size: 13px;
              font-weight: 700;
              text-decoration: none;
              padding: 7px 12px 7px 8px;
              border-radius: 999px;
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(255, 255, 255, 0.09);
            }

            .super-admin-back-link:hover {
              color: #f5f3ff;
              border-color: rgba(123, 47, 247, 0.35);
            }

            .super-admin-description {
              margin: 0;
              max-width: 640px;
              color: #9296b8;
              font-size: 13.5px;
              line-height: 1.5;
            }

            .super-admin-content {
              display: grid;
              gap: 18px;
              min-width: 0;
              background: #0b1024;
              background-image: radial-gradient(circle at 100% 0%, rgba(123, 47, 247, 0.16), transparent 45%);
              border-radius: 24px;
              padding: 22px;
              color: #f5f3ff;
            }

            .super-admin-content .dashboard-panel {
              background: rgba(255, 255, 255, 0.04) !important;
              border-color: rgba(255, 255, 255, 0.09) !important;
              box-shadow: none !important;
              color: #f5f3ff !important;
            }

            .super-admin-content .dashboard-panel-title,
            .super-admin-content .dashboard-panel h1,
            .super-admin-content .dashboard-panel h2,
            .super-admin-content .dashboard-panel h3,
            .super-admin-content .dashboard-panel strong {
              color: #f5f3ff !important;
            }

            .super-admin-content .dashboard-panel span,
            .super-admin-content .dashboard-panel p,
            .super-admin-content .dashboard-panel small,
            .super-admin-content .dashboard-panel label {
              color: #9296b8;
            }

            .super-admin-content .dashboard-list-card {
              background: rgba(255, 255, 255, 0.03) !important;
              border-color: rgba(255, 255, 255, 0.08) !important;
              color: #f5f3ff !important;
              transition: border-color 140ms ease, transform 140ms ease;
            }

            .super-admin-content .dashboard-list-card:hover {
              border-color: rgba(123, 47, 247, 0.4) !important;
              transform: translateY(-1px);
            }

            .super-admin-content .dashboard-list-card strong {
              color: #f5f3ff !important;
            }

            .super-admin-content .dashboard-list-card span,
            .super-admin-content .dashboard-list-card small,
            .super-admin-content .dashboard-list-card p {
              color: #9296b8 !important;
            }

            .super-admin-content input,
            .super-admin-content select,
            .super-admin-content textarea {
              background: rgba(255, 255, 255, 0.05) !important;
              border-color: rgba(255, 255, 255, 0.14) !important;
              color: #f5f3ff !important;
              color-scheme: dark;
            }

            .super-admin-content input::placeholder,
            .super-admin-content textarea::placeholder {
              color: #6b7094;
            }

            /* Modals portal to document.body, so these targets must not be
               scoped under .super-admin-content - the selectors below rely
               on the sa-modal-* class names being unique to this section. */
            .sa-modal-panel {
              background: #12172c !important;
              border-color: rgba(255, 255, 255, 0.12) !important;
              color: #f5f3ff;
            }

            .sa-modal-panel h1,
            .sa-modal-panel h2,
            .sa-modal-panel h3,
            .sa-modal-panel strong {
              color: #f5f3ff !important;
            }

            .sa-modal-panel span,
            .sa-modal-panel p,
            .sa-modal-panel small,
            .sa-modal-panel label {
              color: #9296b8;
            }

            .sa-modal-panel input,
            .sa-modal-panel select,
            .sa-modal-panel textarea {
              background: rgba(255, 255, 255, 0.05) !important;
              border-color: rgba(255, 255, 255, 0.16) !important;
              color: #f5f3ff !important;
              color-scheme: dark;
            }

            .sa-modal-panel input::placeholder,
            .sa-modal-panel textarea::placeholder {
              color: #6b7094;
            }

            .sa-modal-panel button:not([class*="Primary"]) {
              background: rgba(255, 255, 255, 0.06);
              border-color: rgba(255, 255, 255, 0.16);
              color: #f5f3ff;
            }

            @media (max-width: 560px) {
              .super-admin-content {
                padding: 16px;
                border-radius: 18px;
              }
            }
          `,
        }}
      />
    </div>
  );
}
