import Link from "next/link";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

export default async function SuperAdminMoneyPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const [activeSubscriptions, trialSubscriptions, riskySubscriptions] = await Promise.all([
    prisma.subscription.count({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
    }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.TRIALING } }),
    prisma.subscription.count({
      where: {
        status: {
          in: [
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.UNPAID,
            SubscriptionStatus.CANCELED,
            SubscriptionStatus.INACTIVE,
          ],
        },
      },
    }),
  ]);

  const paidActive = Math.max(0, activeSubscriptions - trialSubscriptions);
  const total = Math.max(1, paidActive + trialSubscriptions + riskySubscriptions);

  return (
    <SuperAdminFrame
      title="Soldi"
      description="Stato degli abbonamenti in rete e accesso rapido a ricavi e fatturazione."
      section="billing"
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div
          className="dashboard-panel"
          style={{
            padding: 18,
            borderRadius: 18,
            display: "grid",
            gap: 10,
            background: "#ffffff",
            border: "1px solid var(--workbit-border)",
            boxShadow: "var(--workbit-shadow)",
          }}
        >
          <strong style={{ fontSize: 13.5 }}>Stato abbonamenti · {paidActive + trialSubscriptions + riskySubscriptions} totali</strong>
          <div className="sa-bar-track">
            <span style={{ width: `${(paidActive / total) * 100}%`, background: "#7b2ff7" }} />
            <span style={{ width: `${(trialSubscriptions / total) * 100}%`, background: "#fbbf24" }} />
            <span style={{ width: `${(riskySubscriptions / total) * 100}%`, background: "#f87171" }} />
          </div>
          <div className="sa-bar-legend">
            <span className="sa-bar-legend-item"><span className="sa-bar-dot" style={{ background: "#7b2ff7" }} />Paganti<strong>{paidActive}</strong></span>
            <span className="sa-bar-legend-item"><span className="sa-bar-dot" style={{ background: "#fbbf24" }} />In prova<strong>{trialSubscriptions}</strong></span>
            <span className="sa-bar-legend-item"><span className="sa-bar-dot" style={{ background: "#f87171" }} />Da rivedere<strong>{riskySubscriptions}</strong></span>
          </div>
        </div>

        <div className="sa-actions">
          <Link href="/dashboard/super-admin/billing" className="sa-action sa-action-secondary">
            <span className="sa-action-icon">💳</span>
            <span className="sa-action-text">Abbonamenti</span>
          </Link>
          <Link href="/dashboard/super-admin/revenue" className="sa-action sa-action-secondary">
            <span className="sa-action-icon">📈</span>
            <span className="sa-action-text">Ricavi</span>
          </Link>
        </div>
      </div>
    </SuperAdminFrame>
  );
}
