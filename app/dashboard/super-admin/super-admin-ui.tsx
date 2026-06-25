import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { EmptyState, Panel } from "../ui";

type AdminSection = "home" | "owners" | "bars" | "billing" | "gps" | "legal" | "system";

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
    href: "/dashboard/super-admin/owners",
    title: "Titolari",
    description: "Crea, cerca e collega proprietari.",
    eyebrow: "Persone",
    section: "owners",
    color: "#2563eb",
    tint: "#eff6ff",
  },
  {
    href: "/dashboard/super-admin/bars",
    title: "Attivita",
    description: "Clienti, sedi e tipologia operativa.",
    eyebrow: "Clienti",
    section: "bars",
    color: "#7c3aed",
    tint: "#f5f3ff",
  },
  {
    href: "/dashboard/super-admin/billing",
    title: "Pagamenti",
    description: "Trial, rinnovi, sconti e stato Stripe.",
    eyebrow: "Revenue",
    section: "billing",
    color: "#059669",
    tint: "#ecfdf5",
  },
  {
    href: "/dashboard/super-admin/gps",
    title: "GPS globale",
    description: "Range timbrature centralizzato.",
    eyebrow: "Sistema",
    section: "gps",
    color: "#d97706",
    tint: "#fffbeb",
  },
  {
    href: "/dashboard/super-admin/legal",
    title: "Documenti legali",
    description: "Policy, contratti e compliance.",
    eyebrow: "Compliance",
    section: "legal",
    color: "#9333ea",
    tint: "#faf5ff",
  },
  {
    href: "/dashboard/super-admin/system",
    title: "Sistema",
    description: "Metriche interne e consumi operativi.",
    eyebrow: "Monitoraggio",
    section: "system",
    color: "#0f766e",
    tint: "#f0fdfa",
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
        <path d="M15.5 19v-1.2a4.3 4.3 0 0 0-4.3-4.3H7.8a4.3 4.3 0 0 0-4.3 4.3V19" {...common} />
        <circle cx="9.5" cy="7.5" r="3.5" {...common} />
        <path d="M17 8h4M19 6v4M16.5 14.5a4.2 4.2 0 0 1 4 4.2V19" {...common} />
      </svg>
    );
  }

  if (section === "bars") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10h16v10H4V10Z" {...common} />
        <path d="m3 10 2-6h14l2 6M8 20v-6h4v6M16 14h1" {...common} />
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

  if (section === "gps") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" {...common} />
        <circle cx="12" cy="10" r="2.3" {...common} />
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

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2" {...common} />
      <rect x="14" y="3" width="7" height="7" rx="2" {...common} />
      <rect x="3" y="14" width="7" height="7" rx="2" {...common} />
      <rect x="14" y="14" width="7" height="7" rx="2" {...common} />
    </svg>
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
      <section className="super-admin-hero">
        <div className="super-admin-hero-glow" aria-hidden="true" />
        <div className="super-admin-hero-copy">
          <div className="super-admin-live-pill">
            <span className="super-admin-live-dot" aria-hidden="true" />
            Area admin
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <Link className="super-admin-home-link" href="/dashboard/super-admin">
          <AdminIcon section="home" size={18} />
          Panoramica
        </Link>
      </section>

      <nav className="super-admin-section-nav" aria-label="Sezioni Super Admin">
        {superAdminItems.map((item) => (
          <Link key={item.href} href={item.href} style={{ "--admin-accent": item.color } as CSSProperties}>
            <AdminIcon section={item.section} size={18} />
            {item.title}
          </Link>
        ))}
      </nav>

      <div className="super-admin-content">{children}</div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-admin-workspace {
              --admin-ink: #172033;
              --admin-muted: #667085;
              display: grid;
              gap: 16px;
              min-width: 0;
              width: 100%;
            }
            .super-admin-hero {
              position: relative;
              min-height: 190px;
              overflow: hidden;
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              gap: 22px;
              padding: 28px;
              border-radius: 32px;
              color: white;
              background:
                radial-gradient(circle at 82% 20%, rgba(255,255,255,.18), transparent 25%),
                linear-gradient(135deg, #111827 0%, #312e81 52%, #6d28d9 100%);
              box-shadow: 0 24px 60px rgba(49, 46, 129, .22);
            }
            .super-admin-hero-glow {
              position: absolute;
              width: 260px;
              height: 260px;
              right: -74px;
              top: -120px;
              border-radius: 999px;
              border: 38px solid rgba(255,255,255,.08);
              box-shadow: 0 0 0 38px rgba(255,255,255,.035);
            }
            .super-admin-hero-copy { position: relative; z-index: 1; display: grid; gap: 10px; max-width: 720px; }
            .super-admin-live-pill {
              width: fit-content;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 7px 11px;
              border-radius: 999px;
              border: 1px solid rgba(255,255,255,.18);
              background: rgba(255,255,255,.10);
              backdrop-filter: blur(12px);
              font-size: 12px;
              line-height: 1;
              font-weight: 800;
              letter-spacing: .04em;
              text-transform: uppercase;
              white-space: nowrap;
            }
            .super-admin-live-dot { width: 8px; height: 8px; border-radius: 99px; background: #86efac; box-shadow: 0 0 0 5px rgba(134,239,172,.14); }
            .super-admin-hero h1 { margin: 0; font-size: clamp(30px, 4vw, 48px); line-height: 1; letter-spacing: -.045em; }
            .super-admin-hero p { margin: 0; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.55; }
            .super-admin-home-link {
              position: relative;
              z-index: 1;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              flex: 0 0 auto;
              padding: 11px 14px;
              border-radius: 999px;
              color: #312e81;
              background: white;
              text-decoration: none;
              font-size: 13px;
              font-weight: 800;
              box-shadow: 0 12px 30px rgba(17,24,39,.20);
            }
            .super-admin-section-nav {
              display: flex;
              gap: 8px;
              padding: 8px;
              border-radius: 22px;
              overflow-x: auto;
              scrollbar-width: none;
              background: rgba(255,255,255,.82);
              border: 1px solid rgba(124,58,237,.10);
              box-shadow: 0 12px 30px rgba(88,28,135,.06);
              backdrop-filter: blur(16px);
            }
            .super-admin-section-nav::-webkit-scrollbar { display: none; }
            .super-admin-section-nav a {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              min-height: 42px;
              padding: 0 15px;
              border-radius: 16px;
              color: var(--admin-ink);
              background: white;
              border: 1px solid #eef0f4;
              text-decoration: none;
              font-size: 13px;
              font-weight: 800;
              white-space: nowrap;
              transition: transform .18s ease, color .18s ease, border-color .18s ease;
            }
            .super-admin-section-nav a:hover { transform: translateY(-1px); color: var(--admin-accent); border-color: color-mix(in srgb, var(--admin-accent) 30%, white); }
            .super-admin-content { display: grid; gap: 18px; min-width: 0; }
            .super-admin-content .dashboard-panel {
              border-color: rgba(124,58,237,.09) !important;
              box-shadow: 0 16px 40px rgba(88,28,135,.055) !important;
            }
            .super-admin-content .dashboard-list-card { transition: transform .18s ease, box-shadow .18s ease; }
            .super-admin-content .dashboard-list-card:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(15,23,42,.06); }
            @media (max-width: 720px) {
              .super-admin-workspace { gap: 12px; }
              .super-admin-hero { min-height: 170px; align-items: flex-start; padding: 22px; border-radius: 28px; }
              .super-admin-hero h1 { font-size: 34px; }
              .super-admin-home-link { padding: 10px; }
              .super-admin-home-link span { display: none; }
              .super-admin-section-nav { display: none; }
            }
          `,
        }}
      />
    </div>
  );
}

export function SuperAdminMenuGrid() {
  return (
    <div className="super-admin-menu-grid">
      {superAdminItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="super-admin-menu-card"
          style={
            {
              "--admin-accent": item.color,
              "--admin-tint": item.tint,
            } as CSSProperties
          }
        >
          <div className="super-admin-menu-card-top">
            <span className="super-admin-menu-icon">
              <AdminIcon section={item.section} />
            </span>
            <span className="super-admin-menu-arrow" aria-hidden="true">&#8599;</span>
          </div>
          <span className="super-admin-menu-eyebrow">{item.eyebrow}</span>
          <strong>{item.title}</strong>
          <span className="super-admin-menu-description">{item.description}</span>
        </Link>
      ))}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-admin-menu-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; min-width: 0; }
            .super-admin-menu-card {
              position: relative;
              display: grid;
              align-content: start;
              gap: 8px;
              min-height: 176px;
              padding: 18px;
              overflow: hidden;
              border-radius: 24px;
              color: #172033;
              background: linear-gradient(145deg, white 30%, var(--admin-tint));
              border: 1px solid color-mix(in srgb, var(--admin-accent) 13%, white);
              text-decoration: none;
              box-shadow: 0 14px 34px rgba(15,23,42,.055);
              transition: transform .2s ease, box-shadow .2s ease;
            }
            .super-admin-menu-card:hover { transform: translateY(-3px); box-shadow: 0 20px 42px color-mix(in srgb, var(--admin-accent) 13%, transparent); }
            .super-admin-menu-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
            .super-admin-menu-icon { width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; border-radius: 15px; color: var(--admin-accent); background: white; box-shadow: 0 8px 20px color-mix(in srgb, var(--admin-accent) 12%, transparent); }
            .super-admin-menu-arrow { color: var(--admin-accent); font-size: 20px; font-weight: 800; }
            .super-admin-menu-eyebrow { color: var(--admin-accent); font-size: 11px; line-height: 1; font-weight: 900; letter-spacing: .10em; text-transform: uppercase; }
            .super-admin-menu-card strong { font-size: 19px; letter-spacing: -.02em; }
            .super-admin-menu-description { color: #667085; font-size: 13px; line-height: 1.45; }
            @media (max-width: 980px) { .super-admin-menu-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 560px) {
              .super-admin-menu-grid { grid-template-columns: 1fr; }
              .super-admin-menu-card { min-height: 138px; }
            }
          `,
        }}
      />
    </div>
  );
}
