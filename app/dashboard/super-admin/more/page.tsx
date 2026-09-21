import Link from "next/link";
import { getDashboardContext } from "../../context";
import { AdminIcon, SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

const MORE_LINKS = [
  { href: "/dashboard/super-admin/gps", title: "GPS globale", detail: "Raggio predefinito per i nuovi locali", section: "gps" as const },
  { href: "/dashboard/super-admin/legal", title: "Documenti legali", detail: "Privacy, termini, contratti", section: "legal" as const },
  { href: "/dashboard/super-admin/system", title: "Utilizzo", detail: "Consumi e performance", section: "system" as const },
  { href: "/dashboard/super-admin/settings", title: "Impostazioni", detail: "Password, Face ID, altri admin", section: "settings" as const },
];

export default async function SuperAdminMorePage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  return (
    <SuperAdminFrame
      title="Altro"
      description="Impostazioni globali della rete e dell'account."
      section="settings"
    >
      <div style={{ display: "grid", gap: 10 }}>
        {MORE_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="dashboard-item-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "inherit",
              background: "#ffffff",
              border: "1px solid var(--workbit-border)",
              boxShadow: "var(--workbit-shadow)",
              borderRadius: 16,
              padding: 14,
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: "#f4f2fe",
                color: "#7b2ff7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AdminIcon section={item.section} size={18} />
            </span>
            <span style={{ display: "grid", gap: 2 }}>
              <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
              <span style={{ fontSize: 11.5, color: "#64748b" }}>{item.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </SuperAdminFrame>
  );
}
