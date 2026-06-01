"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { StatusPill, TextInput } from "../ui";
import type {
  ActivityItem,
  ActivityTypeValue,
  OwnerDirectoryItem,
  RoleValue,
  StaffDirectoryItem,
  SuperAdminOverviewSummary,
} from "@/lib/super-admin-overview-types";

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

const surfaceStyle = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 28,
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.07)",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box" as const,
  overflow: "hidden",
};

type DirectorySection = "owners" | "staff" | "activities";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Nessuna data";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getActivityTypeLabel(activityType: ActivityTypeValue) {
  return activityType === "COMPANY" ? "Azienda" : "Ristorazione";
}

function getRoleLabel(role: RoleValue) {
  if (role === "OWNER") {
    return "Titolare";
  }

  if (role === "MANAGER") {
    return "Manager";
  }

  return "Dipendente";
}

function isRevenueActive(activity: ActivityItem) {
  return (
    activity.subscription.planType === "PAID" &&
    (activity.subscription.status === "ACTIVE" || activity.subscription.status === "TRIALING")
  );
}

function isTrialPending(activity: ActivityItem) {
  return activity.subscription.planType === "TRIAL";
}

function isPastDue(activity: ActivityItem) {
  return (
    activity.subscription.status === "PAST_DUE" ||
    activity.subscription.status === "UNPAID"
  );
}

function isInactive(activity: ActivityItem) {
  return (
    activity.subscription.status === "INACTIVE" ||
    activity.subscription.status === "CANCELED"
  );
}

function isFreeLifetime(activity: ActivityItem) {
  return (
    activity.subscription.planType === "FREE" ||
    activity.subscription.planType === "LIFETIME"
  );
}

function getDiscountMultiplier(discountPercent: number) {
  const normalizedDiscount = Math.max(0, Math.min(100, discountPercent));
  return 1 - normalizedDiscount / 100;
}

