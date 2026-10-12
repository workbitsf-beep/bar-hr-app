"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { showAppToast } from "@/app/components/app-toast";
import { InfoButton } from "@/app/components/info-button";
import { planInfo, type PlanInfoKey } from "@/lib/plan-info";
import {
  CATALOG_LIMITS,
  PRICE_CENTS,
  formatEuro,
  normalizeSelection,
  selectionTotalCents,
  type CatalogInterval,
  type PlanSelection,
} from "@/lib/stripe-catalog";

/**
 * The plan and its subscription in one screen: where the venue stands on top,
 * Base and Pro side by side, the extras one line each with their "i", and a
 * bar at the bottom with the total and the one button. The plan is changed
 * right here, on the web; the installed app shows the same screen without
 * prices or controls, as the stores require.
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

export type PlanStatus = {
  tone: "ok" | "warn" | "bad" | "off";
  label: string;
  /** "Rinnova il 22 ott · 3 persone su 12" */
  detail: string;
  /** A sentence for anything that is not plain "active". */
  notice: string | null;
};

/** What the venue has now, from its entitlements: the read-only half. */
export type OwnedPlan = {
  plan: "BASE" | "PRO" | "CUSTOM";
  departments: boolean;
  seatPacks: number;
  branding: boolean;
  extraSites: number;
  siteLimit: number;
};

