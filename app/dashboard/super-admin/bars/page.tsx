import { ActivityType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";
import { StatusBanner, StatusPill } from "../light-ui";
import { BarsModalsController } from "./bars-modals-controller";
import {
  getActivityLabel,
  getAdditionalOwnersForBar,
  getOwnerSummaryLabel,
  getRevenueSummary,
  getSubscriptionDetail,
  getSubscriptionLabel,
  getSubscriptionTone,
} from "./bars-helpers";

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseActivityFilter(value: string) {
  if (value === "COMPANY" || value === "RESTAURANT") {
    return value;
  }

  return "ALL";
}

function getBarWhere(query: string, activityFilter: "ALL" | ActivityType): Prisma.BarWhereInput {
  const conditions: Prisma.BarWhereInput[] = [];

  if (activityFilter !== "ALL") {
    conditions.push({ activityType: activityFilter });
  }

  if (query) {
    conditions.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { legalName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { owner: { is: { firstName: { contains: query, mode: "insensitive" } } } },
        { owner: { is: { lastName: { contains: query, mode: "insensitive" } } } },
        { owner: { is: { email: { contains: query, mode: "insensitive" } } } },
      ],
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

export default async function SuperAdminBarsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const pageStartedAt = Date.now();
  const params = searchParams ? await searchParams : {};
  const query = normalizeParam(params.q).trim();
  const activity = parseActivityFilter(normalizeParam(params.activity));
  const error = normalizeParam(params.error);
  const success = normalizeParam(params.success);
  const openBarId = normalizeParam(params.open) || null;
  const showCreate = normalizeParam(params.new) === "1";
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const [owners, bars] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: Role.OWNER,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
    prisma.bar.findMany({
      where: getBarWhere(query, activity),
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
      select: {
        id: true,
        name: true,
        legalName: true,
        email: true,
        phone: true,
        addressLine1: true,
        city: true,
        postalCode: true,
        activityType: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        memberships: {
          where: {
            isActive: true,
            role: Role.OWNER,
          },
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        subscription: {
          select: {
            planType: true,
            status: true,
            billingInterval: true,
            monthlyDiscountPercent: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripePriceId: true,
          },
        },
      },
    }),
  ]);

  const hasOwners = owners.length > 0;
  const baseQuery = `activity=${activity}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  const closeHref = `/dashboard/super-admin/bars?${baseQuery}`;
  const serverMs = Date.now() - pageStartedAt;

  return (
    <SuperAdminFrame
      title="Attività"
      description={`Aziende e ristorazione con creazione e ricerca rapide. (Generata lato server in ${serverMs} ms)`}
      section="bars"
    >
      <div style={{ display: "grid", gap: 16 }}>
        {error ? <StatusBanner kind="error" text={error} /> : null}
        {success === "bar-created" ? <StatusBanner kind="success" text="Struttura creata correttamente." /> : null}

        <form method="GET" className="sa-search">
          <span className="sa-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input name="q" type="search" defaultValue={query} placeholder="Nome, titolare o città" />
          <input type="hidden" name="activity" value={activity} />
        </form>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["ALL", "RESTAURANT", "COMPANY"] as const).map((value) => (
            <a
              key={value}
              href={`/dashboard/super-admin/bars?activity=${value}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className="sa-badge"
              style={{
                textDecoration: "none",
                background: activity === value ? "#7b2ff7" : "#f4f2fe",
                color: activity === value ? "#ffffff" : "#5b21b6",
              }}
            >
              {value === "ALL" ? "Tutte" : value === "COMPANY" ? "Aziende" : "Ristorazione"}
            </a>
          ))}
        </div>

        <div className="sa-row-head">
          <span className="sa-section-title">Attività · {bars.length}</span>
          {hasOwners ? (
            <a href={`${closeHref}&new=1`} className="sa-pill-btn" style={{ textDecoration: "none" }}>
              + Nuova
            </a>
          ) : (
            <span className="sa-pill-btn" aria-disabled="true" style={{ opacity: 0.5 }}>
              + Nuova
            </span>
          )}
        </div>

        {bars.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {bars.map((bar) => {
              const subscription = bar.subscription;
              const revenue = getRevenueSummary(subscription);
              const additionalOwners = getAdditionalOwnersForBar(bar);
              const ownerSummary = getOwnerSummaryLabel(bar.owner, additionalOwners);

              return (
                <a
                  key={bar.id}
                  href={`${closeHref}&open=${bar.id}`}
                  className="sa-card"
                  style={{
                    border: "1px solid var(--workbit-border)",
                    textAlign: "left",
                    cursor: "pointer",
                    width: "100%",
                    display: "grid",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <strong style={{ fontSize: 14.5 }}>{bar.name}</strong>
                  <span style={{ fontSize: 12.5, color: "#64748b" }}>
                    {ownerSummary} · {bar.city ?? "Senza città"}
                  </span>
                  <span style={{ fontSize: 11.5, color: "#98a2b3" }}>
                    {getActivityLabel(bar.activityType)}{bar.legalName ? ` · ${bar.legalName}` : ""}
                  </span>

                  {subscription ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                      <StatusPill label={getSubscriptionLabel(subscription)} tone={getSubscriptionTone(subscription)} />
                      <span style={{ color: "#64748b", fontSize: 12.5 }}>{getSubscriptionDetail(subscription)}</span>
                    </div>
                  ) : (
                    <span style={{ color: "#98a2b3", fontSize: 12.5, marginTop: 4 }}>Nessun abbonamento collegato</span>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gap: 2,
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      marginTop: 6,
                    }}
                  >
                    <span style={{ color: "#64748b", fontSize: 11.5, fontWeight: 700 }}>{revenue.title}</span>
                    <strong style={{ color: "#0f172a", fontSize: 13.5 }}>{revenue.value}</strong>
                    <span style={{ color: "#64748b", fontSize: 11.5 }}>{revenue.detail}</span>
                  </div>

                  <span style={{ color: "#7b2ff7", fontSize: 12.5, fontWeight: 800, textAlign: "right", marginTop: 4 }}>
                    Apri dettagli →
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "#64748b", fontSize: 14 }}>Nessuna struttura trovata con questi filtri.</div>
        )}
      </div>

      <BarsModalsController
        bars={bars}
        owners={owners}
        openBarId={openBarId}
        showCreate={showCreate}
        closeHref={closeHref}
      />
    </SuperAdminFrame>
  );
}
