import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { EmptyState, Panel } from "../ui";

const superAdminItems = [
  {
    href: "/dashboard/super-admin/owners",
    title: "Responsabili",
    description: "Crea titolari, assegna accessi iniziali e monitora chi gestisce le attivita.",
  },
  {
    href: "/dashboard/super-admin/bars",
    title: "Strutture",
    description: "Apri nuove attivita, collega i titolari corretti e controlla i dati principali.",
  },
  {
    href: "/dashboard/super-admin/billing",
    title: "Abbonamenti",
    description: "Monitora stati, scadenze, sconti e situazione economica di ogni cliente.",
  },
  {
    href: "/dashboard/super-admin/gps",
    title: "GPS globale",
    description: "Definisci il range globale usato da tutte le attivita per le timbrature.",
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
    <div style={{ display: "grid", gap: 18, minWidth: 0, width: "100%", overflowX: "hidden" }}>
      <section
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          borderRadius: 28,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.07)",
          padding: 22,
          display: "grid",
          gap: 16,
          minWidth: 0,
          width: "100%",
          overflow: "hidden",
        }}
        >
          <BrandLogo size={44} showIcon style={{ gap: 12 }} />
          <div style={{ display: "grid", gap: 6 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              Super Admin
            </span>
            <strong style={{ color: "#0f172a", fontSize: 24 }}>{title}</strong>
            <span style={{ color: "#64748b", lineHeight: 1.6, overflowWrap: "anywhere" }}>{description}</span>
          </div>
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
        minWidth: 0,
        width: "100%",
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
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Apri
          </span>
          <strong style={{ fontSize: 18, overflowWrap: "anywhere" }}>{item.title}</strong>
          <span style={{ color: "#64748b", lineHeight: 1.6, overflowWrap: "anywhere" }}>{item.description}</span>
        </Link>
      ))}
    </div>
  );
}
