"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createBarBySuperAdminAction } from "../../actions";
import {
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  StatusPill,
  TextInput,
} from "../../ui";

type OwnerOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type BarItem = {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  activityType: "RESTAURANT" | "COMPANY";
  owner: OwnerOption;
  subscription: {
    planType: "FREE" | "TRIAL" | "PAID" | "LIFETIME";
    status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE";
    billingInterval: "MONTHLY" | "YEARLY" | null;
    monthlyDiscountPercent: number;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
  } | null;
};

type ActivityFilter = "ALL" | "COMPANY" | "RESTAURANT";

function formatDateLabel(value: Date | string | null) {
  if (!value) {
    return "Nessuna data";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function getActivityLabel(activityType: BarItem["activityType"]) {
  return activityType === "COMPANY" ? "Azienda" : "Ristorazione";
}

function getSubscriptionLabel(subscription: NonNullable<BarItem["subscription"]>) {
  if (subscription.planType === "FREE") {
    return "Free";
  }

  if (subscription.planType === "LIFETIME") {
    return "Lifetime";
  }

  if (subscription.planType === "TRIAL") {
    return "Trial";
  }

  if (subscription.status === "PAST_DUE" || subscription.status === "UNPAID") {
    return "Da recuperare";
  }

  if (subscription.status === "CANCELED" || subscription.status === "INACTIVE") {
    return "Inattivo";
  }

  return "Attivo";
}

function getSubscriptionTone(subscription: NonNullable<BarItem["subscription"]>) {
  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") {
    return "success" as const;
  }

  if (subscription.planType === "TRIAL") {
    return "warning" as const;
  }

  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    return "success" as const;
  }

  if (subscription.status === "PAST_DUE" || subscription.status === "UNPAID") {
    return "danger" as const;
  }

  return "neutral" as const;
}

function getSubscriptionDetail(subscription: NonNullable<BarItem["subscription"]>) {
  if (subscription.planType === "TRIAL") {
    return `Fine trial: ${formatDateLabel(subscription.trialEndsAt)}`;
  }

  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") {
    return "Piano gestito manualmente";
  }

  return `Scadenza: ${formatDateLabel(subscription.currentPeriodEnd)}`;
}

function StatusBanner({
  kind,
  text,
}: {
  kind: "success" | "warning" | "error";
  text: string;
}) {
  const palette =
    kind === "success"
      ? { background: "#f0fdf4", border: "#bbf7d0", color: "#166534" }
      : kind === "warning"
        ? { background: "#fff7ed", border: "#fed7aa", color: "#c2410c" }
        : { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" };

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

export function BarsManager({
  bars,
  owners,
  activity,
  query,
  error,
  success,
}: {
  bars: BarItem[];
  owners: OwnerOption[];
  activity: ActivityFilter;
  query: string;
  error?: string;
  success?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const hasOwners = owners.length > 0;

  return (
    <>
      <Panel
        title="Strutture"
        action={
          <PrimaryButton type="button" onClick={() => setOpen(true)} disabled={!hasOwners}>
            +
          </PrimaryButton>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          {error ? <StatusBanner kind="error" text={error} /> : null}
          {success === "bar-created" ? (
            <StatusBanner kind="success" text="Struttura creata correttamente." />
          ) : null}

          <form method="GET" style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(180px, 240px)",
                gap: 12,
              }}
            >
              <FormField label="Cerca" hint="Cerca per nome, responsabile o citta.">
                <TextInput name="q" defaultValue={query} placeholder="Bar o titolare" />
              </FormField>

              <FormField label="Attivita" hint="Separa aziende e ristorazione.">
                <Select name="activity" defaultValue={activity}>
                  <option value="ALL">Tutte</option>
                  <option value="COMPANY">Aziende</option>
                  <option value="RESTAURANT">Ristorazione</option>
                </Select>
              </FormField>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <PrimaryButton type="submit">Cerca</PrimaryButton>
              <Link
                href="/dashboard/super-admin/bars"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  padding: "12px 16px",
                  textDecoration: "none",
                  background: "#f8fafc",
                  color: "#0f172a",
                  border: "1px solid #e2e8f0",
                  fontWeight: 700,
                }}
              >
                Reset
              </Link>
              <span style={{ color: "#64748b", fontSize: 14 }}>{bars.length} risultati</span>
            </div>
          </form>

          {bars.length > 0 ? (
            <ItemList scrollable maxHeight={540}>
              {bars.map((bar) => {
                const subscription = bar.subscription;

                return (
                  <ItemCard
                    key={bar.id}
                    title={bar.name}
                    subtitle={`${bar.owner.firstName} ${bar.owner.lastName} - ${bar.city ?? "Senza citta"}`}
                    meta={`${getActivityLabel(bar.activityType)}${bar.legalName ? ` - ${bar.legalName}` : ""}`}
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
          ) : (
            <EmptyState message="Nessuna struttura trovata con questi filtri." />
          )}
        </div>
      </Panel>

      {mounted && open
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483646,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <button
                type="button"
                aria-label="Chiudi popup nuova struttura"
                onClick={() => setOpen(false)}
                style={{
                  position: "absolute",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.28)",
                  backdropFilter: "blur(6px)",
                }}
              />

              <section
                style={{
                  position: "relative",
                  width: "min(92vw, 560px)",
                  maxHeight: "calc(100dvh - 32px)",
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 28,
                  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  padding: 22,
                  display: "grid",
                  gap: 18,
                  zIndex: 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <strong style={{ fontSize: 22, color: "#0f172a" }}>Nuova struttura</strong>

                  <button
                    type="button"
                    aria-label="Chiudi"
                    onClick={() => setOpen(false)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#0f172a",
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    X
                  </button>
                </div>

                <form action={createBarBySuperAdminAction} style={{ display: "grid", gap: 14 }}>
                  {hasOwners ? null : (
                    <StatusBanner
                      kind="warning"
                      text="Crea prima almeno un titolare per poter aggiungere una struttura."
                    />
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Nome struttura</span>
                      <TextInput name="name" required />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Email struttura</span>
                      <TextInput name="email" type="email" />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Telefono</span>
                      <TextInput name="phone" />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Indirizzo</span>
                      <TextInput name="addressLine1" />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Citta</span>
                      <TextInput name="city" />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>CAP</span>
                      <TextInput name="postalCode" />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Categoria attivita</span>
                      <Select name="activityType" defaultValue="RESTAURANT">
                        <option value="RESTAURANT">Ristorazione</option>
                        <option value="COMPANY">Azienda</option>
                      </Select>
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Responsabile</span>
                      <Select name="ownerId" required defaultValue="">
                        <option value="" disabled>
                          Seleziona responsabile
                        </option>
                        {owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.firstName} {owner.lastName}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <PrimaryButton type="button" tone="sand" onClick={() => setOpen(false)}>
                      Annulla
                    </PrimaryButton>
                    <PrimaryButton type="submit" disabled={!hasOwners}>
                      Crea struttura
                    </PrimaryButton>
                  </div>
                </form>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
