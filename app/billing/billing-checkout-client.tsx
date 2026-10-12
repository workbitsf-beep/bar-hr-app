"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { showAppToast } from "@/app/components/app-toast";
import { InfoButton } from "@/app/components/info-button";
import { planInfo, type PlanInfoKey } from "@/lib/plan-info";
import { PrimaryButton } from "@/app/dashboard/ui";
import {
  CATALOG_LIMITS,
  PRICE_CENTS,
  PRICE_NAMES,
  formatEuro,
  normalizeSelection,
  selectionItems,
  selectionTotalCents,
  type CatalogInterval,
  type PlanSelection,
} from "@/lib/stripe-catalog";

/**
 * Where the owner picks the plan and pays, on the web only: Base or Pro, the
 * extras that fit the venue, monthly or yearly, with the total in front of
 * them before Stripe opens. A venue already paying changes the same
 * subscription from here.
 */

export type PurchaseProps = {
  company: boolean;
  custom: boolean;
  current: PlanSelection;
  interval: CatalogInterval;
  live: boolean;
  /** Free or lifetime: set by Workbit, nothing to buy. */
  managed: boolean;
  vatNumber: string | null;
  sameVatDiscount: boolean;
};

const card = {
  display: "grid",
  gap: 4,
  padding: "13px 14px",
  borderRadius: 16,
  border: "1px solid #e9e6f5",
  background: "#ffffff",
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
} as const;

function Info({ id, company }: { id: PlanInfoKey; company: boolean }) {
  const info = planInfo(id, company);
  return <InfoButton title={info.title} text={info.text} who={info.who} />;
}

function Choice({
  active,
  title,
  lead,
  info,
  company,
  onClick,
}: {
  active: boolean;
  title: string;
  lead: string;
  info: PlanInfoKey;
  company: boolean;
  onClick: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        style={{ ...card, width: "100%", paddingRight: 44, ...(active ? { border: "2px solid #6d3df0", background: "#faf7ff" } : {}) }}
      >
        <strong style={{ fontSize: 14.5, color: "#17161f" }}>{title}</strong>
        <span style={{ fontSize: 12.5, color: "#8a84a8", lineHeight: 1.4 }}>{lead}</span>
      </button>
      <span style={{ position: "absolute", top: 12, right: 12 }}>
        <Info id={info} company={company} />
      </span>
    </div>
  );
}