function getEstimatedMonthlyRevenue(activity: ActivityItem) {
  if (!isRevenueActive(activity)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(activity.subscription.monthlyDiscountPercent);

  if (activity.subscription.billingInterval === "YEARLY") {
    return (YEARLY_PRICE * multiplier) / 12;
  }

  return MONTHLY_PRICE * multiplier;
}

function getEstimatedAnnualRevenue(activity: ActivityItem) {
  if (!isRevenueActive(activity)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(activity.subscription.monthlyDiscountPercent);

  if (activity.subscription.billingInterval === "YEARLY") {
    return YEARLY_PRICE * multiplier;
  }

  return MONTHLY_PRICE * 12 * multiplier;
}

function getTrialPipelineMonthly(activity: ActivityItem) {
  if (!isTrialPending(activity)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(activity.subscription.monthlyDiscountPercent);

  if (activity.subscription.billingInterval === "YEARLY") {
    return (YEARLY_PRICE * multiplier) / 12;
  }

  return MONTHLY_PRICE * multiplier;
}

function getStatusLabel(activity: ActivityItem) {
  if (isFreeLifetime(activity)) {
    return activity.subscription.planType === "FREE" ? "Free" : "Lifetime";
  }

  if (activity.subscription.planType === "TRIAL") {
    return "Trial";
  }

  if (isPastDue(activity)) {
    return "Past due";
  }

  if (isInactive(activity)) {
    return "Inactive";
  }

  return "Active";
}

function getStatusTone(activity: ActivityItem) {
  if (isPastDue(activity)) {
    return "danger" as const;
  }

  if (activity.subscription.planType === "TRIAL") {
    return "warning" as const;
  }

  if (isFreeLifetime(activity)) {
    return "neutral" as const;
  }

  if (isInactive(activity)) {
    return "neutral" as const;
  }

  return "success" as const;
}

function getReferenceDate(activity: ActivityItem) {
  return activity.subscription.planType === "TRIAL"
    ? activity.subscription.trialEndsAt
    : activity.subscription.currentPeriodEnd;
}

function isExpiringSoon(activity: ActivityItem) {
  const referenceDate = getReferenceDate(activity);

  if (!referenceDate) {
    return false;
  }

  const diffDays = Math.ceil(
    (new Date(referenceDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return diffDays >= 0 && diffDays <= 7;
}

function getExpiryLabel(activity: ActivityItem) {
  const referenceDate = getReferenceDate(activity);

  if (!referenceDate) {
    return "Nessuna scadenza registrata";
  }

  return activity.subscription.planType === "TRIAL"
    ? `Trial fino al ${formatDateLabel(referenceDate)}`
    : `Prossimo rinnovo ${formatDateLabel(referenceDate)}`;
}

function matchesText(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#64748b",
          minWidth: 0,
        }}
      >
        {eyebrow}
      </span>
      <strong style={{ color: "#0f172a", fontSize: 22, overflowWrap: "anywhere" }}>{title}</strong>
      <span style={{ color: "#64748b", lineHeight: 1.6, overflowWrap: "anywhere" }}>{subtitle}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      style={{
        ...surfaceStyle,
        padding: 18,
        display: "grid",
        gap: 8,
        minWidth: 0,
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
        {label}
      </span>
      <strong style={{ color: "#0f172a", fontSize: 28, lineHeight: 1.05, overflowWrap: "anywhere" }}>{value}</strong>
      <span style={{ color: "#64748b", lineHeight: 1.5, overflowWrap: "anywhere" }}>{hint}</span>
    </div>
  );
}

function TinyStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "dark" | "green" | "amber" | "red" | "slate";
}) {
  const palette = {
    dark: { background: "#e2e8f0", color: "#0f172a" },
    green: { background: "#dcfce7", color: "#166534" },
    amber: { background: "#fef3c7", color: "#92400e" },
    red: { background: "#fee2e2", color: "#991b1b" },
    slate: { background: "#f1f5f9", color: "#475569" },
  };

  return (
    <div
      style={{
        borderRadius: 18,
        padding: "12px 14px",
        background: palette[tone].background,
        color: palette[tone].color,
        display: "grid",
        gap: 4,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{label}</span>
      <strong style={{ fontSize: 18, overflowWrap: "anywhere" }}>{value}</strong>
    </div>
  );
}

function HorizontalBarChart({
  items,
}: {
  items: Array<{
    key: string;
    label: string;
    value: number;
    meta: string;
  }>;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <div key={item.key} style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <strong style={{ color: "#0f172a", overflowWrap: "anywhere" }}>{item.label}</strong>
            <span style={{ color: "#475569" }}>{item.meta}</span>
          </div>
          <div
            style={{
              height: 12,
              borderRadius: 999,
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(8, (item.value / maxValue) * 100)}%`,
                height: "100%",
                borderRadius: 999,
                background:
                  "linear-gradient(90deg, rgba(15,23,42,0.92), rgba(71,85,105,0.82))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StackedStatusBar({
  counts,
}: {
  counts: Array<{
    key: string;
    label: string;
    value: number;
    color: string;
  }>;
}) {
  const total = counts.reduce((sum, item) => sum + item.value, 0);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 14,
          borderRadius: 999,
          overflow: "hidden",
          background: "#e2e8f0",
        }}
      >
        {counts.map((item) => (
          <div
            key={item.key}
            style={{
              width: `${total === 0 ? 0 : (item.value / total) * 100}%`,
              minWidth: item.value > 0 ? 10 : 0,
              background: item.color,
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {counts.map((item) => (
          <div
            key={item.key}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 16,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: item.color,
                flexShrink: 0,
              }}
            />
            <div style={{ display: "grid", gap: 2 }}>
              <strong style={{ color: "#0f172a", fontSize: 14 }}>{item.label}</strong>
              <span style={{ color: "#64748b", fontSize: 13 }}>{item.value} attivita</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectoryCard({
  title,
  subtitle,
  status,
  lines,
}: {
  title: string;
  subtitle: string;
  status?: { label: string; tone: "neutral" | "success" | "warning" | "danger" };
  lines: string[];
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 22,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ color: "#0f172a", fontSize: 17, overflowWrap: "anywhere" }}>{title}</strong>
          <span style={{ color: "#475569", lineHeight: 1.5, overflowWrap: "anywhere" }}>{subtitle}</span>
        </div>
        {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {lines.map((line) => (
          <span key={line} style={{ color: "#64748b", lineHeight: 1.5, overflowWrap: "anywhere" }}>
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionLink({
  href,
  label,
  tone = "dark",
}: {
  href: string;
  label: string;
  tone?: "dark" | "sand";
}) {
  const palette = {
    dark: {
      background: "#0f172a",
      color: "#ffffff",
    },
    sand: {
      background: "#475569",
      color: "#ffffff",
    },
  };

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        padding: "12px 16px",
        fontWeight: 700,
        boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
        minWidth: 0,
        ...palette[tone],
      }}
    >
      {label}
    </Link>
  );
}

export function SuperAdminOverviewClient({
  summary,
  activities,
  owners,
  staff,
}: {
  summary: SuperAdminOverviewSummary;
  activities: ActivityItem[];
  owners: OwnerDirectoryItem[];
  staff: StaffDirectoryItem[];
}) {
  const [ownerQuery, setOwnerQuery] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [activityQuery, setActivityQuery] = useState("");
  const [activeDirectorySection, setActiveDirectorySection] =
    useState<DirectorySection>("activities");
  const [activityTypeFilter, setActivityTypeFilter] = useState<
    "ALL" | ActivityTypeValue
  >("ALL");
  const deferredOwnerQuery = useDeferredValue(ownerQuery);
  const deferredStaffQuery = useDeferredValue(staffQuery);
  const deferredActivityQuery = useDeferredValue(activityQuery);

  const revenueSummary = useMemo(() => {
    let activeMonthly = 0;
    let activeAnnual = 0;
    let trialPipeline = 0;
    let restaurantMonthly = 0;
    let companyMonthly = 0;

    for (const activity of activities) {
      const monthlyRevenue = getEstimatedMonthlyRevenue(activity);
      const annualRevenue = getEstimatedAnnualRevenue(activity);
      const trialRevenue = getTrialPipelineMonthly(activity);

      activeMonthly += monthlyRevenue;
      activeAnnual += annualRevenue;
      trialPipeline += trialRevenue;

      if (activity.activityType === "COMPANY") {
        companyMonthly += monthlyRevenue;
      } else {
        restaurantMonthly += monthlyRevenue;
      }
    }

    return {
      activeMonthly,
      activeAnnual,
      trialPipeline,
      restaurantMonthly,
      companyMonthly,
    };
  }, [activities]);

  const statusCounts = useMemo(
    () => [
      {
        key: "active",
        label: "Active",
        value: summary.activeCount,
        color: "#16a34a",
      },
      {
        key: "trial",
        label: "Trial",
        value: summary.trialCount,
        color: "#f59e0b",
      },
      {
        key: "risk",
        label: "Rischio",
        value: summary.atRiskCount,
        color: "#dc2626",
      },
      {
        key: "inactive",
        label: "Inactive",
        value: summary.inactiveCount,
        color: "#64748b",
      },
      {
        key: "free",
        label: "Free/Lifetime",
        value: summary.freeLifetimeCount,
        color: "#6366f1",
      },
    ],
    [summary]
  );

  const topRevenueActivities = useMemo(
    () =>
      [...activities]
        .map((activity) => ({
          key: activity.id,
          label: activity.name,
          value: getEstimatedMonthlyRevenue(activity),
          meta: `${formatCurrency(getEstimatedMonthlyRevenue(activity))} / mese`,
        }))
        .filter((activity) => activity.value > 0)
        .sort((left, right) => right.value - left.value)
        .slice(0, 7),
    [activities]
  );

  const atRiskActivities = useMemo(
    () =>
      activities
        .filter((activity) => isPastDue(activity) || isInactive(activity))
        .sort((left, right) => {
          const leftRank = isPastDue(left) ? 0 : 1;
          const rightRank = isPastDue(right) ? 0 : 1;
          return leftRank - rightRank;
        })
        .slice(0, 6),
    [activities]
  );

  const expiringActivities = useMemo(
    () => activities.filter((activity) => isExpiringSoon(activity)).slice(0, 6),
    [activities]
  );

  const trialActivities = useMemo(
    () =>
      activities
        .filter((activity) => activity.subscription.planType === "TRIAL")
        .slice(0, 6),
    [activities]
  );

  const filteredOwners = useMemo(
    () =>
      owners.filter((owner) => {
        return matchesText(owner.searchText, deferredOwnerQuery);
      }),
    [deferredOwnerQuery, owners]
  );

  const filteredStaff = useMemo(
    () =>
      staff.filter((member) => {
        return matchesText(member.searchText, deferredStaffQuery);
      }),
    [deferredStaffQuery, staff]
  );

  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) => {
        if (
          activityTypeFilter !== "ALL" &&
          activity.activityType !== activityTypeFilter
        ) {
          return false;
        }

        const haystack = [
          activity.name,
          activity.city ?? "",
          activity.owner.firstName,
          activity.owner.lastName,
          activity.owner.email,
          getActivityTypeLabel(activity.activityType),
          getStatusLabel(activity),
        ].join(" ");

        return matchesText(haystack, deferredActivityQuery);
      }),
    [activities, activityTypeFilter, deferredActivityQuery]
  );

  return (
    <div style={{ display: "grid", gap: 18, minWidth: 0, width: "100%", overflowX: "hidden" }}>
      <section
        style={{
          ...surfaceStyle,
          padding: 22,
          display: "grid",
          gap: 16,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        }}
      >
        <SectionTitle
          eyebrow="Ricavi"
          title="Ricavo annuo stimato"
          subtitle="Valore calcolato sugli abbonamenti attivi, annuali e mensili, includendo gli sconti impostati."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <TinyStat
            label="Ricavo annuo"
            value={formatCurrency(revenueSummary.activeAnnual)}
            tone="green"
          />
          <TinyStat
            label="Ricavo mensile"
            value={formatCurrency(revenueSummary.activeMonthly)}
            tone="dark"
          />
          <TinyStat
            label="Attivita"
            value={String(summary.totalActivities)}
            tone="slate"
          />
        </div>
      </section>

      <section
        style={{
          ...surfaceStyle,
          padding: 22,
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <SectionTitle
            eyebrow="Attivita"
            title="Clienti e strutture"
            subtitle="Ricerca rapida per attivita, titolare, citta e stato abbonamento."
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ width: "min(320px, 100%)" }}>
              <TextInput
                value={activityQuery}
                onChange={(event) => setActivityQuery(event.target.value)}
                placeholder="Cerca attivita, citta o titolare"
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["ALL", "Tutte"],
                ["RESTAURANT", "Ristorazione"],
                ["COMPANY", "Aziende"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setActivityTypeFilter(value as "ALL" | ActivityTypeValue)
                  }
                  style={{
                    borderRadius: 999,
                    border:
                      activityTypeFilter === value
                        ? "1px solid #0f172a"
                        : "1px solid #dbe3ee",
                    background:
                      activityTypeFilter === value ? "#0f172a" : "#ffffff",
                    color: activityTypeFilter === value ? "#ffffff" : "#334155",
                    padding: "10px 14px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {filteredActivities.slice(0, 24).map((activity) => (
            <div
              key={activity.id}
              style={{
                padding: 18,
                borderRadius: 24,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ color: "#0f172a", fontSize: 18 }}>{activity.name}</strong>
                    <StatusPill label={getActivityTypeLabel(activity.activityType)} tone="neutral" />
                    <StatusPill label={getStatusLabel(activity)} tone={getStatusTone(activity)} />
                  </div>
                  <span style={{ color: "#475569", lineHeight: 1.5 }}>
                    {activity.owner.firstName} {activity.owner.lastName} - {activity.city || "Citta non indicata"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionLink href="/dashboard/super-admin/bars" label="Struttura" tone="sand" />
                  <ActionLink href="/dashboard/super-admin/billing" label="Abbonamento" />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 10,
                }}
              >
                <TinyStat
                  label="Ricavo anno"
                  value={formatCurrency(getEstimatedAnnualRevenue(activity))}
                  tone="green"
                />
                <TinyStat
                  label="Ricavo mese"
                  value={formatCurrency(getEstimatedMonthlyRevenue(activity))}
                  tone="dark"
                />
                <TinyStat
                  label="Staff"
                  value={String(activity.staffCounts.total)}
                  tone="slate"
                />
                <TinyStat
                  label="Sconto"
                  value={`${activity.subscription.monthlyDiscountPercent}%`}
                  tone="amber"
                />
              </div>
            </div>
          ))}
        </div>

        {filteredActivities.length === 0 ? (
          <div style={{ color: "#64748b", lineHeight: 1.6 }}>
            Nessuna attivita trovata con i filtri attuali.
          </div>
        ) : null}
      </section>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section
        style={{
          ...surfaceStyle,
          padding: 22,
          display: "grid",
          gap: 16,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        }}
      >
        <SectionTitle
          eyebrow="Dashboard"
          title="Controllo completo delle attivita"
          subtitle="Monitora strutture, staff associato, stato pagamenti e ricavo stimato senza uscire dalla console centrale."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <TinyStat label="Ricavo attivo mese" value={formatCurrency(revenueSummary.activeMonthly)} tone="dark" />
          <TinyStat label="Ricavo annuo stimato" value={formatCurrency(revenueSummary.activeAnnual)} tone="green" />
          <TinyStat label="Pipeline trial" value={formatCurrency(revenueSummary.trialPipeline)} tone="amber" />
          <TinyStat label="Attivita a rischio" value={String(summary.atRiskCount)} tone="red" />
          <TinyStat label="Timbrature 30 gg" value={String(summary.last30Timelogs)} tone="slate" />
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <MetricCard
          label="Attivita"
          value={String(summary.totalActivities)}
          hint={`${summary.restaurantCount} ristorazione, ${summary.companyCount} aziende`}
        />
        <MetricCard
          label="Titolari"
          value={String(summary.ownerCount)}
          hint="Con almeno una attivita collegata"
        />
        <MetricCard
          label="Staff associato"
          value={String(summary.staffCount)}
          hint="Manager e dipendenti attivi"
        />
        <MetricCard
          label="Pagamenti attivi"
          value={String(summary.activeCount)}
          hint="Attivita con piano pagante attivo"
        />
        <MetricCard
          label="Trial"
          value={String(summary.trialCount)}
          hint="Account in prova da convertire"
        />
        <MetricCard
          label="Richieste pendenti"
          value={String(summary.pendingRequests)}
          hint="Ferie, permessi e cambi ancora aperti"
        />
        <MetricCard
          label="Task aperti"
          value={String(summary.openTasks)}
          hint="Mansioni ancora da completare"
        />
        <MetricCard
          label="Free / lifetime"
          value={String(summary.freeLifetimeCount)}
          hint="Attivita sbloccate senza rinnovo Stripe"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
          gap: 18,
        }}
      >
        <section
          style={{
            ...surfaceStyle,
            padding: 22,
            display: "grid",
            gap: 16,
          }}
        >
          <SectionTitle
            eyebrow="Ricavi"
            title="Entrata stimata per attivita"
            subtitle="Valori basati sugli abbonamenti attivi, sugli annuali convertiti in quota mensile e sugli sconti applicati."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <TinyStat
              label="Ristorazione"
              value={formatCurrency(revenueSummary.restaurantMonthly)}
              tone="dark"
            />
            <TinyStat
              label="Aziende"
              value={formatCurrency(revenueSummary.companyMonthly)}
              tone="slate"
            />
            <TinyStat
              label="Media per attivita attiva"
              value={
                summary.activeCount > 0
                  ? formatCurrency(revenueSummary.activeMonthly / summary.activeCount)
                  : formatCurrency(0)
              }
              tone="green"
            />
          </div>

          {topRevenueActivities.length === 0 ? (
            <div style={{ color: "#64748b", lineHeight: 1.6 }}>
              Nessun ricavo attivo da mostrare al momento.
            </div>
          ) : (
            <HorizontalBarChart items={topRevenueActivities} />
          )}
        </section>

        <section
          style={{
            ...surfaceStyle,
            padding: 22,
            display: "grid",
            gap: 16,
          }}
        >
          <SectionTitle
            eyebrow="Salute account"
            title="Distribuzione pagamenti"
            subtitle="Colpo d'occhio immediato su attivi, trial, criticita e attivita non operative."
          />
          <StackedStatusBar counts={statusCounts} />
        </section>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}
      >
        <section
          style={{
            ...surfaceStyle,
            padding: 22,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionTitle
            eyebrow="Alert"
            title="Attivita a rischio"
            subtitle="Past due, unpaid o non operative da recuperare."
          />
          {atRiskActivities.length === 0 ? (
            <div style={{ color: "#64748b", lineHeight: 1.6 }}>
              Nessuna criticita aperta.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {atRiskActivities.map((activity) => (
                <DirectoryCard
                  key={activity.id}
                  title={activity.name}
                  subtitle={`${activity.owner.firstName} ${activity.owner.lastName} - ${getActivityTypeLabel(activity.activityType)}`}
                  status={{ label: getStatusLabel(activity), tone: getStatusTone(activity) }}
                  lines={[
                    getExpiryLabel(activity),
                    `Ricavo attivo stimato: ${formatCurrency(getEstimatedMonthlyRevenue(activity))} / mese`,
                  ]}
                />
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            ...surfaceStyle,
            padding: 22,
            display: "grid",
            gap: 14,
          }}
        >
          <SectionTitle
            eyebrow="Scadenze"
            title="Trial e rinnovi vicini"
            subtitle="Attivita che meritano un follow-up rapido nei prossimi giorni."
          />
          <div style={{ display: "grid", gap: 10 }}>
            {[...expiringActivities, ...trialActivities]
              .slice(0, 6)
              .map((activity) => (
                <DirectoryCard
                  key={`${activity.id}-${activity.subscription.planType}`}
                  title={activity.name}
                  subtitle={`${activity.owner.firstName} ${activity.owner.lastName} - ${activity.city || "Citta non indicata"}`}
                  status={{ label: getStatusLabel(activity), tone: getStatusTone(activity) }}
                  lines={[
                    getExpiryLabel(activity),
                    isTrialPending(activity)
                      ? `Pipeline stimata: ${formatCurrency(getTrialPipelineMonthly(activity))} / mese`
                      : `Ricavo attivo: ${formatCurrency(getEstimatedMonthlyRevenue(activity))} / mese`,
                  ]}
                />
              ))}
            {expiringActivities.length === 0 && trialActivities.length === 0 ? (
              <div style={{ color: "#64748b", lineHeight: 1.6 }}>
                Nessuna scadenza vicina al momento.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section
        style={{
          ...surfaceStyle,
          padding: 18,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {[
            ["activities", `Attivita (${activities.length})`],
            ["owners", `Titolari (${owners.length})`],
            ["staff", `Staff (${staff.length})`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveDirectorySection(value as DirectorySection)}
              style={{
                borderRadius: 999,
                border:
                  activeDirectorySection === value
                    ? "1px solid #0f172a"
                    : "1px solid #dbe3ee",
                background:
                  activeDirectorySection === value ? "#0f172a" : "#ffffff",
                color: activeDirectorySection === value ? "#ffffff" : "#334155",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ color: "#64748b", lineHeight: 1.6 }}>
          La console completa resta disponibile, ma mostro una directory pesante per volta per
          rendere il caricamento piu fluido.
        </span>
      </section>

      {activeDirectorySection === "owners" ? (
        <section
          style={{
            ...surfaceStyle,
            padding: 22,
            display: "grid",
            gap: 16,
          }}
        >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <SectionTitle
            eyebrow="Ricerca titolari"
            title="Directory responsabili"
            subtitle="Trova subito chi gestisce piu attivita, chi vale di piu e dove intervenire."
          />
          <div style={{ width: "min(320px, 100%)" }}>
            <TextInput
              value={ownerQuery}
              onChange={(event) => setOwnerQuery(event.target.value)}
              placeholder="Cerca per nome, email o attivita"
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {filteredOwners.slice(0, 12).map((owner) => (
            <DirectoryCard
              key={owner.id}
              title={`${owner.firstName} ${owner.lastName}`}
              subtitle={owner.email}
              lines={[
                `${owner.activityCount} attivita collegate`,
                `${owner.restaurantCount} ristorazione, ${owner.companyCount} aziende`,
                `Ricavo stimato gestito: ${formatCurrency(owner.estimatedMonthlyRevenue)} / mese`,
                owner.activityPreview.join(", ") ||
                  "Nessuna attivita",
              ]}
            />
          ))}
        </div>

        {filteredOwners.length === 0 ? (
          <div style={{ color: "#64748b", lineHeight: 1.6 }}>
            Nessun titolare trovato con i filtri attuali.
          </div>
        ) : null}
        </section>
      ) : null}

      {activeDirectorySection === "staff" ? (
        <section
          style={{
            ...surfaceStyle,
            padding: 22,
            display: "grid",
            gap: 16,
          }}
        >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <SectionTitle
            eyebrow="Ricerca staff"
            title="Manager e dipendenti associati"
            subtitle="Consulta dove lavorano, con quale ruolo e quante attivita seguono."
          />
          <div style={{ width: "min(320px, 100%)" }}>
            <TextInput
              value={staffQuery}
              onChange={(event) => setStaffQuery(event.target.value)}
              placeholder="Cerca per nome, email, ruolo o attivita"
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {filteredStaff.slice(0, 12).map((member) => (
            <DirectoryCard
              key={member.id}
              title={`${member.firstName} ${member.lastName}`}
              subtitle={member.email}
              lines={[
                `${member.activityCount} attivita collegate`,
                `Ruoli: ${member.roles.map(getRoleLabel).join(", ")}`,
                member.activityPreview.join(", "),
              ]}
            />
          ))}
        </div>

        {filteredStaff.length === 0 ? (
          <div style={{ color: "#64748b", lineHeight: 1.6 }}>
            Nessun membro dello staff trovato con i filtri attuali.
          </div>
        ) : null}
        </section>
      ) : null}

      {activeDirectorySection === "activities" ? (
        <section
          style={{
            ...surfaceStyle,
            padding: 22,
            display: "grid",
            gap: 16,
          }}
        >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <SectionTitle
            eyebrow="Attivita"
            title="Monitoraggio economico e operativo"
            subtitle="Ricerca rapida sulle singole attivita con titolare, staff, stato abbonamento e ricavo stimato."
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ width: "min(320px, 100%)" }}>
              <TextInput
                value={activityQuery}
                onChange={(event) => setActivityQuery(event.target.value)}
                placeholder="Cerca attivita, citta o titolare"
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["ALL", "Tutte"],
                ["RESTAURANT", "Ristorazione"],
                ["COMPANY", "Aziende"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setActivityTypeFilter(value as "ALL" | ActivityTypeValue)
                  }
                  style={{
                    borderRadius: 999,
                    border:
                      activityTypeFilter === value
                        ? "1px solid #0f172a"
                        : "1px solid #dbe3ee",
                    background:
                      activityTypeFilter === value ? "#0f172a" : "#ffffff",
                    color: activityTypeFilter === value ? "#ffffff" : "#334155",
                    padding: "10px 14px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {filteredActivities.slice(0, 18).map((activity) => (
            <div
              key={activity.id}
              style={{
                padding: 18,
                borderRadius: 24,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ color: "#0f172a", fontSize: 18 }}>{activity.name}</strong>
                    <StatusPill label={getActivityTypeLabel(activity.activityType)} tone="neutral" />
                    <StatusPill label={getStatusLabel(activity)} tone={getStatusTone(activity)} />
                  </div>
                  <span style={{ color: "#475569", lineHeight: 1.5 }}>
                    {activity.owner.firstName} {activity.owner.lastName} - {activity.city || "Citta non indicata"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionLink href="/dashboard/super-admin/bars" label="Gestisci struttura" tone="sand" />
                  <ActionLink href="/dashboard/super-admin/billing" label="Gestisci abbonamento" />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 10,
                }}
              >
                <TinyStat
                  label="Ricavo mese"
                  value={formatCurrency(getEstimatedMonthlyRevenue(activity))}
                  tone="dark"
                />
                <TinyStat
                  label="Ricavo anno"
                  value={formatCurrency(getEstimatedAnnualRevenue(activity))}
                  tone="green"
                />
                <TinyStat
                  label="Staff attivo"
                  value={String(activity.staffCounts.total)}
                  tone="slate"
                />
                <TinyStat
                  label="Sconto"
                  value={`${activity.subscription.monthlyDiscountPercent}%`}
                  tone="amber"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 10,
                  color: "#64748b",
                }}
              >
                <span>
                  Owner: {activity.staffCounts.owners} - Manager: {activity.staffCounts.managers} - Dipendenti: {activity.staffCounts.employees}
                </span>
                <span>
                  Turni {activity.operations.shifts} - Timbrature {activity.operations.timeLogs}
                </span>
                <span>
                  Richieste {activity.operations.requests} - Task {activity.operations.tasks}
                </span>
                <span>{getExpiryLabel(activity)}</span>
              </div>
            </div>
          ))}
        </div>

        {filteredActivities.length === 0 ? (
          <div style={{ color: "#64748b", lineHeight: 1.6 }}>
            Nessuna attivita trovata con i filtri attuali.
          </div>
        ) : null}
        </section>
      ) : null}
    </div>
  );
}
