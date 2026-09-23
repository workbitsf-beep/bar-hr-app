import { ActivityType, Role } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../../context";
import { createEmployeeBySuperAdminAction, removeEmployeeBySuperAdminAction, updateBarSubscriptionAction } from "../../../actions";
import { DataList, Empty, Field, FieldGrid, Figure, FigureBand, Forbidden, Note, Row, Section, Status } from "../../console-ui";
import {
  accessUnlocked,
  activityLabel,
  formatCurrency,
  formatDate,
  fullName,
  monthlyRevenue,
  planDeadline,
  planLabel,
  readParam,
  roleLabel,
  toDateInput,
} from "../../console-data";
import { OwnersFieldset, PlanFieldset } from "./edit-fieldsets";
import { DangerZone } from "./danger-zone";

const FEEDBACK: Record<string, string> = {
  "employee-created": "Persona aggiunta al locale.",
  "employee-created-email-failed": "Persona aggiunta, ma l'email di benvenuto non è partita.",
  "employee-removed": "Persona rimossa dal locale.",
  "employee-exists": "Esiste già un account con questa email.",
};

export default async function ConsoleBarPage({
  params,
  searchParams,
}: {
  params: Promise<{ barId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const { barId } = await params;
  const query = searchParams ? await searchParams : {};
  const success = readParam(query.success);
  const error = readParam(query.error);

  const [bar, owners] = await Promise.all([
    prisma.bar.findUnique({
      where: { id: barId },
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
        createdAt: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        memberships: {
          where: { isActive: true },
          orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
          select: {
            id: true,
            role: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true, mustChangePwd: true } },
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
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: Role.OWNER },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  if (!bar) {
    notFound();
  }

  const subscription = bar.subscription;
  const live = accessUnlocked(subscription);
  const revenue = monthlyRevenue(subscription);
  const additionalOwnerIds = bar.memberships
    .filter((membership) => membership.role === Role.OWNER && membership.user.id !== bar.owner.id)
    .map((membership) => membership.user.id);
  const isCompany = bar.activityType === ActivityType.COMPANY;
  const todayKey = toDateInput(new Date());

  // The owner select must always be able to show the venue's current owner,
  // even in the edge case where their account is no longer flagged OWNER.
  const ownerOptions = owners.some((owner) => owner.id === bar.owner.id) ? owners : [bar.owner, ...owners];

  return (
    <div className="wbc-page">
      <Link href="/dashboard/super-admin" className="wbc-back">
        ← Rete
      </Link>

      <div className="wbc-page-head">
        <h1 className="wbc-title">{bar.name}</h1>
        <p className="wbc-desc">
          {activityLabel(bar.activityType)}
          {bar.city ? ` · ${bar.city}` : ""} · attivo da {formatDate(bar.createdAt)}
        </p>
      </div>

      <FigureBand>
        <Figure
          label="Stato"
          value={live ? "Attivo" : "Bloccato"}
          meta={planDeadline(subscription)}
          tone={live ? "positive" : "negative"}
        />
        <Figure label="Ricavo mese" value={formatCurrency(revenue, 0)} meta={planLabel(subscription)} />
        <Figure label="Persone" value={bar.memberships.length} meta="account collegati" />
      </FigureBand>

      {success ? (
        <div style={{ marginTop: 16 }}>
          <Note tone="positive">{FEEDBACK[success] ?? "Modifiche salvate."}</Note>
        </div>
      ) : null}
      {error ? (
        <div style={{ marginTop: 16 }}>
          <Note tone="negative">{FEEDBACK[error] ?? "Operazione non riuscita."}</Note>
        </div>
      ) : null}

      <Section title="Abbonamento e titolari">
        <form action={updateBarSubscriptionAction} style={{ display: "grid", gap: 18 }}>
          <input type="hidden" name="barId" value={bar.id} />

          <OwnersFieldset
            owners={ownerOptions}
            primaryOwnerId={bar.owner.id}
            additionalOwnerIds={additionalOwnerIds}
          />

          <PlanFieldset
            planType={subscription?.planType ?? "PAID"}
            status={subscription?.status ?? "INACTIVE"}
            billingInterval={subscription?.billingInterval ?? null}
            monthlyDiscountPercent={subscription?.monthlyDiscountPercent ?? 0}
            currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
            trialEndsAt={subscription?.trialEndsAt ?? null}
            todayKey={todayKey}
          />

          <button type="submit" className="wbc-btn wbc-btn-primary">
            Salva abbonamento
          </button>
        </form>
      </Section>

      <Section title={`Persone · ${bar.memberships.length}`}>
        <form action={createEmployeeBySuperAdminAction} style={{ display: "grid", gap: 15 }}>
          <input type="hidden" name="barId" value={bar.id} />

          <FieldGrid>
            <Field label="Nome">
              <input name="firstName" required autoComplete="off" />
            </Field>
            <Field label="Cognome">
              <input name="lastName" required autoComplete="off" />
            </Field>
            <Field label="Email" span>
              <input name="email" type="email" required autoComplete="off" />
            </Field>
            <Field label="Ruolo">
              <select name="role" defaultValue="EMPLOYEE">
                <option value="EMPLOYEE">Dipendente</option>
                <option value="MANAGER">Responsabile</option>
                <option value="OWNER">Titolare aggiuntivo</option>
                {isCompany ? <option value="AMMINISTRAZIONE">Amministrazione</option> : null}
              </select>
            </Field>
            <Field label="Paga oraria" hint="Facoltativa">
              <input name="hourlyRate" type="number" step="0.01" inputMode="decimal" />
            </Field>
          </FieldGrid>

          <button type="submit" className="wbc-btn wbc-btn-ghost">
            Crea o collega account
          </button>
        </form>

        <div>
          {bar.memberships.length === 0 ? (
            <Empty>Nessun account collegato a questo locale.</Empty>
          ) : (
            bar.memberships.map((membership) => (
              <Row
                key={membership.id}
                title={fullName(membership.user)}
                meta={`${membership.user.email} · ${roleLabel(membership.role)}`}
                status={
                  membership.role === Role.OWNER ? (
                    <Status tone="neutral" label="Titolare" />
                  ) : (
                    <form action={removeEmployeeBySuperAdminAction}>
                      <input type="hidden" name="membershipId" value={membership.id} />
                      <button type="submit" className="wbc-btn wbc-btn-danger wbc-btn-sm">
                        Rimuovi
                      </button>
                    </form>
                  )
                }
              />
            ))
          )}
        </div>
      </Section>

      <Section title="Dati struttura">
        <DataList
          items={[
            { label: "Ragione sociale", value: bar.legalName ?? "—" },
            { label: "Email", value: bar.email ?? "—" },
            { label: "Telefono", value: bar.phone ?? "—" },
            { label: "Indirizzo", value: bar.addressLine1 ?? "—" },
            { label: "Città", value: [bar.city, bar.postalCode].filter(Boolean).join(" ") || "—" },
            { label: "Categoria", value: activityLabel(bar.activityType) },
            {
              label: "Stripe",
              value: subscription?.stripeSubscriptionId
                ? "Collegato"
                : subscription?.stripeCustomerId
                  ? "Solo cliente"
                  : "Non collegato",
            },
          ]}
        />
      </Section>

      <Section title="Zona pericolo">
        <DangerZone barId={bar.id} barName={bar.name} />
      </Section>
    </div>
  );
}