const TONES: Record<PlanStatus["tone"], string> = { ok: "#1f9d63", warn: "#d97706", bad: "#c2334d", off: "#94a3b8" };
const smallCaps = { fontSize: 10.5, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8b88a3" } as const;

function Info({ id, company }: { id: PlanInfoKey; company: boolean }) {
  const info = planInfo(id, company);
  return <InfoButton title={info.title} text={info.text} who={info.who} />;
}

function Switch({ checked, onChange, name }: { checked: boolean; onChange: (next: boolean) => void; name: string }) {
  return (
    <span className="workbit-switch">
      <input type="checkbox" aria-label={name} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </span>
  );
}

function Stepper({ value, max, onChange, name }: { value: number; max: number; onChange: (next: number) => void; name: string }) {
  const button = {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid #ddd6fe",
    background: "#ffffff",
    color: "#4c1d95",
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
  } as const;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button type="button" style={button} aria-label={`Meno ${name}`} disabled={value <= 0} onClick={() => onChange(value - 1)}>
        −
      </button>
      <strong style={{ minWidth: 14, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</strong>
      <button type="button" style={button} aria-label={`Più ${name}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}

/** One extra: name and "i", a line under it, and on the right the control (web) or its state (app). */
function ExtraRow({
  info,
  company,
  sub,
  subOn,
  state,
  control,
}: {
  info: PlanInfoKey;
  company: boolean;
  sub: string;
  subOn: boolean;
  state: { on: boolean; text: string };
  control: ReactNode;
}) {
  const pill = {
    fontSize: 11.5,
    fontWeight: 850,
    padding: "3px 9px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    ...(state.on ? { background: "#dcf5e8", color: "#148a55" } : { background: "#f4f2fb", color: "#8b88a3" }),
  } as const;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid #f1eefa" }}>
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 15, color: "#17161f" }}>{planInfo(info, company).title}</strong>
          <Info id={info} company={company} />
        </span>
        <span className="wb-web-only" style={{ fontSize: 12, fontWeight: subOn ? 700 : 500, color: subOn ? "#146c43" : "#8b88a3" }}>
          {sub}
        </span>
      </span>
      {control ? (
        <>
          <span className="wb-web-only">{control}</span>
          <span className="wb-native-only" style={pill}>
            {state.text}
          </span>
        </>
      ) : (
        <span style={pill}>{state.text}</span>
      )}
    </div>
  );
}

export function PlanBilling({
  status,
  owned,
  company,
  purchase,
  canActivate,
  canCancel,
  trialSetupRequired,
  monthlyDiscountPercent,
}: {
  status: PlanStatus;
  owned: OwnedPlan;
  company: boolean;
  purchase: PurchaseProps | null;
  canActivate: boolean;
  canCancel: boolean;
  trialSetupRequired: boolean;
  monthlyDiscountPercent: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initial = normalizeSelection(purchase?.current ?? { ...owned, plan: owned.plan === "PRO" ? "PRO" : "BASE" }, company);
  const [selection, setSelection] = useState<PlanSelection>(initial);
  const [interval, setBillingInterval] = useState<CatalogInterval>(purchase?.interval ?? "MONTHLY");
  const [vat, setVat] = useState(purchase?.vatNumber ?? "");

  const editable = Boolean(purchase && !purchase.custom && !purchase.managed && (canActivate || purchase.live));
  const update = (patch: Partial<PlanSelection>) => setSelection((current) => normalizeSelection({ ...current, ...patch }, company));
  // The rows show and change the selection on the web, what the venue has in the app.
  const view = editable ? selection : initial;
  const pro = view.plan === "PRO";
  const ownedPro = owned.plan !== "BASE";
  const unit = interval === "MONTHLY" ? "/mese" : "/anno";

  const total = selectionTotalCents(selection, interval);
  const discount = monthlyDiscountPercent > 0 && interval === "MONTHLY" ? monthlyDiscountPercent : purchase?.sameVatDiscount ? 10 : 0;
  const net = Math.round(total * (1 - discount / 100));
  const unchanged = Boolean(purchase?.live) && interval === purchase?.interval && JSON.stringify(selection) === JSON.stringify(initial);

  function submit() {
    setError(null);
    start(async () => {
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
    start(async () => {
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

  const planCard = (plan: "BASE" | "PRO") => {
    const active = view.plan === plan;
    const yours = owned.plan === plan;
    const kind = plan === "PRO" ? "pro" : "base";
    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          aria-pressed={active}
          disabled={!editable}
          onClick={() => update({ plan })}
          style={{
            display: "grid",
            gap: 3,
            width: "100%",
            padding: "13px 40px 13px 14px",
            borderRadius: 18,
            border: active ? "2px solid #6d3df0" : "1px solid #e9e6f5",
            background: active ? "#faf7ff" : "#ffffff",
            textAlign: "left",
            font: "inherit",
            color: "inherit",
            cursor: editable ? "pointer" : "default",
            opacity: 1,
          }}
        >
          <span style={{ ...smallCaps, fontSize: 10, color: yours ? "#6d3df0" : "transparent" }}>Il tuo piano</span>
          <strong style={{ fontSize: 17, color: "#17161f" }}>{plan === "PRO" ? "Pro" : "Base"}</strong>
          <span className="wb-web-only" style={{ fontSize: 13, color: "#4c4670" }}>
            {formatEuro(PRICE_CENTS[kind][interval])}
            {unit}
          </span>
          <span style={{ fontSize: 12, color: "#8b88a3" }}>
            {plan === "PRO" ? (company ? "3 sedi, 45 persone" : "Tutto compreso") : company ? "Sede principale, 12 persone" : "12 persone"}
          </span>
        </button>
        <span style={{ position: "absolute", top: 12, right: 12 }}>
          <Info id={kind} company={company} />
        </span>
      </div>
    );
  };

  const rows: ReactNode[] = [];

  if (company) {
    const max = pro ? CATALOG_LIMITS.sitesOnPro - CATALOG_LIMITS.sitesIncludedInPro : CATALOG_LIMITS.paidSitesOnBase;
    rows.push(
      <ExtraRow
        key="sedi"
        info="sedi"
        company
        sub={`${pro ? "Oltre alle 3 del Pro" : "Oltre alla principale"} · ${formatEuro(PRICE_CENTS.sede[interval])} l'una`}
        subOn={false}
        state={{ on: owned.siteLimit > 1, text: `${owned.siteLimit} ${owned.siteLimit === 1 ? "sede" : "sedi"}` }}
        control={editable ? <Stepper name="sedi" value={view.extraSites} max={max} onChange={(extraSites) => update({ extraSites })} /> : null}
      />
    );
  } else {
    rows.push(
      <ExtraRow
        key="reparti"
        info="reparti"
        company={false}
        sub={pro ? "Compreso nel Pro" : `${owned.departments && !ownedPro ? "Attivo · " : ""}${formatEuro(PRICE_CENTS.reparti[interval])}`}
        subOn={pro || (owned.departments && !ownedPro)}
        state={{ on: owned.departments || ownedPro, text: ownedPro ? "Nel Pro" : owned.departments ? "Attivo" : "Non attivo" }}
        control={editable && !pro ? <Switch name="Reparti" checked={view.departments} onChange={(departments) => update({ departments })} /> : null}
      />
    );
  }

  if (company || !pro) {
    rows.push(
      <ExtraRow
        key="persone5"
        info="persone5"
        company={company}
        sub={`${owned.seatPacks > 0 ? `Ne hai ${owned.seatPacks} · ` : ""}${formatEuro(PRICE_CENTS.persone5[interval])} a pacchetto`}
        subOn={owned.seatPacks > 0}
        state={{ on: owned.seatPacks > 0, text: owned.seatPacks > 0 ? `+${owned.seatPacks * 5} persone` : "Non attivo" }}
        control={
          editable ? (
            <Stepper name="pacchetti" value={view.seatPacks} max={CATALOG_LIMITS.maxSeatPacks} onChange={(seatPacks) => update({ seatPacks })} />
          ) : null
        }
      />
    );
  } else {
    rows.push(
      <ExtraRow key="persone" info="persone5" company={false} sub="Senza limite nel Pro" subOn state={{ on: true, text: "Senza limite" }} control={null} />
    );
  }

  rows.push(
    <ExtraRow
      key="stile"
      info="stile"
      company={company}
      sub={pro ? "Compreso nel Pro" : `${owned.branding && !ownedPro ? "Attivo · " : ""}${formatEuro(PRICE_CENTS.stile[interval])}`}
      subOn={pro || (owned.branding && !ownedPro)}
      state={{ on: owned.branding || ownedPro, text: ownedPro ? "Nel Pro" : owned.branding ? "Attivo" : "Non attivo" }}
      control={editable && !pro ? <Switch name="Il tuo stile" checked={view.branding} onChange={(branding) => update({ branding })} /> : null}
    />
  );

  const buttonLabel = pending
    ? purchase?.live
      ? "Salvo…"
      : "Apro il pagamento…"
    : purchase?.live
      ? unchanged
        ? "Nessuna modifica"
        : "Salva modifiche"
      : trialSetupRequired
        ? "Inserisci il pagamento"
        : "Vai al pagamento";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13, color: "#6b6880" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#17161f" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: TONES[status.tone] }} />
          {status.label}
        </span>
        <span>{status.detail}</span>
      </div>

      {status.notice ? (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            fontSize: 13,
            lineHeight: 1.5,
            fontWeight: 650,
            ...(status.tone === "bad" ? { background: "#fff1f2", color: "#9f1239" } : { background: "#fff7ed", color: "#9a3412" }),
          }}
        >
          {status.notice}
        </div>
      ) : null}

      {owned.plan === "CUSTOM" ? (
        <div style={{ display: "grid", gap: 4, padding: 14, borderRadius: 18, border: "2px solid #6d3df0", background: "#faf7ff" }}>
          <span style={{ ...smallCaps, fontSize: 10, color: "#6d3df0" }}>Il tuo piano</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 17 }}>Su misura</strong>
            <Info id="custom" company={company} />
          </span>
          <span style={{ fontSize: 12.5, color: "#6b6880" }}>Deciso con Workbit: per cambiarlo scrivici.</span>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {planCard("BASE")}
            {planCard("PRO")}
          </div>
          <div style={{ display: "grid" }}>
            <span style={{ ...smallCaps, paddingBottom: 4 }}>Extra</span>
            {rows}
          </div>
        </>
      )}

      {editable ? (
        <div className="wb-web-only" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#4c4670" }}>Pagamento</span>
            <div
              style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: 999, background: "#f2f0fa" }}
            >
              {(["MONTHLY", "YEARLY"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={interval === value}
                  onClick={() => setBillingInterval(value)}
                  style={{
                    minHeight: 36,
                    borderRadius: 999,
                    border: 0,
                    background: interval === value ? "#ffffff" : "transparent",
                    boxShadow: interval === value ? "0 2px 8px rgba(60, 40, 140, 0.12)" : "none",
                    fontSize: 13,
                    fontWeight: interval === value ? 800 : 650,
                    color: interval === value ? "#17161f" : "#6b6880",
                    cursor: "pointer",
                  }}
                >
                  {value === "MONTHLY" ? "Mensile" : "Annuale · 2 mesi gratis"}
                </button>
              ))}
            </div>
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
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
        {owned.plan !== "CUSTOM" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4c4670" }}>
            Tante persone o sedi? Su misura
            <Info id="custom" company={company} />
          </span>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            className="wb-web-only"
            onClick={cancelSubscription}
            disabled={pending}
            style={{ border: 0, padding: 0, background: "none", color: "#b3202f", fontWeight: 750, fontSize: 13, cursor: "pointer" }}
          >
            Disattiva abbonamento
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          style={{ padding: "10px 12px", borderRadius: 14, background: "#fff1f2", border: "1px solid #fecdd3", color: "#b3202f", fontSize: 13.5, fontWeight: 700 }}
        >
          {error}
        </div>
      ) : null}

      {editable ? (
        <div
          className="wb-web-only"
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 0 4px",
            borderTop: "1px solid #ece9f6",
            background: "#ffffff",
          }}
        >
          <span style={{ flex: 1, display: "grid", gap: 1 }}>
            <strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
              {formatEuro(net)}
              {unit}
            </strong>
            <span style={{ fontSize: 11.5, color: "#8b88a3" }}>
              {discount ? `−${discount}% ${monthlyDiscountPercent > 0 && interval === "MONTHLY" ? "concordato" : "stessa partita IVA"} · ` : ""}
              Senza IVA
            </span>
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={pending || unchanged}
            style={{
              minHeight: 48,
              padding: "0 18px",
              borderRadius: 999,
              border: 0,
              fontSize: 14.5,
              fontWeight: 800,
              cursor: pending || unchanged ? "default" : "pointer",
              ...(unchanged
                ? { background: "#ece9f6", color: "#8b88a3" }
                : { background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)", color: "#ffffff" }),
            }}
          >
            {buttonLabel}
          </button>
        </div>
      ) : null}

      {/* In the installed app the plan is shown, not sold. */}
      <p className="wb-native-only" style={{ margin: 0, color: "#6b6880", lineHeight: 1.6, fontSize: 13 }}>
        L&apos;abbonamento del locale si gestisce dall&apos;area titolare di Workbit sul web.
      </p>
    </div>
  );
}
