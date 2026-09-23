import { ActivityType, Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { Empty, Figure, FigureBand, Forbidden, Note, Row, Section, Status } from "./console-ui";
import {
  accessUnlocked,
  activityLabel,
  formatCurrency,
  fullName,
  monthlyRevenue,
  planLabel,
  planTone,
  readParam,
} from "./console-data";

const SUBSCRIPTION_FIELDS = {
  planType: true,
  status: true,
  billingInterval: true,
  monthlyDiscountPercent: true,
  currentPeriodEnd: true,
  trialEndsAt: true,
} as const;

function buildWhere(query: string, activity: "ALL" | ActivityType): Prisma.BarWhereInput {
  const conditions: Prisma.BarWhereInput[] = [];

  if (activity !== "ALL") {
    conditions.push({ activityType: activity });
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

export default async function ConsoleNetworkPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const params = searchParams ? await searchParams : {};
  const query = readParam(params.q).trim();
  const rawActivity = readParam(params.activity);
  const activity: "ALL" | ActivityType =
    rawActivity === "COMPANY" ? ActivityType.COMPANY : rawActivity === "RESTAURANT" ? ActivityType.RESTAURANT : "ALL";

  const [byActivity, subscriptions, bars] = await Promise.all([
    prisma.bar.groupBy({ by: ["activityType"], _count: { _all: true } }),
    prisma.subscription.findMany({ select: SUBSCRIPTION_FIELDS }),
    prisma.bar.findMany({
      where: buildWhere(query, activity),
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        name: true,
        city: true,
        activityType: true,
        owner: { select: { firstName: true, lastName: true } },
        subscription: { select: SUBSCRIPTION_FIELDS },
      },
    }),
  ]);

  const restaurants = byActivity.find((group) => group.activityType === ActivityType.RESTAURANT)?._count._all ?? 0;
  const companies = byActivity.find((group) => group.activityType === ActivityType.COMPANY)?._count._all ?? 0;
  const totalBars = restaurants + companies;

  const liveCount = subscriptions.filter((subscription) => accessUnlocked(subscription)).length;
  const mrr = subscriptions.reduce((sum, subscription) => sum + monthlyRevenue(subscription), 0);
  const troubled = subscriptions.filter(
    (subscription) => subscription.status === "PAST_DUE" || subscription.status === "UNPAID"
  ).length;

  const filterHref = (value: "ALL" | "RESTAURANT" | "COMPANY") =>
    `/dashboard/super-admin?activity=${value}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Rete</h1>
        <p className="wbc-desc">Tutti i locali e le aziende collegate a Workbit, con il loro stato di attivazione.</p>
      </div>

      <FigureBand>
        <Figure
          label="Locali"
          value={totalBars}
          meta={`${restaurants} ristorazione · ${companies} aziende`}
        />
        <Figure
          label="Operativi"
          value={liveCount}
          meta={totalBars > 0 ? `su ${totalBars} totali` : "nessun locale"}
          tone={liveCount > 0 ? "positive" : "neutral"}
        />
        <Figure label="Ricavo mese" value={formatCurrency(mrr, 0)} meta="stima da piani attivi" />
      </FigureBand>

      {troubled > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Note tone="negative">
            {troubled === 1 ? "Un abbonamento è" : `${troubled} abbonamenti sono`} da recuperare.{" "}
            <Link href="/dashboard/super-admin/money?status=TROUBLE" style={{ color: "inherit", fontWeight: 700 }}>
              Vedi in Denaro →
            </Link>
          </Note>
        </div>
      ) : null}

      <Section
        title="Locali"
        action={
          <Link href="/dashboard/super-admin/new" className="wbc-btn wbc-btn-primary wbc-btn-sm">
            Nuovo locale
          </Link>
        }
      >
        <form method="GET" className="wbc-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input type="search" name="q" defaultValue={query} placeholder="Cerca nome, titolare o città" />
          <input type="hidden" name="activity" value={activity} />
        </form>

        <div className="wbc-chips">
          <Link href={filterHref("ALL")} className="wbc-chip" data-on={activity === "ALL" ? "1" : "0"}>
            Tutti
          </Link>
          <Link href={filterHref("RESTAURANT")} className="wbc-chip" data-on={activity === "RESTAURANT" ? "1" : "0"}>
            Ristorazione
          </Link>
          <Link href={filterHref("COMPANY")} className="wbc-chip" data-on={activity === "COMPANY" ? "1" : "0"}>
            Aziende
          </Link>
        </div>

        <div>
          {bars.length === 0 ? (
            <Empty>Nessun locale corrisponde a questa ricerca.</Empty>
          ) : (
            bars.map((bar) => {
              const revenue = monthlyRevenue(bar.subscription);

              return (
                <Row
                  key={bar.id}
                  href={`/dashboard/super-admin/bar/${bar.id}`}
                  title={bar.name}
                  meta={`${fullName(bar.owner)} · ${bar.city ?? activityLabel(bar.activityType)}`}
                  status={<Status tone={planTone(bar.subscription)} label={planLabel(bar.subscription)} />}
                  valueMeta={revenue > 0 ? `${formatCurrency(revenue)}/mese` : undefined}
                />
              );
            })
          )}
        </div>
      </Section>
    </div>
  );
}
