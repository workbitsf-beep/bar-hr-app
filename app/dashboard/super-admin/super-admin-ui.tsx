import type { CSSProperties, ReactNode } from "react";
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
  description: string;
  eyebrow: string;
  section: AdminSection;
  color: string;
  tint: string;
}> = [
  {
    href: "/dashboard/super-admin",
    title: "Panoramica",
    description: "KPI, clienti e stato generale.",
    eyebrow: "Centro",
    section: "home",
    color: "#111827",
    tint: "#f8fafc",
  },
  {
    href: "/dashboard/super-admin/owners",
    title: "Titolari",
    description: "Account proprietari e associazioni.",
    eyebrow: "Persone",
    section: "owners",
    color: "#6d28d9",
    tint: "#f5f3ff",
  },
  {
    href: "/dashboard/super-admin/bars",
    title: "Attivita",
    description: "Locali, aziende e accessi.",
    eyebrow: "Clienti",
    section: "bars",
    color: "#2563eb",
    tint: "#eff6ff",
  },
  {
    href: "/dashboard/super-admin/billing",
    title: "Abbonamenti",
    description: "Piani, rinnovi e stato pagamenti.",
    eyebrow: "Billing",
    section: "billing",
    color: "#0891b2",
    tint: "#ecfeff",
  },
  {
    href: "/dashboard/super-admin/revenue",
    title: "Ricavi",
    description: "MRR, ARR e andamento incassi.",
    eyebrow: "Finanza",
    section: "revenue",
    color: "#b45309",
    tint: "#fffbeb",
  },
  {
    href: "/dashboard/super-admin/gps",
    title: "GPS globale",
    description: "Range e regole timbratura.",
    eyebrow: "Posizione",
    section: "gps",
    color: "#059669",
    tint: "#ecfdf5",
  },
  {
    href: "/dashboard/super-admin/legal",
    title: "Documenti legali",
    description: "Privacy, termini e documenti.",
    eyebrow: "Legal",
    section: "legal",
    color: "#7c2d12",
    tint: "#fff7ed",
  },
  {
    href: "/dashboard/super-admin/system",
    title: "Utilizzo",
    description: "Carico, runtime e salute app.",
    eyebrow: "Sistema",
    section: "system",
    color: "#0f172a",
    tint: "#f1f5f9",
  },
  {
    href: "/dashboard/super-admin/settings",
    title: "Impostazioni",
    description: "Account admin e sicurezza.",
    eyebrow: "Account",
    section: "settings",
    color: "#9333ea",
    tint: "#faf5ff",
  },
];

