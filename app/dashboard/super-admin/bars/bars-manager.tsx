"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { formatDateInTimeZone, toDateInputValueInTimeZone } from "@/lib/time-zone";
import {
  createBarBySuperAdminAction,
  deleteBarBySuperAdminAction,
  updateBarSubscriptionAction,
} from "../../actions";
import { ModalShell } from "../../modal-shell";
import { getDefaultStatus } from "../subscription-helpers";
import { PrimaryButton, Select, StatusBanner, StatusPill, TextInput } from "../../ui";
import { useOverlayLock } from "../../use-overlay-lock";

// Only needed once a modal is actually opened - keeping them out of the
// initial bundle noticeably shrinks what the list view has to download.
const AdditionalOwnersPicker = dynamic(
  () => import("../additional-owners-picker").then((mod) => mod.AdditionalOwnersPicker),
  { ssr: false }
);
const SubscriptionFieldsForm = dynamic(
  () => import("../subscription-fields-form").then((mod) => mod.SubscriptionFieldsForm),
  { ssr: false }
);

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
  useOverlayLock(open || Boolean(selectedBarId));

  useEffect(() => {
    // Warm the lazy-loaded modal chunks in the background once the list is
    // up, so tapping a card doesn't wait on a fresh network fetch for them.
    void import("../additional-owners-picker");
    void import("../subscription-fields-form");
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setNewOwnerId("");
    setNewAdditionalOwnerIds([]);
    setNewAdditionalOwnerDraftId("");

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
          <button type="button" className="sa-pill-btn" disabled={!hasOwners} onClick={() => setOpen(true)}>
            + Nuova
          </button>
        </div>

          {bars.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
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
                  className="sa-card"
                  style={{ border: "1px solid var(--workbit-border)", textAlign: "left", cursor: "pointer", width: "100%" }}
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
                </button>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "#64748b", fontSize: 14 }}>Nessuna struttura trovata con questi filtri.</div>
          )}
      </div>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Nuova struttura"
        width="min(92vw, 560px)"
        wrapClassName="sa-modal-wrap"
        panelClassName="sa-modal-panel"
      >
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

                    <AdditionalOwnersPicker
                      owners={owners}
                      excludeOwnerId={newOwnerId}
                      selectedIds={newAdditionalOwnerIds}
                      onChange={setNewAdditionalOwnerIds}
                      draftId={newAdditionalOwnerDraftId}
                      onDraftChange={setNewAdditionalOwnerDraftId}
                      emitHiddenInputs
                    />
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
      </ModalShell>

      {selectedBar ? (
        <ModalShell
          open
          onClose={closeDetailsModal}
          title={selectedBar.name}
          width="min(820px, calc(100vw - 32px))"
          zIndex={2147483647}
          wrapClassName="dashboard-modal-wrap sa-modal-wrap"
          panelClassName="dashboard-modal-panel sa-modal-panel"
          header={
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
          }
        >
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: 12,
                    borderRadius: 18,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                    Applica piano rapidamente
                  </div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                    {[
                      ["FREE", "Free"],
                      ["LIFETIME", "Lifetime"],
                      ["PAID", "Pagante"],
                      ["TRIAL", "Prova"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => applyPlan(value as "FREE" | "LIFETIME" | "PAID" | "TRIAL")}
                        disabled={isPending}
                        style={{
                          flex: "0 0 auto",
                          borderRadius: 999,
                          border: planType === value ? "1px solid #7b2ff7" : "1px solid #dbe3ee",
                          background: planType === value ? "#f4f2fe" : "#ffffff",
                          color: planType === value ? "#5b21b6" : "#334155",
                          padding: "9px 14px",
                          fontSize: 13,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          cursor: isPending ? "progress" : "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
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

                  <AdditionalOwnersPicker
                    owners={owners}
                    excludeOwnerId={ownerId}
                    selectedIds={additionalOwnerIds}
                    onChange={setAdditionalOwnerIds}
                    draftId={additionalOwnerDraftId}
                    onDraftChange={setAdditionalOwnerDraftId}
                    emitHiddenInputs={false}
                  />

                  <SubscriptionFieldsForm
                    planType={planType}
                    status={status}
                    billingInterval={billingInterval}
                    monthlyDiscountPercent={monthlyDiscountPercent}
                    currentPeriodEnd={currentPeriodEnd}
                    trialEndsAt={trialEndsAt}
                    todayKey={todayKey}
                    onApplyPlan={applyPlan}
                    onStatusChange={setStatus}
                    onBillingIntervalChange={setBillingInterval}
                    onDiscountChange={setMonthlyDiscountPercent}
                    onCurrentPeriodEndChange={setCurrentPeriodEnd}
                    onTrialEndsAtChange={setTrialEndsAt}
                  />
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

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => void deleteBar()}
                    disabled={isPending}
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      border: "1px solid rgba(220, 38, 38, 0.25)",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      padding: "11px 14px",
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: isPending ? "progress" : "pointer",
                    }}
                  >
                    Elimina definitivamente questa struttura
                  </button>
                </div>
        </ModalShell>
      ) : null}
    </>
  );
}
