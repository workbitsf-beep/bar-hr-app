import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Role } from "@prisma/client";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel } from "../../ui";

/** The owner's venue for the Presenze settings pages, or the page that says why not. */
export async function ownerSettings(): Promise<{ barId: string; page: null } | { barId: null; page: ReactNode }> {
  const { role, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return {
      barId: null,
      page: (
        <Panel title="Impostazioni presenze">
          <EmptyState message="Seleziona un locale." />
        </Panel>
      ),
    };
  }
  if (billingStatus && !billingStatus.canAccess) return { barId: null, page: <BillingRequired role={String(role)} /> };
  if (role !== Role.OWNER) {
    return {
      barId: null,
      page: (
        <Panel title="Impostazioni presenze">
          <EmptyState message="Queste impostazioni sono del titolare." />
        </Panel>
      ),
    };
  }
  return { barId: activeBarId, page: null };
}

export const settingsRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "16px 18px",
  borderTop: "1px solid #f2f0f8",
  color: "#1f1b3a",
  fontSize: 16,
  textDecoration: "none",
};

export function SettingsShell({ back, backLabel, title, children }: { back: string; backLabel: string; title: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 640, margin: "0 auto", width: "100%", padding: "4px 4px 8px" }}>
      <Link href={back} style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none" }}>
        ‹ {backLabel}
      </Link>
      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 750, letterSpacing: "-0.03em" }}>{title}</h1>
      {children}
    </div>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 13, color: "#8a85a3", padding: "8px 18px 0" }}>{children}</span>;
}

export function GroupNote({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 13, color: "#8a85a3", padding: "0 18px", marginTop: -6 }}>{children}</span>;
}