function Stepper({
  label,
  info,
  company,
  value,
  max,
  onChange,
}: {
  label: string;
  info: PlanInfoKey;
  company: boolean;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const button = {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid #ddd6fe",
    background: "#ffffff",
    color: "#4c1d95",
    fontSize: 18,
    fontWeight: 800,
    cursor: "pointer",
  } as const;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #f4f2fb" }}>
      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <strong style={{ fontSize: 13.5, color: "#17161f" }}>{label}</strong>
        <Info id={info} company={company} />
      </span>
      <button type="button" style={button} aria-label={`Meno ${label}`} disabled={value <= 0} onClick={() => onChange(value - 1)}>
        −
      </button>
      <strong style={{ minWidth: 18, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</strong>
      <button type="button" style={button} aria-label={`Più ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function Toggle({
  label,
  info,
  company,
  checked,
  onChange,
}: {
  label: string;
  info: PlanInfoKey;
  company: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #f4f2fb", cursor: "pointer" }}>
      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <strong style={{ fontSize: 13.5, color: "#17161f" }}>{label}</strong>
        <Info id={info} company={company} />
      </span>
      <span className="workbit-switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <i aria-hidden="true" />
      </span>
    </label>
  );
}

export function BillingCheckoutClient({
  canActivate,
  canCancel,
  trialSetupRequired,
  monthlyDiscountPercent,
  purchase,
}: {
  canActivate: boolean;
  canCancel: boolean;
  trialSetupRequired: boolean;
  monthlyDiscountPercent: number;
  purchase: PurchaseProps | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<PlanSelection>(() =>
    normalizeSelection(purchase?.current ?? {}, Boolean(purchase?.company))
  );
  const [interval, setBillingInterval] = useState<CatalogInterval>(purchase?.interval ?? "MONTHLY");
  const [vat, setVat] = useState(purchase?.vatNumber ?? "");

  const company = Boolean(purchase?.company);
  const update = (patch: Partial<PlanSelection>) => setSelection((current) => normalizeSelection({ ...current, ...patch }, company));
  const canBuy = Boolean(purchase && !purchase.custom && !purchase.managed && (canActivate || purchase.live));

  const total = selectionTotalCents(selection, interval);
  const discount = monthlyDiscountPercent > 0 && interval === "MONTHLY" ? monthlyDiscountPercent : purchase?.sameVatDiscount ? 10 : 0;
  const net = Math.round(total * (1 - discount / 100));
  const unchanged =
    Boolean(purchase?.live) &&
    interval === purchase?.interval &&
    JSON.stringify(selection) === JSON.stringify(normalizeSelection(purchase?.current ?? {}, company));

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval, selection, vatNumber: vat }),
        });
        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; url?: string; updated?: boolean; message?: string }
          | null;

        if (!response.ok || !result?.ok) {
          setError(result?.message || "Non è stato possibile aprire il pagamento. Riprova.");
          return;
        }
        if (result.updated) {
          showAppToast(result.message ?? "Abbonamento aggiornato.");
          router.refresh();
          return;
        }
        if (result.url) window.location.href = result.url;
      } catch {
        setError("Non è stato possibile aprire il pagamento. Controlla la connessione e riprova.");
      }
    });
  }

  function cancelSubscription() {
    if (!window.confirm("Vuoi davvero disattivare l'abbonamento? Il locale verrà bloccato subito.")) return;
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/cancel", { method: "POST" });
        const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!response.ok || !result?.ok) {
          setError(result?.message || "Non è stato possibile disattivare l'abbonamento.");
          return;
        }
        showAppToast("Abbonamento disattivato.");
        router.refresh();
      } catch {
        setError("Non è stato possibile disattivare l'abbonamento. Riprova.");
      }
    });
  }

  if (!canBuy && !canCancel) {
    return purchase?.custom ? (
      <p style={{ margin: 0, fontSize: 13, color: "#6b6880", lineHeight: 1.6 }}>
        Il tuo è un piano su misura: per cambiarlo scrivici.
      </p>
    ) : null;
  }

  const unit = interval === "MONTHLY" ? "/mese" : "/anno";
  const lines = selectionItems(selection);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {canBuy ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
            <Choice
              active={selection.plan === "BASE"}
              title={`Base · ${formatEuro(PRICE_CENTS.base[interval])}${unit}`}
              lead={company ? "Sede principale, 12 persone" : "Fino a 12 persone"}
              info="base"
              company={company}
              onClick={() => update({ plan: "BASE" })}
            />
            <Choice
              active={selection.plan === "PRO"}
              title={`Pro · ${formatEuro(PRICE_CENTS.pro[interval])}${unit}`}
              lead={company ? "3 sedi, 45 persone, tutto compreso" : "Tutto compreso, senza limite"}
              info="pro"
              company={company}
              onClick={() => update({ plan: "PRO" })}
            />
          </div>

          <div style={{ display: "grid" }}>
            {!company && selection.plan === "BASE" ? (
              <Toggle
                label={`Reparti · ${formatEuro(PRICE_CENTS.reparti[interval])}`}
                info="reparti"
                company={company}
                checked={selection.departments}
                onChange={(departments) => update({ departments })}
              />
            ) : null}
            {company ? (
              <Stepper
                label={`Sedi in più · ${formatEuro(PRICE_CENTS.sede[interval])}`}
                info="sedi"
                company={company}
                value={selection.extraSites}
                max={selection.plan === "PRO" ? CATALOG_LIMITS.sitesOnPro - CATALOG_LIMITS.sitesIncludedInPro : CATALOG_LIMITS.paidSitesOnBase}
                onChange={(extraSites) => update({ extraSites })}
              />
            ) : null}
            {company || selection.plan === "BASE" ? (
              <Stepper
                label={`+5 persone · ${formatEuro(PRICE_CENTS.persone5[interval])}`}
                info="persone5"
                company={company}
                value={selection.seatPacks}
                max={CATALOG_LIMITS.maxSeatPacks}
                onChange={(seatPacks) => update({ seatPacks })}
              />
            ) : null}
            {selection.plan === "BASE" ? (
              <Toggle
                label={`Il tuo stile · ${formatEuro(PRICE_CENTS.stile[interval])}`}
                info="stile"
                company={company}
                checked={selection.branding}
                onChange={(branding) => update({ branding })}
              />
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 6 }} role="radiogroup" aria-label="Periodo">
            {(["MONTHLY", "YEARLY"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={interval === value}
                onClick={() => setBillingInterval(value)}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: 999,
                  border: interval === value ? "2px solid #6d3df0" : "1px solid #e9e6f5",
                  background: interval === value ? "#faf7ff" : "#ffffff",
                  fontWeight: 800,
                  fontSize: 13.5,
                  color: "#17161f",
                  cursor: "pointer",
                }}
              >
                {value === "MONTHLY" ? "Mensile" : "Annuale · circa 2 mesi gratis"}
              </button>
            ))}
          </div>

          {!purchase?.vatNumber ? (
            <label style={{ display: "grid", gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>Partita IVA dell&apos;attività</span>
              <input
                value={vat}
                onChange={(event) => setVat(event.target.value)}
                inputMode="numeric"
                placeholder="11 cifre"
                maxLength={16}
                style={{ minHeight: 44, padding: "0 12px", borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 15 }}
              />
            </label>
          ) : null}

          <div style={{ display: "grid", gap: 6, padding: "12px 14px", borderRadius: 16, background: "#f8f6ff" }}>
            {lines.map((line) => (
              <span key={line.kind} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4c4670" }}>
                <span>
                  {PRICE_NAMES[line.kind]}
                  {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatEuro(PRICE_CENTS[line.kind][interval] * line.quantity)}</span>
              </span>
            ))}
            {discount ? (
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#166534" }}>
                <span>{monthlyDiscountPercent > 0 && interval === "MONTHLY" ? "Sconto concordato" : "Sconto stessa partita IVA"} · {discount}%</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>−{formatEuro(total - net)}</span>
              </span>
            ) : null}
            <span style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid #e9e6f5", fontSize: 15 }}>
              <strong>Totale</strong>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatEuro(net)}
                {unit}
              </strong>
            </span>
            <span style={{ fontSize: 11.5, color: "#a3a0b8" }}>Prezzi senza IVA.</span>
          </div>

          <PrimaryButton type="button" onClick={submit} disabled={isPending || unchanged}>
            {isPending
              ? purchase?.live
                ? "Aggiorno…"
                : "Apro il pagamento…"
              : purchase?.live
                ? unchanged
                  ? "È il tuo piano attuale"
                  : "Aggiorna l'abbonamento"
                : trialSetupRequired
                  ? "Inserisci il pagamento: paghi alla fine della prova"
                  : "Vai al pagamento"}
          </PrimaryButton>
        </>
      ) : null}

      {canCancel ? (
        <PrimaryButton type="button" tone="red" onClick={cancelSubscription} disabled={isPending}>
          {isPending ? "Un attimo…" : "Disattiva abbonamento"}
        </PrimaryButton>
      ) : null}

      {error ? (
        <div role="alert" style={{ padding: "10px 12px", borderRadius: 14, background: "#fff1f2", border: "1px solid #fecdd3", color: "#b3202f", fontSize: 13.5, fontWeight: 700 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
