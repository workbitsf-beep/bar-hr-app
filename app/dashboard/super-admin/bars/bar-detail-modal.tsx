"use client";

import { AdditionalOwnersPicker } from "../additional-owners-picker";
import { ModalShell } from "../../modal-shell";
import { SubscriptionFieldsForm } from "../subscription-fields-form";
import { PrimaryButton } from "../light-ui";
import {
  formatCurrency,
  getActivityLabel,
  getAdditionalOwnersForBar,
  getEstimatedAnnualRevenue,
  getEstimatedMonthlyRevenue,
  getOwnerSummaryLabel,
  isRevenueEligible,
  type BarItem,
  type OwnerOption,
} from "./bars-helpers";

type SubscriptionState = NonNullable<BarItem["subscription"]>;

export default function BarDetailModal({
  bar,
  owners,
  isPending,
  onClose,
  ownerId,
  setOwnerId,
  additionalOwnerIds,
  setAdditionalOwnerIds,
  additionalOwnerDraftId,
  setAdditionalOwnerDraftId,
  planType,
  status,
  billingInterval,
  monthlyDiscountPercent,
  currentPeriodEnd,
  trialEndsAt,
  todayKey,
  applyPlan,
  setStatus,
  setBillingInterval,
  setMonthlyDiscountPercent,
  setCurrentPeriodEnd,
  setTrialEndsAt,
  selectedSubscription,
  selectedAccessUnlocked,
  onSave,
  onDelete,
}: {
  bar: BarItem;
  owners: OwnerOption[];
  isPending: boolean;
  onClose: () => void;
  ownerId: string;
  setOwnerId: (id: string) => void;
  additionalOwnerIds: string[];
  setAdditionalOwnerIds: (ids: string[]) => void;
  additionalOwnerDraftId: string;
  setAdditionalOwnerDraftId: (id: string) => void;
  planType: "FREE" | "TRIAL" | "PAID" | "LIFETIME";
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE";
  billingInterval: "MONTHLY" | "YEARLY" | "";
  monthlyDiscountPercent: string;
  currentPeriodEnd: string;
  trialEndsAt: string;
  todayKey: string;
  applyPlan: (nextPlan: "FREE" | "TRIAL" | "PAID" | "LIFETIME") => void;
  setStatus: (status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE") => void;
  setBillingInterval: (interval: "MONTHLY" | "YEARLY" | "") => void;
  setMonthlyDiscountPercent: (value: string) => void;
  setCurrentPeriodEnd: (value: string) => void;
  setTrialEndsAt: (value: string) => void;
  selectedSubscription: SubscriptionState;
  selectedAccessUnlocked: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  const additionalOwners = getAdditionalOwnersForBar(bar);
  const ownerSummary = getOwnerSummaryLabel(bar.owner, additionalOwners);

  return (
    <ModalShell
      open
      onClose={onClose}
      title={bar.name}
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
            <span style={{ color: "#475569" }}>{ownerSummary}</span>
            <strong style={{ fontSize: 24, color: "#0f172a", lineHeight: 1.1 }}>{bar.name}</strong>
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
                {getActivityLabel(bar.activityType)}
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
                Titolare principale: {bar.owner.firstName} {bar.owner.lastName}
              </span>
            </div>
          </div>

          <PrimaryButton type="button" tone="sand" onClick={onClose} disabled={isPending}>
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
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Applica piano rapidamente</div>
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
              setAdditionalOwnerDraftId(additionalOwnerDraftId === nextOwnerId ? "" : additionalOwnerDraftId);
              setAdditionalOwnerIds(additionalOwnerIds.filter((id) => id !== nextOwnerId));
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
          <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>Ricavi stimati</div>
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
          <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>Stato servizio</div>
          <strong style={{ color: selectedAccessUnlocked ? "#166534" : "#991b1b", fontSize: 22 }}>
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
          <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>Stripe</div>
          {[
            ["Customer", bar.subscription?.stripeCustomerId],
            ["Subscription", bar.subscription?.stripeSubscriptionId],
            ["Price", bar.subscription?.stripePriceId],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>{label}</span>
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
        <PrimaryButton type="button" onClick={onClose} tone="sand" disabled={isPending}>
          Annulla
        </PrimaryButton>

        <PrimaryButton type="button" onClick={onSave} disabled={isPending}>
          {isPending ? "Salvataggio..." : "Salva abbonamento"}
        </PrimaryButton>
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
        <button
          type="button"
          onClick={onDelete}
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
  );
}
