import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

export default async function SuperAdminTeamPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const recentOwners = await prisma.user.findMany({
    where: { role: Role.OWNER },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      ownedBars: { select: { name: true }, take: 1 },
    },
  });

  return (
    <SuperAdminFrame
      title="Team"
      description="Titolari e dipendenti di tutta la rete."
      section="owners"
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div className="sa-actions">
          <Link href="/dashboard/super-admin/owners" className="sa-action sa-action-secondary">
            <span className="sa-action-icon">👤</span>
            <span className="sa-action-text">Titolari</span>
          </Link>
          <Link href="/dashboard/super-admin/people" className="sa-action sa-action-secondary">
            <span className="sa-action-icon">👥</span>
            <span className="sa-action-text">Dipendenti
              <br />per locale</span>
          </Link>
        </div>

        <div className="sa-section-title">Titolari recenti</div>
        <div style={{ display: "grid", gap: 10 }}>
          {recentOwners.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 14 }}>Nessun titolare ancora.</div>
          ) : (
            recentOwners.map((owner) => (
              <div
                key={owner.id}
                className="dashboard-item-card"
                style={{
                  display: "grid",
                  gap: 4,
                  background: "#ffffff",
                  border: "1px solid var(--workbit-border)",
                  boxShadow: "var(--workbit-shadow)",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <strong style={{ fontSize: 13.5 }}>{owner.firstName} {owner.lastName}</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>{owner.ownedBars[0]?.name ?? "Nessun locale collegato"}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </SuperAdminFrame>
  );
}
