import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { EmptyState, Panel } from "../ui";

const superAdminItems = [
  {
    href: "/dashboard/super-admin/owners",
    title: "Titolari",
    description: "Crea nuovi titolari e invia la welcome email.",
  },
  {
    href: "/dashboard/super-admin/bars",
    title: "Locali",
    description: "Crea locali e associali al titolare corretto.",
  },
  {
    href: "/dashboard/super-admin/billing",
    title: "Pagamenti",
    description: "Gestisci piano, stato e scadenze dei locali.",
  },
  {
    href: "/dashboard/super-admin/gps",
    title: "GPS",
    description: "Imposta il raggio globale per le timbrature.",
  },
];

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
    <div style={{ display: "grid", gap: 18 }}>
      <section
        style={{
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          borderRadius: 28,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.07)",
          padding: 22,
          display: "grid",
          gap: 16,
        }}
      >
        <BrandLogo size={44} style={{ gap: 12 }} />
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ color: "#0f172a", fontSize: 20 }}>{title}</strong>
          <span style={{ color: "#64748b", lineHeight: 1.6 }}>{description}</span>
        </div>

        <nav
          aria-label="Menu Super Admin"
          className="dashboard-inline-actions"
          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          {superAdminItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                padding: "10px 14px",
                background: "#f8fafc",
                color: "#0f172a",
                border: "1px solid #e2e8f0",
                fontWeight: 700,
                textDecoration: "none",
              }}
              title={item.description}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </section>

      {children}
    </div>
  );
}

export function SuperAdminMenuGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 14,
      }}
    >
      {superAdminItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            display: "grid",
            gap: 8,
            minHeight: 120,
            padding: 18,
            borderRadius: 24,
            background: "#ffffff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            textDecoration: "none",
            boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
          }}
        >
          <strong style={{ fontSize: 18 }}>{item.title}</strong>
          <span style={{ color: "#64748b", lineHeight: 1.6 }}>{item.description}</span>
        </Link>
      ))}
    </div>
  );
}
