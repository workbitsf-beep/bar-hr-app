import {
  BillingInterval,
  PlanType,
  Role,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BrandLogo } from "@/components/brand-logo";
import {
  createBarBySuperAdminAction,
  createOwnerBySuperAdminAction,
} from "../actions";
import { getDashboardContext } from "../context";
import {
  EmptyState,
  FormField,
  Panel,
  PrimaryButton,
  Select,
  Stack,
  TextInput,
} from "../ui";
import { BarGroupsClient } from "./bar-groups-client";

type BarAdminItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  subscription: {
    planType: PlanType;
    status: SubscriptionStatus;
    billingInterval: BillingInterval | null;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    stripePriceId: string | null;
  } | null;
};

export default async function SuperAdminPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return (
      <Panel title="Super Admin">
        <EmptyState message="Questa area e riservata al super admin." />
      </Panel>
    );
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
      orderBy: {
        createdAt: "desc",
      },
      include: {
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
            stripeSubscriptionId: true,
            stripeCustomerId: true,
            stripePriceId: true,
          },
        },
      },
    }),
  ]);

  const adminBars = bars as BarAdminItem[];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section
        style={{
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          borderRadius: 28,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.07)",
          padding: 22,
          display: "grid",
          gap: 12,
        }}
      >
        <BrandLogo size={44} showSecondaryLabel style={{ gap: 12 }} />
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ color: "#0f172a", fontSize: 20 }}>Console Super Admin</strong>
          <span style={{ color: "#64748b", lineHeight: 1.6 }}>
            Gestisci titolari, locali e pagamenti da un unico spazio Workbit.
          </span>
        </div>
      </section>

      <Stack columns="repeat(auto-fit, minmax(340px, 1fr))">
        <Panel title="Crea titolare">
        <form action={createOwnerBySuperAdminAction} style={{ display: "grid", gap: 16 }}>
          <div
            className="dashboard-inline-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <FormField label="Nome">
              <TextInput name="firstName" required />
            </FormField>

            <FormField label="Cognome">
              <TextInput name="lastName" required />
            </FormField>

            <FormField label="Email">
              <TextInput name="email" type="email" required />
            </FormField>

            <FormField label="Password iniziale">
              <TextInput name="password" type="text" required />
            </FormField>

            <FormField label="Lingua">
              <Select name="language" defaultValue="it">
                <option value="it">Italiano</option>
                <option value="en">English</option>
                <option value="es">Espanol</option>
                <option value="fr">Francais</option>
              </Select>
            </FormField>
          </div>

          <div className="dashboard-form-actions">
            <PrimaryButton type="submit">Crea titolare</PrimaryButton>
          </div>
        </form>
      </Panel>

      <Panel title="Crea bar">
        {owners.length === 0 ? (
          <EmptyState message="Crea prima almeno un titolare da associare al nuovo bar." />
        ) : (
          <form action={createBarBySuperAdminAction} style={{ display: "grid", gap: 16 }}>
            <div
              className="dashboard-inline-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Nome bar">
                <TextInput name="name" required />
              </FormField>

              <FormField label="Email locale">
                <TextInput name="email" type="email" />
              </FormField>

              <FormField label="Telefono">
                <TextInput name="phone" />
              </FormField>

              <FormField label="Indirizzo">
                <TextInput name="addressLine1" />
              </FormField>

              <FormField label="Citta">
                <TextInput name="city" />
              </FormField>

              <FormField label="CAP">
                <TextInput name="postalCode" />
              </FormField>

              <FormField label="Titolare">
                <Select name="ownerId" required defaultValue="">
                  <option value="" disabled>
                    Seleziona titolare
                  </option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.firstName} {owner.lastName}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="dashboard-form-actions">
              <PrimaryButton type="submit">Crea bar</PrimaryButton>
            </div>
          </form>
        )}
      </Panel>

      <Panel title="Pagamenti" action={`${adminBars.length} bar`}>
        {adminBars.length === 0 ? (
          <EmptyState message="Nessun bar creato al momento." />
        ) : (
          <BarGroupsClient
            owners={owners.map((owner) => ({
              id: owner.id,
              firstName: owner.firstName,
              lastName: owner.lastName,
              email: owner.email,
            }))}
            bars={adminBars.map((bar) => ({
              id: bar.id,
              name: bar.name,
              email: bar.email,
              phone: bar.phone,
              addressLine1: bar.addressLine1,
              city: bar.city,
              postalCode: bar.postalCode,
              owner: {
                id: bar.owner.id,
                firstName: bar.owner.firstName,
                lastName: bar.owner.lastName,
                email: bar.owner.email,
              },
              subscription: {
                planType: bar.subscription?.planType ?? PlanType.PAID,
                status: bar.subscription?.status ?? SubscriptionStatus.INACTIVE,
                billingInterval: bar.subscription?.billingInterval ?? null,
                currentPeriodEnd: bar.subscription?.currentPeriodEnd?.toISOString() ?? null,
                trialEndsAt: bar.subscription?.trialEndsAt?.toISOString() ?? null,
                stripeSubscriptionId: bar.subscription?.stripeSubscriptionId ?? null,
                stripeCustomerId: bar.subscription?.stripeCustomerId ?? null,
                stripePriceId: bar.subscription?.stripePriceId ?? null,
              },
            }))}
          />
        )}
      </Panel>
      </Stack>
    </div>
  );
}
