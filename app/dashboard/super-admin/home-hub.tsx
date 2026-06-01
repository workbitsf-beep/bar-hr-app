import { ActivityType, PlanType, Prisma, Role, SubscriptionStatus } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import {
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
  StatusPill,
  TextInput,
} from "../ui";
import { SuperAdminMenuGrid } from "./super-admin-ui";

type SearchParams = {
  q?: string | string[];
  activity?: string | string[];
};

type BarSubscription = {
  planType: PlanType;
  status: SubscriptionStatus;
  billingInterval: string | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
} | null;

type ActivityCount = {
  activityType: ActivityType;
  _count: {
    _all: number;
  };
};

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

  return null;
}

function formatDateLabel(value: Date | string | null) {
  if (!value) {
    return "Nessuna data";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function getActivityLabel(activityType: ActivityType) {
  return activityType === "COMPANY" ? "Azienda" : "Ristorazione";
}

function getRoleLabel(role: Role) {
  if (role === Role.OWNER) {
    return "Titolare";
  }

  if (role === Role.MANAGER) {
    return "Manager";
  }

  return "Dipendente";
}

function getSubscriptionTone(subscription: Exclude<BarSubscription, null>) {
  if (subscription.planType === PlanType.FREE || subscription.planType === PlanType.LIFETIME) {
    return "success" as const;
  }

  if (subscription.planType === PlanType.TRIAL) {
    return "warning" as const;
  }

  if (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIALING) {
    return "success" as const;
  }

  if (
    subscription.status === SubscriptionStatus.PAST_DUE ||
    subscription.status === SubscriptionStatus.UNPAID
  ) {
    return "danger" as const;
  }

  return "neutral" as const;
}

function getSubscriptionLabel(subscription: Exclude<BarSubscription, null>) {
  if (subscription.planType === PlanType.FREE) {
    return "Free";
  }

  if (subscription.planType === PlanType.LIFETIME) {
    return "Lifetime";
  }

  if (subscription.planType === PlanType.TRIAL) {
    return "Trial";
  }

  if (
    subscription.status === SubscriptionStatus.PAST_DUE ||
    subscription.status === SubscriptionStatus.UNPAID
  ) {
    return "Pagamento da recuperare";
  }

  if (
    subscription.status === SubscriptionStatus.CANCELED ||
    subscription.status === SubscriptionStatus.INACTIVE
  ) {
    return "Inattivo";
  }

  return "Attivo";
}

function getSubscriptionDetail(subscription: Exclude<BarSubscription, null>) {
  if (subscription.planType === PlanType.TRIAL) {
    return `Fine trial: ${formatDateLabel(subscription.trialEndsAt)}`;
  }

  if (subscription.planType === PlanType.FREE || subscription.planType === PlanType.LIFETIME) {
    return "Piano gestito manualmente";
  }

  return `Scadenza: ${formatDateLabel(subscription.currentPeriodEnd)}`;
}

function getCountByActivity(counts: ActivityCount[], activityType: ActivityType) {
  return counts.find((entry) => entry.activityType === activityType)?._count._all ?? 0;
}

function getBarWhere(query: string, activityFilter: ActivityType | null): Prisma.BarWhereInput {
  const conditions: Prisma.BarWhereInput[] = [];

  if (activityFilter) {
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

function getOwnerWhere(query: string, activityFilter: ActivityType | null): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [{ role: Role.OWNER }];

  if (activityFilter) {
    conditions.push({
      ownedBars: {
        some: {
          activityType: activityFilter,
        },
      },
    });
  }

  if (query) {
    conditions.push({
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        {
          ownedBars: {
            some: {
              name: { contains: query, mode: "insensitive" },
            },
          },
        },
        {
          ownedBars: {
            some: {
              legalName: { contains: query, mode: "insensitive" },
            },
          },
        },
        {
          ownedBars: {
            some: {
              city: { contains: query, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  return { AND: conditions };
}

function getStaffWhere(query: string, activityFilter: ActivityType | null): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [
    {
      role: {
        in: [Role.MANAGER, Role.EMPLOYEE],
      },
    },
  ];

  if (activityFilter) {
    conditions.push({
      barMemberships: {
        some: {
          isActive: true,
          bar: {
            is: {
              activityType: activityFilter,
            },
          },
        },
      },
    });
  }

  if (query) {
    conditions.push({
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        {
          barMemberships: {
            some: {
              bar: {
                is: {
                  name: { contains: query, mode: "insensitive" },
                },
              },
            },
          },
        },
        {
          barMemberships: {
            some: {
              bar: {
                is: {
                  city: { contains: query, mode: "insensitive" },
                },
              },
            },
          },
        },
      ],
    });
  }

  return { AND: conditions };
}

function StatCard({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div
      style={{
        borderRadius: 24,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: 18,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
        display: "grid",
        gap: 8,
        minWidth: 0,
      }}
    >
      <strong style={{ fontSize: 28, lineHeight: 1, color: "#0f172a" }}>{value}</strong>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{detail}</span>
    </div>
  );
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const palette = {
    neutral: { background: "#e2e8f0", color: "#475569", border: "#cbd5e1" },
    success: { background: "#dcfce7", color: "#166534", border: "#bbf7d0" },
    warning: { background: "#fef3c7", color: "#92400e", border: "#fde68a" },
    danger: { background: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  } as const;

  const colors = palette[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700,
        background: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {children}
    </span>
  );
}

export async function SuperAdminHomeHub({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const query = normalizeParam(searchParams?.q).trim();
  const activityFilter = parseActivityFilter(normalizeParam(searchParams?.activity));

  const [activityCounts, activeBillingCount, ownerCount, staffCount, bars, owners, staff] =
    await Promise.all([
      prisma.bar.groupBy({
        by: ["activityType"],
        _count: {
          _all: true,
        },
      }),
      prisma.subscription.count({
        where: {
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
          },
        },
      }),
      prisma.user.count({
        where: {
          role: Role.OWNER,
        },
      }),
      prisma.user.count({
        where: {
          role: {
            in: [Role.MANAGER, Role.EMPLOYEE],
          },
        },
      }),
      prisma.bar.findMany({
        where: getBarWhere(query, activityFilter),
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          name: true,
          legalName: true,
          email: true,
          city: true,
          activityType: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          subscription: {
            select: {
              planType: true,
              status: true,
              billingInterval: true,
              currentPeriodEnd: true,
              trialEndsAt: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        where: getOwnerWhere(query, activityFilter),
        orderBy: [
          {
            firstName: "asc",
          },
          {
            lastName: "asc",
          },
        ],
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          ownedBars: {
            ...(activityFilter
              ? {
                  where: {
                    activityType: activityFilter,
                  },
                }
              : {}),
            orderBy: {
              createdAt: "desc",
            },
            take: 3,
            select: {
              id: true,
              name: true,
              activityType: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        where: getStaffWhere(query, activityFilter),
        orderBy: [
          {
            firstName: "asc",
          },
          {
            lastName: "asc",
          },
        ],
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          barMemberships: {
            where: {
              isActive: true,
              ...(activityFilter
                ? {
                    bar: {
                      is: {
                        activityType: activityFilter,
                      },
                    },
                  }
                : {}),
            },
            orderBy: {
              hiredAt: "desc",
            },
            take: 3,
            select: {
              role: true,
              bar: {
                select: {
                  id: true,
                  name: true,
                  activityType: true,
                },
              },
            },
          },
        },
      }),
    ]);

  const companyCount = getCountByActivity(activityCounts, ActivityType.COMPANY);
  const restaurantCount = getCountByActivity(activityCounts, ActivityType.RESTAURANT);
  const totalBars = companyCount + restaurantCount;
  const totalUsers = ownerCount + staffCount;

  const barsTitle =
    activityFilter === "COMPANY"
      ? "Aziende"
      : activityFilter === "RESTAURANT"
        ? "Ristorazione"
        : "Strutture";

  const activeFilterLabel =
    activityFilter === "COMPANY"
      ? "Solo aziende"
      : activityFilter === "RESTAURANT"
        ? "Solo ristorazione"
        : "Tutte le attivita";

  return (
    <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
      <Stack columns="repeat(auto-fit, minmax(220px, 1fr))">
        <StatCard value={String(totalBars)} label="Strutture" detail="Tutto il parco attivita" />
        <StatCard value={String(companyCount)} label="Aziende" detail="Sezione separata" />
        <StatCard value={String(restaurantCount)} label="Ristorazione" detail="Sezione separata" />
        <StatCard value={String(totalUsers)} label="Utenti" detail={`${ownerCount} titolari · ${staffCount} staff`} />
        <StatCard value={String(activeBillingCount)} label="Abbonamenti attivi" detail="Clienti sbloccati" />
      </Stack>

      <Panel title="Azioni rapide" action="Crea e gestisci">
        <SuperAdminMenuGrid />
      </Panel>

      <Panel
        title="Ricerca rapida"
        action={
          <Link
            href="/dashboard/super-admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              padding: "10px 14px",
              textDecoration: "none",
              background: "#f8fafc",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              fontWeight: 700,
            }}
          >
            Azzera filtri
          </Link>
        }
      >
        <form method="GET" style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 280px)",
              gap: 12,
            }}
          >
            <FormField label="Cerca" hint="Cerca per nome, email, citta o locale associato.">
              <TextInput
                name="q"
                defaultValue={query}
                placeholder="Bar, titolare o utente"
              />
            </FormField>

            <FormField label="Attivita" hint="Separa aziende e ristorazione.">
              <Select name="activity" defaultValue={activityFilter ?? "ALL"}>
                <option value="ALL">Tutte</option>
                <option value="COMPANY">Aziende</option>
                <option value="RESTAURANT">Ristorazione</option>
              </Select>
            </FormField>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <PrimaryButton type="submit">Cerca</PrimaryButton>
            <span style={{ color: "#64748b", fontSize: 14 }}>Filtro attivo: {activeFilterLabel}</span>
          </div>
        </form>
      </Panel>

      <Stack columns="minmax(0, 1.1fr) minmax(0, 0.9fr)">
        <Panel
          title={barsTitle}
          action={
            <Link
              href="/dashboard/super-admin/bars"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                padding: "10px 14px",
                textDecoration: "none",
                background: "#0f172a",
                color: "#ffffff",
                fontWeight: 700,
              }}
            >
              Nuova attivita
            </Link>
          }
        >
          {bars.length === 0 ? (
            <EmptyState message="Nessuna attivita trovata con questi filtri." />
          ) : (
            <ItemList scrollable maxHeight={460}>
              {bars.map((bar) => {
                const subscription = bar.subscription;

                return (
                  <ItemCard
                    key={bar.id}
                    title={bar.name}
                    subtitle={`${bar.owner.firstName} ${bar.owner.lastName} · ${bar.city ?? "Senza citta"}`}
                    meta={`${getActivityLabel(bar.activityType)}${bar.legalName ? ` · ${bar.legalName}` : ""}`}
                    footer={
                      subscription ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <StatusPill
                            label={getSubscriptionLabel(subscription)}
                            tone={getSubscriptionTone(subscription)}
                          />
                          <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                            {getSubscriptionDetail(subscription)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: 13 }}>Nessun abbonamento collegato</span>
                      )
                    }
                  />
                );
              })}
            </ItemList>
          )}
        </Panel>

        <Panel
          title="Utenti"
          action={
            <Link
              href="/dashboard/super-admin/owners"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                padding: "10px 14px",
                textDecoration: "none",
                background: "#0f172a",
                color: "#ffffff",
                fontWeight: 700,
              }}
            >
              Nuovo titolare
            </Link>
          }
        >
          <div style={{ display: "grid", gap: 18 }}>
            <section style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>Titolari</strong>
                <span style={{ color: "#64748b", fontSize: 13 }}>{owners.length} risultati</span>
              </div>

              {owners.length === 0 ? (
                <EmptyState message="Nessun titolare trovato con questi filtri." />
              ) : (
                <ItemList scrollable maxHeight={230}>
                  {owners.map((owner) => (
                    <ItemCard
                      key={owner.id}
                      title={`${owner.firstName} ${owner.lastName}`}
                      subtitle={owner.email}
                      meta={`Attivita collegate: ${owner.ownedBars.length}`}
                      footer={
                        owner.ownedBars.length > 0 ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {owner.ownedBars.map((bar) => (
                              <Tag key={bar.id}>
                                {getActivityLabel(bar.activityType)} · {bar.name}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: 13 }}>Nessuna attivita collegata</span>
                        )
                      }
                    />
                  ))}
                </ItemList>
              )}
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>Staff</strong>
                <span style={{ color: "#64748b", fontSize: 13 }}>{staff.length} risultati</span>
              </div>

              {staff.length === 0 ? (
                <EmptyState message="Nessun membro staff trovato con questi filtri." />
              ) : (
                <ItemList scrollable maxHeight={230}>
                  {staff.map((member) => (
                    <ItemCard
                      key={member.id}
                      title={`${member.firstName} ${member.lastName}`}
                      subtitle={member.email}
                      meta={getRoleLabel(member.role)}
                      footer={
                        member.barMemberships.length > 0 ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {member.barMemberships.map((membership) => (
                              <Tag key={`${member.id}-${membership.bar.id}`}>
                                {getActivityLabel(membership.bar.activityType)} · {membership.bar.name}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: 13 }}>Nessun locale attivo</span>
                        )
                      }
                    />
                  ))}
                </ItemList>
              )}
            </section>
          </div>
        </Panel>
      </Stack>
    </div>
  );
}