function AdminIcon({ section, size = 22 }: { section: AdminSection; size?: number }) {
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
        gap: 6,
        padding: 16,
        borderRadius: 24,
        border: "1px solid rgba(124, 58, 237, .13)",
        background: "rgba(255,255,255,.94)",
        boxShadow: "0 16px 38px rgba(88, 28, 135, .08)",
        minWidth: 0,
      }}
    >
      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</span>
      <strong
        style={{
          color: toneColor[tone],
          fontSize: 28,
          lineHeight: 1,
          letterSpacing: "-0.05em",
        }}
      >
        {value}
      </strong>
      {detail ? (
        <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.35 }}>{detail}</span>
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
      <RevealOnScroll as="section" className="super-admin-command">
        <div className="super-admin-command-copy">
          <span className="super-admin-command-pill">Super Admin</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <nav className="super-admin-route-grid" aria-label="Sezioni Super Admin">
          {superAdminItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="super-admin-route"
              style={
                {
                  "--admin-accent": item.color,
                  "--admin-tint": item.tint,
                } as CSSProperties
              }
            >
              <span className="super-admin-route-icon" aria-hidden="true">
                <AdminIcon section={item.section} size={20} />
              </span>
              <span className="super-admin-route-copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
            </Link>
          ))}
        </nav>
      </RevealOnScroll>

      <RevealOnScroll className="super-admin-content" delay={60}>
        {children}
      </RevealOnScroll>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-admin-workspace {
              --admin-ink: var(--workbit-navy);
              --admin-muted: var(--workbit-muted);
              display: grid;
              gap: 16px;
              min-width: 0;
              width: 100%;
            }

            .super-admin-command {
              display: grid;
              grid-template-columns: minmax(260px, .62fr) minmax(0, 1fr);
              gap: 18px;
              align-items: stretch;
              padding: 18px;
              border-radius: 24px;
              color: var(--admin-ink);
              background: linear-gradient(135deg, rgba(255,255,255,.98) 0%, rgba(248,250,252,.95) 100%);
              border: 1px solid rgba(124,58,237,.14);
              box-shadow: 0 18px 42px rgba(88,28,135,.10);
              overflow: hidden;
            }

            .super-admin-command-copy {
              min-width: 0;
              display: grid;
              align-content: center;
              gap: 10px;
              padding: 10px;
            }

            .super-admin-command-pill {
              width: fit-content;
              display: inline-flex;
              align-items: center;
              min-height: 30px;
              padding: 0 12px;
              border-radius: 999px;
              background: #f5f3ff;
              color: #5b21b6;
              border: 1px solid rgba(124,58,237,.16);
              font-size: 12px;
              line-height: 1;
              font-weight: 900;
              text-transform: uppercase;
              white-space: nowrap;
            }

            .super-admin-command h1 {
              margin: 0;
              font-size: clamp(28px, 3.4vw, 44px);
              line-height: 1.04;
              color: var(--admin-ink);
              font-weight: 900;
            }

            .super-admin-command p {
              margin: 0;
              max-width: 640px;
              color: var(--admin-muted);
              font-size: 15px;
              line-height: 1.55;
            }

            .super-admin-route-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px;
              min-width: 0;
            }

            .super-admin-route {
              display: grid;
              grid-template-columns: 42px minmax(0, 1fr);
              gap: 10px;
              align-items: center;
              min-height: 74px;
              padding: 12px;
              border-radius: 18px;
              color: var(--admin-ink);
              background: linear-gradient(135deg, #ffffff 0%, var(--admin-tint) 100%);
              border: 1px solid rgba(124,58,237,.12);
              text-decoration: none;
              box-shadow: 0 10px 24px rgba(15,23,42,.05);
              transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
            }

            .super-admin-route:hover {
              transform: translateY(-1px);
              border-color: color-mix(in srgb, var(--admin-accent) 34%, transparent);
              box-shadow: 0 14px 28px rgba(15,23,42,.08);
            }

            .super-admin-route-icon {
              width: 42px;
              height: 42px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 14px;
              color: #ffffff;
              background: var(--admin-accent);
              box-shadow: 0 10px 20px rgba(15,23,42,.12);
            }

            .super-admin-route-copy {
              display: grid;
              gap: 3px;
              min-width: 0;
            }

            .super-admin-route-copy strong {
              color: var(--admin-ink);
              font-size: 14px;
              line-height: 1.15;
              font-weight: 900;
            }

            .super-admin-route-copy span {
              color: var(--admin-muted);
              font-size: 12px;
              line-height: 1.3;
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
              transition: transform 140ms ease, box-shadow 140ms ease;
            }

            .super-admin-content .dashboard-list-card:hover {
              transform: translateY(-1px);
              box-shadow: 0 12px 24px rgba(15,23,42,.06);
            }

            @media (max-width: 980px) {
              .super-admin-command {
                grid-template-columns: 1fr;
              }
            }

            @media (max-width: 720px) {
              .super-admin-workspace {
                gap: 12px;
              }

              .super-admin-command {
                padding: 14px;
                border-radius: 22px;
              }

              .super-admin-command-copy {
                padding: 4px;
              }

              .super-admin-command h1 {
                font-size: 30px;
              }

              .super-admin-route-grid {
                display: flex;
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                scrollbar-width: none;
                padding-bottom: 2px;
              }

              .super-admin-route-grid::-webkit-scrollbar {
                display: none;
              }

              .super-admin-route {
                min-width: 236px;
                scroll-snap-align: start;
              }
            }
          `,
        }}
      />
    </div>
  );
}

