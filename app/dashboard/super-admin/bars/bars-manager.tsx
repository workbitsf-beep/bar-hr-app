"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { deleteBarBySuperAdminAction, updateBarSubscriptionAction } from "../../actions";
import { getDefaultStatus } from "../subscription-helpers";
import { StatusBanner, StatusPill } from "../light-ui";
import { useOverlayLock } from "../../use-overlay-lock";
import {
  getActivityLabel,
  getAdditionalOwnersForBar,
  getOwnerSummaryLabel,
  getRevenueSummary,
  getSubscriptionDetail,
  getSubscriptionLabel,
  getSubscriptionTone,
  type ActivityFilter,
  type BarItem,
  type OwnerOption,
} from "./bars-helpers";

// The two modals are the bulk of this page's code but are hidden until
// opened - keeping them out of the initial bundle shrinks what the list
// view has to download and hydrate.
const CreateBarModal = dynamic(() => import("./create-bar-modal"), { ssr: false });
const BarDetailModal = dynamic(() => import("./bar-detail-modal"), { ssr: false });

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
    void import("./create-bar-modal");
    void import("./bar-detail-modal");
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

      <CreateBarModal
        open={open}
        onClose={() => setOpen(false)}
        owners={owners}
        hasOwners={hasOwners}
        newOwnerId={newOwnerId}
        setNewOwnerId={setNewOwnerId}
        newAdditionalOwnerIds={newAdditionalOwnerIds}
        setNewAdditionalOwnerIds={setNewAdditionalOwnerIds}
        newAdditionalOwnerDraftId={newAdditionalOwnerDraftId}
        setNewAdditionalOwnerDraftId={setNewAdditionalOwnerDraftId}
      />

      {selectedBar ? (
        <BarDetailModal
          bar={selectedBar}
          owners={owners}
          isPending={isPending}
          onClose={closeDetailsModal}
          ownerId={ownerId}
          setOwnerId={setOwnerId}
          additionalOwnerIds={additionalOwnerIds}
          setAdditionalOwnerIds={setAdditionalOwnerIds}
          additionalOwnerDraftId={additionalOwnerDraftId}
          setAdditionalOwnerDraftId={setAdditionalOwnerDraftId}
          planType={planType}
          status={status}
          billingInterval={billingInterval}
          monthlyDiscountPercent={monthlyDiscountPercent}
          currentPeriodEnd={currentPeriodEnd}
          trialEndsAt={trialEndsAt}
          todayKey={todayKey}
          applyPlan={applyPlan}
          setStatus={setStatus}
          setBillingInterval={setBillingInterval}
          setMonthlyDiscountPercent={setMonthlyDiscountPercent}
          setCurrentPeriodEnd={setCurrentPeriodEnd}
          setTrialEndsAt={setTrialEndsAt}
          selectedSubscription={selectedSubscription}
          selectedAccessUnlocked={Boolean(selectedAccessUnlocked)}
          onSave={() => void saveSubscription()}
          onDelete={() => void deleteBar()}
        />
      ) : null}
    </>
  );
}
