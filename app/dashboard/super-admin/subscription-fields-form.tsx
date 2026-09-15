"use client";

import type { BillingIntervalValue, BillingStatusValue, PlanTypeValue } from "./subscription-helpers";

const fieldStyle = {
  borderRadius: 16,
  border: "1px solid #dbe3ee",
  padding: "12px 14px",
  fontSize: 15,
  background: "#ffffff",
} as const;

export function SubscriptionFieldsForm({
  planType,
  status,
  billingInterval,
  monthlyDiscountPercent,
  currentPeriodEnd,
  trialEndsAt,
  todayKey,
  onApplyPlan,
  onStatusChange,
  onBillingIntervalChange,
  onDiscountChange,
  onCurrentPeriodEndChange,
  onTrialEndsAtChange,
}: {
  planType: PlanTypeValue;
  status: BillingStatusValue;
  billingInterval: BillingIntervalValue | "";
  monthlyDiscountPercent: string;
  currentPeriodEnd: string;
  trialEndsAt: string;
  todayKey: string;
  onApplyPlan: (plan: PlanTypeValue) => void;
  onStatusChange: (status: BillingStatusValue) => void;
  onBillingIntervalChange: (value: BillingIntervalValue | "") => void;
  onDiscountChange: (value: string) => void;
  onCurrentPeriodEndChange: (value: string) => void;
  onTrialEndsAtChange: (value: string) => void;
}) {
  function clampToToday(value: string) {
    return value && value < todayKey ? todayKey : value;
  }

  return (
    <>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Piano</span>
        <select
          value={planType}
          onChange={(event) => onApplyPlan(event.target.value as PlanTypeValue)}
          style={fieldStyle}
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
          onChange={(event) => onStatusChange(event.target.value as BillingStatusValue)}
          style={fieldStyle}
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
          onChange={(event) => onBillingIntervalChange(event.target.value as BillingIntervalValue | "")}
          style={fieldStyle}
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
          onChange={(event) => onDiscountChange(event.target.value)}
          style={fieldStyle}
        />
      </label>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Scadenza periodo</span>
        <input
          type="date"
          min={todayKey}
          value={currentPeriodEnd}
          onChange={(event) => onCurrentPeriodEndChange(clampToToday(event.target.value))}
          style={fieldStyle}
          disabled={planType !== "PAID"}
        />
      </label>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Fine trial</span>
        <input
          type="date"
          min={todayKey}
          value={trialEndsAt}
          onChange={(event) => onTrialEndsAtChange(clampToToday(event.target.value))}
          style={fieldStyle}
          disabled={planType !== "TRIAL"}
        />
      </label>
    </>
  );
}
