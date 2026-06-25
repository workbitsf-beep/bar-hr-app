"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatDateInTimeZone, toDateInputValueInTimeZone } from "@/lib/time-zone";
import { deleteBarBySuperAdminAction, updateBarSubscriptionAction } from "../actions";
import { PrimaryButton } from "../ui";

type OwnerOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type PlanTypeValue = "FREE" | "TRIAL" | "PAID" | "LIFETIME";
type BillingIntervalValue = "MONTHLY" | "YEARLY";
type BillingStatusValue =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INACTIVE";

type BillingFilter =
  | "ALL"
  | "ACTIVE"
  | "PAST_DUE"
  | "INACTIVE"
  | "TRIAL"
  | "FREE_LIFETIME";

type BarAdminItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  owner: OwnerOption;
  memberships: {
    user: OwnerOption;
  }[];
  subscription: {
    planType: PlanTypeValue;
    status: BillingStatusValue;
    billingInterval: BillingIntervalValue | null;
    monthlyDiscountPercent: number;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    stripePriceId: string | null;
  };
};

function formatDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return toDateInputValueInTimeZone(value);
}

function getAdditionalOwnersForBar(bar: Pick<BarAdminItem, "owner" | "memberships">) {
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

function formatDateLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return formatDateInTimeZone(value);
}

function canAccess(bar: BarAdminItem) {
  if (bar.subscription.planType === "FREE" || bar.subscription.planType === "LIFETIME") {
    return true;
  }

  if (bar.subscription.planType === "TRIAL") {
    return Boolean(
      bar.subscription.trialEndsAt &&
        new Date(bar.subscription.trialEndsAt).getTime() > Date.now()
    );
  }

  return (
    bar.subscription.planType === "PAID" &&
    (bar.subscription.status === "ACTIVE" || bar.subscription.status === "TRIALING")
  );
}

function isExpiringSoon(bar: BarAdminItem) {
  const value =
    bar.subscription.planType === "TRIAL"
      ? bar.subscription.trialEndsAt
      : bar.subscription.currentPeriodEnd;

  if (!value) {
    return false;
  }

  const diffDays = Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 5;
}

function getFilterValue(bar: BarAdminItem): BillingFilter {
  if (bar.subscription.planType === "FREE" || bar.subscription.planType === "LIFETIME") {
    return "FREE_LIFETIME";
  }

  if (bar.subscription.planType === "TRIAL") {
    return "TRIAL";
  }

  if (bar.subscription.status === "PAST_DUE" || bar.subscription.status === "UNPAID") {
    return "PAST_DUE";
  }

  if (bar.subscription.status === "ACTIVE" || bar.subscription.status === "TRIALING") {
    return "ACTIVE";
  }

  return "INACTIVE";
}

function getBadgeMeta(bar: BarAdminItem) {
  if (bar.subscription.planType === "FREE") {
    return {
      label: "Free",
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "#bfdbfe",
    };
  }

  if (bar.subscription.planType === "LIFETIME") {
    return {
      label: "Lifetime",
      background: "#e9d5ff",
      color: "#7e22ce",
      border: "#d8b4fe",
    };
  }

  if (bar.subscription.planType === "TRIAL") {
    return {
      label: "In prova",
      background: "#fef3c7",
      color: "#92400e",
      border: "#fde68a",
    };
  }

  if (bar.subscription.status === "PAST_DUE" || bar.subscription.status === "UNPAID") {
    return {
      label: "Past due",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fecaca",
    };
  }

  if (bar.subscription.status === "INACTIVE" || bar.subscription.status === "CANCELED") {
    return {
      label: "Inactive",
      background: "#e2e8f0",
      color: "#475569",
      border: "#cbd5e1",
    };
  }

  if (isExpiringSoon(bar)) {
    return {
      label: "In scadenza",
      background: "#fef3c7",
      color: "#92400e",
      border: "#fde68a",
    };
  }

  return {
    label: "Attivo",
    background: "#dcfce7",
    color: "#166534",
    border: "#bbf7d0",
  };
}

function getDefaultStatus(planType: PlanTypeValue): BillingStatusValue {
  if (planType === "TRIAL") {
    return "TRIALING";
  }

  if (planType === "FREE" || planType === "LIFETIME") {
    return "ACTIVE";
  }

  return "INACTIVE";
}

