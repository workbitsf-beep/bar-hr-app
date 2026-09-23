import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { Distribution, Empty, Figure, FigureBand, Forbidden, Row, Section, Status } from "../console-ui";
import {
  annualRevenue,
  formatCurrency,
  fullName,
  monthlyRevenue,
  planDeadline,
  planLabel,
  planTone,
  readParam,
  type SubscriptionShape,
} from "../console-data";

type Bucket = "ALL" | "PAYING" | "TRIAL" | "TROUBLE" | "FREE" | "OFF";

const BUCKETS: Array<{ value: Bucket; label: string }> = [
  { value: "ALL", label: "Tutti" },
  { value: "PAYING", label: "Paganti" },
  { value: "TRIAL", label: "In prova" },
  { value: "TROUBLE", label: "Da recuperare" },
  { value: "FREE", label: "Gratuiti" },
  { value: "OFF", label: "Inattivi" },
];

function bucketOf(subscription: NonNullable<SubscriptionShape>): Exclude<Bucket, "ALL"> {
  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") return "FREE";
  if (subscription.planType === "TRIAL") return "TRIAL";
  if (subscription.status === "PAST_DUE" || subscription.status === "UNPAID") return "TROUBLE";
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") return "PAYING";

  return "OFF";
}

export default async function ConsoleMoneyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const params = searchParams ? await searchParams : {};
  const requested = readParam(params.status).toUpperCase();
  const active: Bucket = BUCKETS.some((bucket) => bucket.value === requested) ? (requested as Bucket) : "ALL";

  const subscriptions = await prisma.subscription.findMany({
    orderBy: [{ status: "asc" }, { currentPeriodEnd: "asc" }],
    select: {
      id: true,
      planType: true,
      status: true,
      billingInterval: true,
      monthlyDiscountPercent: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      bar: { select: { id: true, name: true, owner: { select: { firstName: true, lastName: true } } } },
    },
  });

  const mrr = subscriptions.reduce((sum, subscription) => sum + monthlyRevenue(subscription), 0);
  const arr = subscriptions.reduce((sum, subscription) => sum + annualRevenue(subscription), 0);

  const counts = subscriptions.reduce<Record<string, number>>((acc, subscription) => {
    const bucket = bucketOf(subscription);
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {});

  const visible =
    active === "ALL" ? subscriptions : subscriptions.filter((subscription) => bucketOf(subscription) === active);

  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Denaro</h1>
        <p className="wbc-desc">Stato degli abbonamenti e ricavo stimato dell&apos;intera rete.</p>
      </div>

      <FigureBand>
        <Figure label="Al mese" value={formatCurrency(mrr, 0)} meta="ricorrente stimato" tone="positive" />
        <Figure label="All'anno" value={formatCurrency(arr, 0)} meta="proiezione a 12 mesi" />
        <Figure label="Paganti" value={counts.PAYING ?? 0} meta={`su ${subscriptions.length} abbonamenti`} />
      </FigureBand>

      <Section title="Composizione">
        <Distribution
          segments={[
            { label: "Paganti", value: counts.PAYING ?? 0, tone: "positive" },
            { label: "In prova", value: counts.TRIAL ?? 0, tone: "warning" },
            { label: "Da recuperare", value: counts.TROUBLE ?? 0, tone: "negative" },
            { label: "Gratuiti", value: counts.FREE ?? 0, tone: "neutral" },
            { label: "Inattivi", value: counts.OFF ?? 0, tone: "neutral" },
          ]}
        />
      </Section>

      <Section title={`Abbonamenti · ${visible.length}`}>
        <div className="wbc-chips">
          {BUCKETS.map((bucket) => (
            <Link
              key={bucket.value}
              href={`/dashboard/super-admin/money?status=${bucket.value}`}
              className="wbc-chip"
              data-on={active === bucket.value ? "1" : "0"}
            >
              {bucket.label}
            </Link>
          ))}
        </div>

        <div>
          {visible.length === 0 ? (
            <Empty>Nessun abbonamento in questa categoria.</Empty>
          ) : (
            visible.map((subscription) => {
              const revenue = monthlyRevenue(subscription);

              return (
                <Row
                  key={subscription.id}
                  href={`/dashboard/super-admin/bar/${subscription.bar.id}`}
                  title={subscription.bar.name}
                  meta={`${fullName(subscription.bar.owner)} · ${planDeadline(subscription)}`}
                  status={<Status tone={planTone(subscription)} label={planLabel(subscription)} />}
                  valueMeta={revenue > 0 ? `${formatCurrency(revenue)}/mese` : "—"}
                />
              );
            })
          )}
        </div>
      </Section>
    </div>
  );
}
