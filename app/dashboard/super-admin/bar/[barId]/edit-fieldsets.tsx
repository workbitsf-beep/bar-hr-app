"use client";

import { useState } from "react";
import { Field, FieldGrid, Group } from "../../console-ui";
import {
  defaultStatusFor,
  formatCurrency,
  fullName,
  monthlyRevenue,
  toDateInput,
  type BillingInterval,
  type BillingStatus,
  type PersonShape,
  type PlanType,
} from "../../console-data";

const PLANS: Array<{ value: PlanType; label: string }> = [
  { value: "PAID", label: "A pagamento" },
  { value: "TRIAL", label: "In prova" },
  { value: "FREE", label: "Gratuito" },
  { value: "LIFETIME", label: "A vita" },
];

const STATUSES: Array<{ value: BillingStatus; label: string }> = [
  { value: "ACTIVE", label: "Attivo" },
  { value: "TRIALING", label: "In prova" },
  { value: "PAST_DUE", label: "Pagamento scaduto" },
  { value: "UNPAID", label: "Non pagato" },
  { value: "CANCELED", label: "Disdetto" },
  { value: "INACTIVE", label: "Inattivo" },
];

/**
 * Only the fields that matter for the chosen plan are rendered. Everything
 * left out is normalised server-side by updateBarSubscriptionAction, so the
 * form can submit natively with no client-built FormData.
 */
export function PlanFieldset({
  planType: initialPlan,
  status: initialStatus,
  billingInterval: initialInterval,
  monthlyDiscountPercent: initialDiscount,
  currentPeriodEnd: initialPeriodEnd,
  trialEndsAt: initialTrialEnd,
  todayKey,
}: {
  planType: PlanType;
  status: BillingStatus;
  billingInterval: BillingInterval | null;
  monthlyDiscountPercent: number;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  todayKey: string;
}) {
  const [planType, setPlanType] = useState<PlanType>(initialPlan);
  const [status, setStatus] = useState<BillingStatus>(initialStatus);
  const [billingInterval, setBillingInterval] = useState<BillingInterval | "">(initialInterval ?? "");
  const [discount, setDiscount] = useState(String(initialDiscount ?? 0));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(initialPeriodEnd));
  const [trialEnd, setTrialEnd] = useState(toDateInput(initialTrialEnd));

  function changePlan(next: PlanType) {
    setPlanType(next);
    setStatus(defaultStatusFor(next));

    if (next !== "PAID") {
      setBillingInterval("");
      setPeriodEnd("");
    }

    if (next !== "TRIAL") {
      setTrialEnd("");
    }
  }

  const preview = monthlyRevenue({
    planType,
    status,
    billingInterval: billingInterval || null,
    monthlyDiscountPercent: Number(discount) || 0,
    currentPeriodEnd: null,
    trialEndsAt: null,
  });

  return (
    <>
      <FieldGrid>
        <Field label="Piano">
          <select value={planType} onChange={(event) => changePlan(event.target.value as PlanType)} name="planType">
            {PLANS.map((plan) => (
              <option key={plan.value} value={plan.value}>
                {plan.label}
              </option>
            ))}
          </select>
        </Field>

        {planType === "PAID" ? (
          <Field label="Stato pagamento">
            <select value={status} onChange={(event) => setStatus(event.target.value as BillingStatus)} name="status">
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {planType === "PAID" ? (
          <Field label="Fatturazione">
            <select
              value={billingInterval}
              onChange={(event) => setBillingInterval(event.target.value as BillingInterval | "")}
              name="billingInterval"
            >
              <option value="">Non impostata</option>
              <option value="MONTHLY">Mensile</option>
              <option value="YEARLY">Annuale</option>
            </select>
          </Field>
        ) : null}

        <Field label="Sconto %" hint={preview > 0 ? `Vale ${formatCurrency(preview)} al mese` : undefined}>
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            name="monthlyDiscountPercent"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </Field>

        {planType === "PAID" ? (
          <Field label="Scadenza periodo">
            <input
              type="date"
              min={todayKey}
              name="currentPeriodEnd"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
            />
          </Field>
        ) : null}

        {planType === "TRIAL" ? (
          <Field label="Fine prova">
            <input
              type="date"
              min={todayKey}
              name="trialEndsAt"
              value={trialEnd}
              onChange={(event) => setTrialEnd(event.target.value)}
            />
          </Field>
        ) : null}
      </FieldGrid>
    </>
  );
}

export function OwnersFieldset({
  owners,
  primaryOwnerId,
  additionalOwnerIds,
}: {
  owners: PersonShape[];
  primaryOwnerId: string;
  additionalOwnerIds: string[];
}) {
  const [primary, setPrimary] = useState(primaryOwnerId);
  const [extra, setExtra] = useState<string[]>(additionalOwnerIds);
  const [draft, setDraft] = useState("");

  const visible = extra.filter((id) => id !== primary);
  const selectable = owners.filter((owner) => owner.id !== primary && !extra.includes(owner.id));

  function add() {
    if (!draft || draft === primary || extra.includes(draft)) {
      return;
    }

    setExtra([...extra, draft]);
    setDraft("");
  }

  return (
    <FieldGrid>
      <Field label="Titolare principale" span>
        <select name="ownerId" value={primary} onChange={(event) => setPrimary(event.target.value)} required>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {fullName(owner)} · {owner.email}
            </option>
          ))}
        </select>
      </Field>

      <Group label={`Titolari aggiuntivi · ${visible.length}`} span>
        <div style={{ display: "flex", gap: 9, alignItems: "stretch" }}>
          <select value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Aggiungi titolare">
            <option value="">Aggiungi titolare…</option>
            {selectable.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {fullName(owner)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="wbc-btn wbc-btn-ghost"
            onClick={add}
            disabled={!draft}
            style={{ flex: "0 0 auto" }}
          >
            Aggiungi
          </button>
        </div>

        {visible.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {visible.map((id) => {
              const owner = owners.find((item) => item.id === id);

              if (!owner) {
                return null;
              }

              return (
                <span key={id} className="wbc-chip" style={{ gap: 8 }}>
                  <input type="hidden" name="additionalOwnerIds" value={id} />
                  {fullName(owner)}
                  <button
                    type="button"
                    onClick={() => setExtra(extra.filter((item) => item !== id))}
                    aria-label={`Rimuovi ${fullName(owner)}`}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: 15,
                      lineHeight: 1,
                      padding: 0,
                      marginLeft: 2,
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}
      </Group>
    </FieldGrid>
  );
}