export function BarGroupsClient({
  bars,
  owners,
}: {
  bars: BarAdminItem[];
  owners: OwnerOption[];
}) {
  const router = useRouter();
  const todayKey = toDateInputValueInTimeZone(new Date());
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BillingFilter>("ALL");
  const [ownerId, setOwnerId] = useState("");
  const [planType, setPlanType] = useState<PlanTypeValue>("PAID");
  const [status, setStatus] = useState<BillingStatusValue>("INACTIVE");
  const [billingInterval, setBillingInterval] = useState<BillingIntervalValue | "">("");
  const [monthlyDiscountPercent, setMonthlyDiscountPercent] = useState("0");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [additionalOwnerIds, setAdditionalOwnerIds] = useState<string[]>([]);
  const [additionalOwnerDraftId, setAdditionalOwnerDraftId] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredBars = useMemo(
    () => bars.filter((bar) => filter === "ALL" || getFilterValue(bar) === filter),
    [bars, filter]
  );

  const selectedBar = useMemo(
    () => bars.find((bar) => bar.id === selectedBarId) ?? null,
    [bars, selectedBarId]
  );

  useEffect(() => {
    if (!selectedBar) {
      return;
    }

    setOwnerId(selectedBar.owner.id);
    setPlanType(selectedBar.subscription.planType);
    setStatus(selectedBar.subscription.status);
    setBillingInterval(selectedBar.subscription.billingInterval ?? "");
    setMonthlyDiscountPercent(String(selectedBar.subscription.monthlyDiscountPercent ?? 0));
    setCurrentPeriodEnd(formatDateInput(selectedBar.subscription.currentPeriodEnd));
    setTrialEndsAt(formatDateInput(selectedBar.subscription.trialEndsAt));
    setAdditionalOwnerIds(getAdditionalOwnersForBar(selectedBar).map((owner) => owner.id));
    setAdditionalOwnerDraftId("");
  }, [selectedBar]);

  useEffect(() => {
    if (!selectedBarId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedBarId]);

  function closeModal() {
    if (isPending) {
      return;
    }

    setSelectedBarId(null);
  }

  async function deleteBar(inputBarId?: string) {
    const targetBar = inputBarId ? bars.find((bar) => bar.id === inputBarId) ?? null : selectedBar;

    if (!targetBar) {
      return;
    }

    const confirmed = window.confirm(
      `Vuoi eliminare definitivamente ${targetBar.name}? Questa azione rimuove il cliente e tutti i dati della struttura.`
    );

    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("barId", targetBar.id);

    startTransition(async () => {
      await deleteBarBySuperAdminAction(formData);
      if (!inputBarId) {
        setSelectedBarId(null);
      }
      router.refresh();
    });
  }

  function applyPlan(nextPlan: PlanTypeValue) {
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

  function addAdditionalOwner() {
    if (!additionalOwnerDraftId || additionalOwnerDraftId === ownerId) {
      return;
    }

    setAdditionalOwnerIds((current) =>
      current.includes(additionalOwnerDraftId) ? current : [...current, additionalOwnerDraftId]
    );
    setAdditionalOwnerDraftId("");
  }

  async function saveBar(inputBarId?: string, nextPlanType?: PlanTypeValue) {
    const targetBar = inputBarId ? bars.find((bar) => bar.id === inputBarId) ?? null : selectedBar;

    if (!targetBar) {
      return;
    }

    const effectivePlanType = nextPlanType ?? planType;
    const effectiveStatus =
      nextPlanType && nextPlanType !== "PAID" ? getDefaultStatus(nextPlanType) : status;

    const formData = new FormData();
    formData.set("barId", targetBar.id);
    formData.set("ownerId", inputBarId ? targetBar.owner.id : ownerId);
    formData.set("planType", effectivePlanType);
    formData.set("status", effectiveStatus);
    formData.set(
      "monthlyDiscountPercent",
      inputBarId
        ? String(targetBar.subscription.monthlyDiscountPercent ?? 0)
        : monthlyDiscountPercent
    );

    const selectedAdditionalOwnerIds = Array.from(
      new Set(
        (inputBarId
          ? getAdditionalOwnersForBar(targetBar).map((owner) => owner.id)
          : additionalOwnerIds
        ).filter((additionalOwnerId) => additionalOwnerId !== (inputBarId ? targetBar.owner.id : ownerId))
      )
    );

    selectedAdditionalOwnerIds.forEach((additionalOwnerId) => {
      formData.append("additionalOwnerIds", additionalOwnerId);
    });

    if (!inputBarId && billingInterval) {
      formData.set("billingInterval", billingInterval);
    }

    if (inputBarId && targetBar.subscription.billingInterval) {
      formData.set("billingInterval", targetBar.subscription.billingInterval);
    }

    if (!inputBarId && currentPeriodEnd) {
      formData.set("currentPeriodEnd", currentPeriodEnd);
    }

    if (inputBarId && targetBar.subscription.currentPeriodEnd) {
      formData.set("currentPeriodEnd", targetBar.subscription.currentPeriodEnd);
    }

    if (!inputBarId && trialEndsAt) {
      formData.set("trialEndsAt", trialEndsAt);
    }

    if (inputBarId && targetBar.subscription.trialEndsAt) {
      formData.set("trialEndsAt", targetBar.subscription.trialEndsAt);
    }

    startTransition(async () => {
      await updateBarSubscriptionAction(formData);
      if (!inputBarId) {
        setSelectedBarId(null);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="dashboard-compact-filters" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          ["ALL", "Tutti"],
          ["ACTIVE", "Attivo"],
          ["PAST_DUE", "Past due"],
          ["INACTIVE", "Inactive"],
          ["TRIAL", "In prova"],
          ["FREE_LIFETIME", "Free / Lifetime"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value as BillingFilter)}
            style={{
              borderRadius: 999,
              border: filter === value ? "1px solid #0f172a" : "1px solid #dbe3ee",
              background: filter === value ? "#0f172a" : "#ffffff",
              color: filter === value ? "#ffffff" : "#334155",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="dashboard-table-desktop"
        style={{
          overflowX: "auto",
          borderRadius: 22,
          border: "1px solid #e2e8f0",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            minWidth: 980,
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 0.75fr 0.85fr 0.85fr 1fr 1.05fr 1.2fr",
          }}
        >
          {["Struttura", "Responsabile", "Piano", "Stato", "Sconto mese", "Scadenza", "Stripe subscription id", "Azioni"].map(
            (label) => (
              <div
                key={label}
                style={{
                  padding: "14px 16px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  fontWeight: 700,
                  color: "#475569",
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </div>
            )
          )}

          {filteredBars.map((bar) => {
            const badge = getBadgeMeta(bar);
            const additionalOwners = getAdditionalOwnersForBar(bar);
            const ownerSummary = getOwnerSummaryLabel(bar.owner, additionalOwners);

            return (
              <div
                key={bar.id}
                onClick={() => setSelectedBarId(bar.id)}
                style={{
                  display: "contents",
                  cursor: "pointer",
                }}
              >
                <div style={{ padding: "16px", borderBottom: "1px solid #eef2f7", color: "#0f172a", fontWeight: 700 }}>
                  {bar.name}
                </div>
                <div style={{ padding: "16px", borderBottom: "1px solid #eef2f7", color: "#334155" }}>
                  {ownerSummary}
                </div>
                <div style={{ padding: "16px", borderBottom: "1px solid #eef2f7", color: "#334155" }}>
                  {bar.subscription.planType}
                </div>
                <div style={{ padding: "16px", borderBottom: "1px solid #eef2f7" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      padding: "7px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      background: badge.background,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                <div style={{ padding: "16px", borderBottom: "1px solid #eef2f7", color: "#334155" }}>
                  {bar.subscription.monthlyDiscountPercent > 0
                    ? `${bar.subscription.monthlyDiscountPercent}%`
                    : "0%"}
                </div>
                <div style={{ padding: "16px", borderBottom: "1px solid #eef2f7", color: "#334155" }}>
                  {formatDateLabel(
                    bar.subscription.planType === "TRIAL"
                      ? bar.subscription.trialEndsAt
                      : bar.subscription.currentPeriodEnd
                  )}
                </div>
                <div style={{ padding: "16px", borderBottom: "1px solid #eef2f7", color: "#64748b", fontSize: 13 }}>
                  {bar.subscription.stripeSubscriptionId || "—"}
                </div>
                <div
                  style={{
                    padding: "16px",
                    borderBottom: "1px solid #eef2f7",
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void saveBar(bar.id, "FREE");
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #dbeafe",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      padding: "8px 12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    FREE
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void saveBar(bar.id, "LIFETIME");
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #e9d5ff",
                      background: "#faf5ff",
                      color: "#7e22ce",
                      padding: "8px 12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    LIFETIME
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void saveBar(bar.id, "PAID");
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "8px 12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    PAID
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteBar(bar.id);
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      padding: "8px 12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ELIMINA
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="super-admin-mobile-list">
        {filteredBars.map((bar) => {
          const badge = getBadgeMeta(bar);
          const additionalOwners = getAdditionalOwnersForBar(bar);
          const ownerSummary = getOwnerSummaryLabel(bar.owner, additionalOwners);

          return (
            <button
              key={bar.id}
              type="button"
              onClick={() => setSelectedBarId(bar.id)}
              className="dashboard-list-button"
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 22,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 14,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "grid", gap: 8 }}>
                <strong style={{ color: "#0f172a", fontSize: 18 }}>{bar.name}</strong>
                <span style={{ color: "#475569", lineHeight: 1.5 }}>{ownerSummary}</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    width: "fit-content",
                    borderRadius: 999,
                    padding: "7px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    background: badge.background,
                    color: badge.color,
                    border: `1px solid ${badge.border}`,
                  }}
                >
                  {badge.label}
                </span>
                <span style={{ color: "#64748b", fontSize: 14 }}>
                  {bar.subscription.planType} ·{" "}
                  {formatDateLabel(
                    bar.subscription.planType === "TRIAL"
                      ? bar.subscription.trialEndsAt
                      : bar.subscription.currentPeriodEnd
                  )}
                </span>
                <span style={{ color: "#64748b", fontSize: 14 }}>
                  Sconto mese: {bar.subscription.monthlyDiscountPercent}%
                </span>
              </div>

              <span className="dashboard-list-button-arrow" style={{ color: "#64748b", fontSize: 18, fontWeight: 700 }}>
                &rsaquo;
              </span>
            </button>
          );
        })}
      </div>

      {mounted && selectedBar
        ? createPortal(
            <div
              className="dashboard-modal-wrap"
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
                aria-label="Chiudi popup billing"
                onClick={closeModal}
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
                  maxHeight: "calc(100vh - 32px)",
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
                    <strong style={{ fontSize: 22, color: "#0f172a" }}>{selectedBar.name}</strong>
                    <span style={{ color: "#475569" }}>
                      {getOwnerSummaryLabel(selectedBar.owner, getAdditionalOwnersForBar(selectedBar))}
                    </span>
                  </div>

                  <PrimaryButton type="button" tone="sand" onClick={closeModal} disabled={isPending}>
                    Chiudi
                  </PrimaryButton>
                </div>

                <div className="dashboard-inline-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PrimaryButton type="button" tone="sand" onClick={() => applyPlan("FREE")} disabled={isPending}>
                    Imposta FREE
                  </PrimaryButton>
                  <PrimaryButton type="button" tone="sand" onClick={() => applyPlan("LIFETIME")} disabled={isPending}>
                    Imposta LIFETIME
                  </PrimaryButton>
                  <PrimaryButton type="button" onClick={() => applyPlan("PAID")} disabled={isPending}>
                    Riporta a PAID
                  </PrimaryButton>
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
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Plan type</span>
                    <select
                      value={planType}
                      onChange={(event) => applyPlan(event.target.value as PlanTypeValue)}
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
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Status</span>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value as BillingStatusValue)}
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
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Billing interval</span>
                    <select
                      value={billingInterval}
                      onChange={(event) =>
                        setBillingInterval(event.target.value as BillingIntervalValue | "")
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
                    gap: 10,
                    padding: 18,
                    borderRadius: 20,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 14 }}>Dettagli Stripe</div>
                  <div style={{ color: "#334155", lineHeight: 1.7 }}>
                    Customer id: {selectedBar.subscription.stripeCustomerId || "—"}
                    <br />
                    Subscription id: {selectedBar.subscription.stripeSubscriptionId || "—"}
                    <br />
                    Price id: {selectedBar.subscription.stripePriceId || "—"}
                    <br />
                    Sconto mensile: {selectedBar.subscription.monthlyDiscountPercent}%
                    <br />
                    Accesso attuale: {canAccess(selectedBar) ? "Sbloccato" : "Bloccato"}
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
                  <PrimaryButton
                    type="button"
                    tone="red"
                    onClick={() => void deleteBar()}
                    disabled={isPending}
                  >
                    {isPending ? "Eliminazione..." : "Elimina cliente"}
                  </PrimaryButton>

                  <PrimaryButton type="button" onClick={() => void saveBar()} disabled={isPending}>
                    {isPending ? "Salvataggio..." : "Salva modifiche"}
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
