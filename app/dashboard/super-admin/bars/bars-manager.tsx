"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatDateInTimeZone, toDateInputValueInTimeZone } from "@/lib/time-zone";
import {
  createBarBySuperAdminAction,
  deleteBarBySuperAdminAction,
  updateBarSubscriptionAction,
} from "../../actions";
import {
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  StatusPill,
  SuccessCallout,
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
  memberships: {
    user: OwnerOption;
  }[];
  subscription: {
    planType: "FREE" | "TRIAL" | "PAID" | "LIFETIME";
    status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE";
    billingInterval: "MONTHLY" | "YEARLY" | null;
    monthlyDiscountPercent: number;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
  } | null;
};

type ActivityFilter = "ALL" | "COMPANY" | "RESTAURANT";

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

function formatDateLabel(value: Date | string | null) {
  if (!value) {
    return "Nessuna data";
  }

  return formatDateInTimeZone(value);
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
    return "In prova";
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
    return `Fine prova: ${formatDateLabel(subscription.trialEndsAt)}`;
  }

  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") {
    return "Piano gestito manualmente";
  }

  return `Scadenza: ${formatDateLabel(subscription.currentPeriodEnd)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function getDiscountMultiplier(discountPercent: number) {
  const normalizedDiscount = Math.max(0, Math.min(100, discountPercent));
  return 1 - normalizedDiscount / 100;
}

function isRevenueEligible(subscription: NonNullable<BarItem["subscription"]>) {
  return subscription.planType === "PAID" && (subscription.status === "ACTIVE" || subscription.status === "TRIALING");
}

function getEstimatedMonthlyRevenue(subscription: NonNullable<BarItem["subscription"]>) {
  if (!isRevenueEligible(subscription)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(subscription.monthlyDiscountPercent ?? 0);

  if (subscription.billingInterval === "YEARLY") {
    return (YEARLY_PRICE * multiplier) / 12;
  }

  return MONTHLY_PRICE * multiplier;
}

function getEstimatedAnnualRevenue(subscription: NonNullable<BarItem["subscription"]>) {
  if (!isRevenueEligible(subscription)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(subscription.monthlyDiscountPercent ?? 0);

  if (subscription.billingInterval === "YEARLY") {
    return YEARLY_PRICE * multiplier;
  }

  return MONTHLY_PRICE * 12 * multiplier;
}

function getRevenueSummary(subscription: BarItem["subscription"]) {
  if (!subscription) {
    return {
      title: "Ricavo",
      value: "Nessun piano collegato",
      detail: "Aggiungi un abbonamento per vedere il valore economico.",
    };
  }

  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") {
    return {
      title: "Ricavo",
      value: "Gestione manuale",
      detail: "Il piano non genera un canone automatico.",
    };
  }

  const monthlyRevenue = getEstimatedMonthlyRevenue(subscription);
  const annualRevenue = getEstimatedAnnualRevenue(subscription);

  return {
    title: subscription.planType === "TRIAL" ? "Ricavo potenziale" : "Ricavo stimato",
    value: `${formatCurrency(monthlyRevenue)}/mese`,
    detail: `${formatCurrency(annualRevenue)}/anno`,
  };
}

function getAdditionalOwnersForBar(bar: Pick<BarItem, "owner" | "memberships">) {
  return bar.memberships
    .map((membership) => membership.user)
    .filter((owner) => owner.id !== bar.owner.id);
}

function getOwnerSummaryLabel(primary: OwnerOption, additionalOwners: OwnerOption[]) {
  if (additionalOwners.length === 0) {
    return `${primary.firstName} ${primary.lastName}`;
  }

  return `${primary.firstName} ${primary.lastName} + ${additionalOwners.length} titolari`;
}

function formatDateInput(value: Date | string | null) {
  if (!value) {
    return "";
  }

  return toDateInputValueInTimeZone(value);
}

function getDefaultStatus(planType: "FREE" | "TRIAL" | "PAID" | "LIFETIME") {
  if (planType === "TRIAL") {
    return "TRIALING" as const;
  }

  if (planType === "FREE" || planType === "LIFETIME") {
    return "ACTIVE" as const;
  }

  return "INACTIVE" as const;
}

function StatusBanner({
  kind,
  text,
}: {
  kind: "success" | "warning" | "error";
  text: string;
}) {
  if (kind === "success") {
    return <SuccessCallout style={{ fontSize: 14 }}>{text}</SuccessCallout>;
  }

  const palette =
    kind === "warning"
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
  const router = useRouter();
  const todayKey = toDateInputValueInTimeZone(new Date());
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [planType, setPlanType] = useState<"FREE" | "TRIAL" | "PAID" | "LIFETIME">("PAID");
  const [status, setStatus] = useState<
    "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE"
  >("INACTIVE");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY" | "">("");
  const [monthlyDiscountPercent, setMonthlyDiscountPercent] = useState("0");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [additionalOwnerIds, setAdditionalOwnerIds] = useState<string[]>([]);
  const [newAdditionalOwnerIds, setNewAdditionalOwnerIds] = useState<string[]>([]);
  const [additionalOwnerDraftId, setAdditionalOwnerDraftId] = useState("");
  const [newAdditionalOwnerDraftId, setNewAdditionalOwnerDraftId] = useState("");
  const nowMs = useMemo(() => Date.now(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setNewOwnerId("");
    setNewAdditionalOwnerIds([]);
    setNewAdditionalOwnerDraftId("");

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const selectedBar = useMemo(() => bars.find((bar) => bar.id === selectedBarId) ?? null, [bars, selectedBarId]);
  const selectedSubscription = useMemo(
    () =>
      selectedBar?.subscription ?? {
        planType: "PAID" as const,
        status: "INACTIVE" as const,
        billingInterval: null,
        monthlyDiscountPercent: 0,
        currentPeriodEnd: null,
        trialEndsAt: null,
      },
    [selectedBar]
  );
  const selectedAccessUnlocked =
    selectedSubscription.planType === "FREE" ||
    selectedSubscription.planType === "LIFETIME" ||
    (selectedSubscription.planType === "TRIAL" &&
      selectedSubscription.trialEndsAt &&
      new Date(selectedSubscription.trialEndsAt).getTime() > nowMs) ||
    (selectedSubscription.planType === "PAID" &&
      (selectedSubscription.status === "ACTIVE" ||
        selectedSubscription.status === "TRIALING"));

  useEffect(() => {
    if (!selectedBar) {
      return;
    }

    setOwnerId(selectedBar.owner.id);
    setPlanType(selectedSubscription.planType);
    setStatus(selectedSubscription.status);
    setBillingInterval(selectedSubscription.billingInterval ?? "");
    setMonthlyDiscountPercent(String(selectedSubscription.monthlyDiscountPercent ?? 0));
    setCurrentPeriodEnd(formatDateInput(selectedSubscription.currentPeriodEnd));
    setTrialEndsAt(formatDateInput(selectedSubscription.trialEndsAt));
    setAdditionalOwnerIds(getAdditionalOwnersForBar(selectedBar).map((owner) => owner.id));
    setAdditionalOwnerDraftId("");
  }, [selectedBar, selectedSubscription]);

  useEffect(() => {
    if (!selectedBarId) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [selectedBarId]);

  const hasOwners = owners.length > 0;

  function closeDetailsModal() {
    if (isPending) {
      return;
    }

    setSelectedBarId(null);
  }

  function applyPlan(nextPlan: "FREE" | "TRIAL" | "PAID" | "LIFETIME") {
    setPlanType(nextPlan);
    setStatus(getDefaultStatus(nextPlan));

    if (nextPlan !== "PAID") {
      setBillingInterval("");
      setCurrentPeriodEnd("");
    }

    if (nextPlan !== "TRIAL") {
      setTrialEndsAt("");
    }
  }

  function addNewAdditionalOwner() {
    if (!newAdditionalOwnerDraftId || newAdditionalOwnerDraftId === newOwnerId) {
      return;
    }

    setNewAdditionalOwnerIds((current) =>
      current.includes(newAdditionalOwnerDraftId)
        ? current
        : [...current, newAdditionalOwnerDraftId]
    );
    setNewAdditionalOwnerDraftId("");
  }

  function addAdditionalOwner() {
    if (!additionalOwnerDraftId || additionalOwnerDraftId === ownerId) {
      return;
    }

    setAdditionalOwnerIds((current) =>
      current.includes(additionalOwnerDraftId) ? current : [...current, additionalOwnerDraftId]
    );
    setAdditionalOwnerDraftId("");
  }

  async function saveSubscription() {
    if (!selectedBar) {
      return;
    }

    const formData = new FormData();
    formData.set("barId", selectedBar.id);
    formData.set("ownerId", ownerId);
    formData.set("planType", planType);
    formData.set("status", status);
    formData.set("monthlyDiscountPercent", monthlyDiscountPercent || "0");

    Array.from(new Set(additionalOwnerIds.filter((additionalOwnerId) => additionalOwnerId !== ownerId)))
      .forEach((additionalOwnerId) => {
        formData.append("additionalOwnerIds", additionalOwnerId);
      });

    if (billingInterval) {
      formData.set("billingInterval", billingInterval);
    }

    if (currentPeriodEnd) {
      formData.set("currentPeriodEnd", currentPeriodEnd);
    }

    if (trialEndsAt) {
      formData.set("trialEndsAt", trialEndsAt);
    }

    startTransition(async () => {
      await updateBarSubscriptionAction(formData);
      setSelectedBarId(null);
      router.refresh();
    });
  }

  async function deleteBar(inputBarId?: string) {
    const targetBar = inputBarId ? bars.find((bar) => bar.id === inputBarId) ?? null : selectedBar;

    if (!targetBar) {
      return;
    }

    const confirmed = window.confirm(
      `Vuoi eliminare definitivamente ${targetBar.name}? Questa azione rimuove la struttura e i dati collegati.`
    );

    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("barId", targetBar.id);

    startTransition(async () => {
      try {
        await deleteBarBySuperAdminAction(formData);

        if (!inputBarId) {
          setSelectedBarId(null);
        }

        router.refresh();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Eliminazione non riuscita.");
      }
    });
  }

  return (
    <>
      <Panel
        title={`Attivita (${bars.length})`}
        action={
          <PrimaryButton
            type="button"
            onClick={() => setOpen(true)}
            disabled={!hasOwners}
            style={{ borderRadius: 999, paddingInline: 16, whiteSpace: "nowrap" }}
          >
            + Nuova
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
              <FormField label="Trova un'attivita">
                <TextInput name="q" defaultValue={query} placeholder="Nome, titolare o citta" />
              </FormField>

              <FormField label="Categoria">
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
      const revenue = getRevenueSummary(subscription);
      const additionalOwners = getAdditionalOwnersForBar(bar);
      const ownerSummary = getOwnerSummaryLabel(bar.owner, additionalOwners);

      return (
        <button
          key={bar.id}
                    type="button"
                    onClick={() => setSelectedBarId(bar.id)}
                    style={{
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <ItemCard
                      title={bar.name}
                      subtitle={`${ownerSummary} - ${bar.city ?? "Senza citta"}`}
                      meta={`${getActivityLabel(bar.activityType)}${bar.legalName ? ` - ${bar.legalName}` : ""}`}
                      footer={
                        <div style={{ display: "grid", gap: 8 }}>
                          {subscription ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <StatusPill
                                label={getSubscriptionLabel(subscription)}
                                tone={getSubscriptionTone(subscription)}
                              />
                              <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                                {getSubscriptionDetail(subscription)}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "#64748b", fontSize: 13 }}>
                              Nessun abbonamento collegato
                            </span>
                          )}

                          <div
                            style={{
                              display: "grid",
                              gap: 2,
                              padding: "10px 12px",
                              borderRadius: 16,
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                              {revenue.title}
                            </span>
                            <strong style={{ color: "#0f172a", fontSize: 14, lineHeight: 1.4 }}>
                              {revenue.value}
                            </strong>
                            <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
                              {revenue.detail}
                            </span>
                          </div>

                          <span
                            style={{
                              color: "#7c3aed",
                              fontSize: 13,
                              fontWeight: 800,
                              textAlign: "right",
                            }}
                          >
                            Apri dettagli &#8594;
                          </span>
                        </div>
                      }
                    />
                  </button>
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
                      <Select
                        name="ownerId"
                        required
                        value={newOwnerId}
                        onChange={(event) => {
                          const nextOwnerId = event.target.value;
                          setNewOwnerId(nextOwnerId);
                          setNewAdditionalOwnerDraftId((current) => (current === nextOwnerId ? "" : current));
                          setNewAdditionalOwnerIds((current) =>
                            current.filter((ownerId) => ownerId !== nextOwnerId)
                          );
                        }}
                      >
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

                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "grid",
                        gap: 10,
                        padding: 16,
                        borderRadius: 20,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong style={{ color: "#0f172a" }}>Titolari aggiuntivi</strong>
                        <span style={{ color: "#64748b", fontSize: 13 }}>
                          {newAdditionalOwnerIds.length} selezionati
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                        <div style={{ flex: "1 1 220px", minWidth: 0, display: "grid", gap: 8 }}>
                          <span style={{ color: "#475569", fontSize: 13, fontWeight: 600 }}>
                            Seleziona titolare
                          </span>
                          <Select
                            value={newAdditionalOwnerDraftId}
                            onChange={(event) => setNewAdditionalOwnerDraftId(event.target.value)}
                          >
                            <option value="">
                              Aggiungi titolare
                            </option>
                            {owners
                              .filter(
                                (owner) =>
                                  owner.id !== newOwnerId && !newAdditionalOwnerIds.includes(owner.id)
                              )
                              .map((owner) => (
                                <option key={owner.id} value={owner.id}>
                                  {owner.firstName} {owner.lastName}
                                </option>
                              ))}
                          </Select>
                        </div>

                        <PrimaryButton
                          type="button"
                          tone="sand"
                          onClick={addNewAdditionalOwner}
                          disabled={!newAdditionalOwnerDraftId}
                          style={{ minWidth: 52 }}
                        >
                          +
                        </PrimaryButton>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          maxHeight: 140,
                          overflowY: "auto",
                          paddingRight: 4,
                        }}
                      >
                        {newAdditionalOwnerIds.map((ownerId) => {
                          const owner = owners.find((item) => item.id === ownerId);

                          if (!owner) {
                            return null;
                          }

                          return (
                            <span
                              key={owner.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                borderRadius: 999,
                                padding: "8px 12px",
                                background: "#eef2ff",
                                color: "#3730a3",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              <input type="hidden" name="additionalOwnerIds" value={owner.id} />
                              {owner.firstName} {owner.lastName}
                              <button
                                type="button"
                                onClick={() =>
                                  setNewAdditionalOwnerIds((current) =>
                                    current.filter((currentOwnerId) => currentOwnerId !== owner.id)
                                  )
                                }
                                style={{
                                  border: 0,
                                  background: "transparent",
                                  color: "inherit",
                                  cursor: "pointer",
                                  fontSize: 16,
                                  lineHeight: 1,
                                }}
                                aria-label={`Rimuovi ${owner.firstName} ${owner.lastName}`}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
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

      {mounted && selectedBar
        ? createPortal(
            <div
              className="dashboard-modal-wrap"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483647,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <button
                type="button"
                aria-label="Chiudi popup struttura"
                onClick={closeDetailsModal}
                style={{
                  position: "absolute",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.28)",
                  backdropFilter: "blur(6px)",
                }}
              />

              <section
                className="dashboard-modal-panel"
                style={{
                  position: "relative",
                  width: "min(820px, calc(100vw - 32px))",
                  maxHeight: "calc(100dvh - 32px)",
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 28,
                  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  padding: 24,
                  display: "grid",
                  gap: 18,
                  zIndex: 1,
                }}
              >
                <div
                  className="dashboard-modal-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    {(() => {
                      const additionalOwners = getAdditionalOwnersForBar(selectedBar);
                      const ownerSummary = getOwnerSummaryLabel(selectedBar.owner, additionalOwners);

                      return <span style={{ color: "#475569" }}>{ownerSummary}</span>;
                    })()}
                    <strong style={{ fontSize: 24, color: "#0f172a", lineHeight: 1.1 }}>
                      {selectedBar.name}
                    </strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "6px 10px",
                          background: "#f1f5f9",
                          color: "#334155",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {getActivityLabel(selectedBar.activityType)}
                      </span>
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "6px 10px",
                          background: selectedAccessUnlocked ? "#dcfce7" : "#fee2e2",
                          color: selectedAccessUnlocked ? "#166534" : "#991b1b",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {selectedAccessUnlocked ? "Accesso attivo" : "Accesso bloccato"}
                      </span>
                      <span style={{ color: "#64748b", fontSize: 13 }}>
                        Titolare principale: {selectedBar.owner.firstName} {selectedBar.owner.lastName}
                      </span>
                    </div>
                  </div>

                  <PrimaryButton type="button" tone="sand" onClick={closeDetailsModal} disabled={isPending}>
                    X
                  </PrimaryButton>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 14,
                    borderRadius: 22,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                    Azioni rapide piano
                  </div>
                  <div className="dashboard-inline-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <PrimaryButton type="button" tone="sand" onClick={() => applyPlan("FREE")} disabled={isPending}>
                      Free
                    </PrimaryButton>
                    <PrimaryButton type="button" tone="sand" onClick={() => applyPlan("LIFETIME")} disabled={isPending}>
                      Lifetime
                    </PrimaryButton>
                    <PrimaryButton type="button" onClick={() => applyPlan("PAID")} disabled={isPending}>
                      Pagante
                    </PrimaryButton>
                    <PrimaryButton type="button" tone="sand" onClick={() => applyPlan("TRIAL")} disabled={isPending}>
                      Prova
                    </PrimaryButton>
                    <PrimaryButton type="button" tone="red" onClick={() => void deleteBar()} disabled={isPending}>
                      Elimina
                    </PrimaryButton>
                  </div>
                </div>

                <div
                  className="dashboard-modal-body-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Responsabile</span>
                    <select
                      value={ownerId}
                      onChange={(event) => {
                        const nextOwnerId = event.target.value;
                        setOwnerId(nextOwnerId);
                        setAdditionalOwnerDraftId((current) => (current === nextOwnerId ? "" : current));
                        setAdditionalOwnerIds((current) =>
                          current.filter((ownerId) => ownerId !== nextOwnerId)
                        );
                      }}
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                    >
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.firstName} {owner.lastName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "grid",
                      gap: 10,
                      padding: 16,
                      borderRadius: 20,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong style={{ color: "#0f172a" }}>Titolari aggiuntivi</strong>
                      <span style={{ color: "#64748b", fontSize: 13 }}>
                        {additionalOwnerIds.filter((additionalOwnerId) => additionalOwnerId !== ownerId).length} selezionati
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                      <div style={{ flex: "1 1 220px", minWidth: 0, display: "grid", gap: 8 }}>
                        <span style={{ color: "#475569", fontSize: 13, fontWeight: 600 }}>
                          Seleziona titolare
                        </span>
                        <select
                          value={additionalOwnerDraftId}
                          onChange={(event) => setAdditionalOwnerDraftId(event.target.value)}
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe3ee",
                            padding: "12px 14px",
                            fontSize: 15,
                            background: "#ffffff",
                          }}
                        >
                          <option value="">Aggiungi titolare</option>
                          {owners
                            .filter((owner) => owner.id !== ownerId && !additionalOwnerIds.includes(owner.id))
                            .map((owner) => (
                              <option key={owner.id} value={owner.id}>
                                {owner.firstName} {owner.lastName}
                              </option>
                            ))}
                        </select>
                      </div>

                      <PrimaryButton
                        type="button"
                        tone="sand"
                        onClick={addAdditionalOwner}
                        disabled={!additionalOwnerDraftId}
                        style={{ minWidth: 52 }}
                      >
                        +
                      </PrimaryButton>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        maxHeight: 140,
                        overflowY: "auto",
                        paddingRight: 4,
                      }}
                    >
                      {additionalOwnerIds
                        .filter((additionalOwnerId) => additionalOwnerId !== ownerId)
                        .map((ownerId) => {
                          const owner = owners.find((item) => item.id === ownerId);

                          if (!owner) {
                            return null;
                          }

                          return (
                            <span
                              key={owner.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                borderRadius: 999,
                                padding: "8px 12px",
                                background: "#eef2ff",
                                color: "#3730a3",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              {owner.firstName} {owner.lastName}
                              <button
                                type="button"
                                onClick={() =>
                                  setAdditionalOwnerIds((current) =>
                                    current.filter((currentOwnerId) => currentOwnerId !== owner.id)
                                  )
                                }
                                style={{
                                  border: 0,
                                  background: "transparent",
                                  color: "inherit",
                                  cursor: "pointer",
                                  fontSize: 16,
                                  lineHeight: 1,
                                }}
                                aria-label={`Rimuovi ${owner.firstName} ${owner.lastName}`}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                    </div>
                  </div>

                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Piano</span>
                    <select
                      value={planType}
                      onChange={(event) => applyPlan(event.target.value as typeof planType)}
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                    >
                      <option value="FREE">FREE</option>
                      <option value="TRIAL">In prova</option>
                      <option value="PAID">PAID</option>
                      <option value="LIFETIME">LIFETIME</option>
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Stato</span>
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as typeof status)
                      }
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                      disabled={planType !== "PAID"}
                    >
                      <option value="ACTIVE">Attivo</option>
                      <option value="TRIALING">In prova</option>
                      <option value="PAST_DUE">PAST_DUE</option>
                      <option value="CANCELED">CANCELED</option>
                      <option value="UNPAID">UNPAID</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Intervallo</span>
                    <select
                      value={billingInterval}
                      onChange={(event) =>
                        setBillingInterval(event.target.value as "MONTHLY" | "YEARLY" | "")
                      }
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                      disabled={planType !== "PAID"}
                    >
                      <option value="">Non impostato</option>
                      <option value="MONTHLY">MONTHLY</option>
                      <option value="YEARLY">YEARLY</option>
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Sconto mensile %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={monthlyDiscountPercent}
                      onChange={(event) => setMonthlyDiscountPercent(event.target.value)}
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Scadenza periodo</span>
                    <input
                      type="date"
                      min={todayKey}
                      value={currentPeriodEnd}
                      onChange={(event) =>
                        setCurrentPeriodEnd(
                          event.target.value && event.target.value < todayKey
                            ? todayKey
                            : event.target.value
                        )
                      }
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                      disabled={planType !== "PAID"}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Fine trial</span>
                    <input
                      type="date"
                      min={todayKey}
                      value={trialEndsAt}
                      onChange={(event) =>
                        setTrialEndsAt(
                          event.target.value && event.target.value < todayKey
                            ? todayKey
                            : event.target.value
                        )
                      }
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                      disabled={planType !== "TRIAL"}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: 16,
                      borderRadius: 20,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                      Ricavi stimati
                    </div>
                    <strong style={{ color: "#0f172a", fontSize: 22 }}>
                      {isRevenueEligible(selectedSubscription)
                        ? formatCurrency(getEstimatedMonthlyRevenue(selectedSubscription))
                        : "0,00 €"}
                    </strong>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      Annuale:{" "}
                      {isRevenueEligible(selectedSubscription)
                        ? formatCurrency(getEstimatedAnnualRevenue(selectedSubscription))
                        : "0,00 €"}
                    </span>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      Sconto mensile: {selectedSubscription.monthlyDiscountPercent}%
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: 16,
                      borderRadius: 20,
                      background: selectedAccessUnlocked ? "#f0fdf4" : "#fef2f2",
                      border: selectedAccessUnlocked ? "1px solid #bbf7d0" : "1px solid #fecaca",
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                      Stato servizio
                    </div>
                    <strong
                      style={{
                        color: selectedAccessUnlocked ? "#166534" : "#991b1b",
                        fontSize: 22,
                      }}
                    >
                      {selectedAccessUnlocked ? "Sbloccato" : "Bloccato"}
                    </strong>
                    <span style={{ color: selectedAccessUnlocked ? "#166534" : "#991b1b", fontSize: 13 }}>
                      Piano: {selectedSubscription.planType}
                    </span>
                    <span style={{ color: selectedAccessUnlocked ? "#166534" : "#991b1b", fontSize: 13 }}>
                      Stato: {selectedSubscription.status}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: 16,
                      borderRadius: 20,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                      Stripe
                    </div>
                    {[
                      ["Customer", selectedBar.subscription?.stripeCustomerId],
                      ["Subscription", selectedBar.subscription?.stripeSubscriptionId],
                      ["Price", selectedBar.subscription?.stripePriceId],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>
                          {label}
                        </span>
                        <code
                          style={{
                            color: "#334155",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={value || "Non disponibile"}
                        >
                          {value || "Non disponibile"}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "none",
                    gap: 10,
                    padding: 18,
                    borderRadius: 20,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 14 }}>Dettagli</div>
                  <div style={{ color: "#334155", lineHeight: 1.7 }}>
                    Customer id: {selectedBar.subscription?.stripeCustomerId ?? "—"}
                    <br />
                    Subscription id: {selectedBar.subscription?.stripeSubscriptionId ?? "—"}
                    <br />
                    Price id: {selectedBar.subscription?.stripePriceId ?? "—"}
                    <br />
                    Sconto mensile: {selectedSubscription.monthlyDiscountPercent}%
                    <br />
                    Ricavo mensile stimato:{" "}
                    {selectedSubscription && isRevenueEligible(selectedSubscription)
                      ? formatCurrency(getEstimatedMonthlyRevenue(selectedSubscription))
                      : "€0,00"}
                    <br />
                    Ricavo annuale stimato:{" "}
                    {selectedSubscription && isRevenueEligible(selectedSubscription)
                      ? formatCurrency(getEstimatedAnnualRevenue(selectedSubscription))
                      : "€0,00"}
                    <br />
                    Accesso attuale:{" "}
                    {selectedSubscription.planType === "FREE" ||
                    selectedSubscription.planType === "LIFETIME" ||
                    (selectedSubscription.planType === "TRIAL" &&
                      selectedSubscription.trialEndsAt &&
                      new Date(selectedSubscription.trialEndsAt).getTime() > nowMs) ||
                    (selectedSubscription.planType === "PAID" &&
                      (selectedSubscription.status === "ACTIVE" ||
                        selectedSubscription.status === "TRIALING"))
                      ? "Sbloccato"
                      : "Bloccato"}
                  </div>
                </div>

                <div
                  className="dashboard-modal-actions"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <PrimaryButton type="button" onClick={closeDetailsModal} tone="sand" disabled={isPending}>
                    Annulla
                  </PrimaryButton>

                  <PrimaryButton type="button" onClick={() => void saveSubscription()} disabled={isPending}>
                    {isPending ? "Salvataggio..." : "Salva abbonamento"}
                  </PrimaryButton>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
