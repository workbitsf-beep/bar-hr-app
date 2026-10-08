"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DepartmentMode } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import type { SiteInfo } from "@/lib/departments";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { deleteSiteAction, saveSiteAction, updateDepartmentSettingsAction } from "./department-actions";

/**
 * A company's sites (Pro, or the Sedi extra on Base): one calendar split by
 * site or one per site, and for each site its name, address and the point
 * where its people clock in - set by standing there and pressing the button.
 */

type Status = { tone: "ok" | "error"; text: string } | null;

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  function run(action: (formData: FormData) => Promise<unknown>, formData: FormData, ok: string, done?: () => void) {
    setStatus(null);
    start(async () => {
      try {
        const result = await action(formData);
        if (isActionFailure(result)) {
          setStatus({ tone: "error", text: result.ruleError });
          return;
        }
        setStatus({ tone: "ok", text: ok });
        done?.();
        router.refresh();
      } catch (error) {
        setStatus({ tone: "error", text: describeActionError(error) });
      }
    });
  }
  return { pending, status, run };
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <span
      role="status"
      style={{
        padding: "9px 11px",
        borderRadius: 13,
        fontSize: 13.5,
        fontWeight: 800,
        ...(status.tone === "ok"
          ? { background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534" }
          : { background: "#fff1f2", border: "1px solid #fecdd3", color: "#b3202f" }),
      }}
    >
      {status.tone === "ok" ? "✓ " : ""}
      {status.text}
    </span>
  );
}

const fieldStyle = {
  width: "100%",
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  fontSize: 15,
  fontFamily: "inherit",
} as const;

function SiteCard({ site, count, onDone }: { site: SiteInfo | null; count: number; onDone?: () => void }) {
  const { pending, status, run } = useRun();
  const [confirm, setConfirm] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(saveSiteAction, new FormData(event.currentTarget), site ? "Sede salvata." : "Sede aggiunta.", onDone);
      }}
      style={{
        display: "grid",
        gap: 10,
        padding: 14,
        borderRadius: 18,
        border: "1px solid #ebe6f7",
        background: "#fff",
        borderLeft: site ? `5px solid ${site.ink}` : "1px dashed #c4b5fd",
      }}
    >
      {site ? <input type="hidden" name="slot" value={site.id} /> : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <strong style={{ fontSize: 15 }}>{site ? site.name : "Nuova sede"}</strong>
        {site ? <span style={{ fontSize: 12, color: "#8a84a8" }}>{count} persone</span> : null}
      </div>
      <input name="name" defaultValue={site?.name ?? ""} placeholder="Nome, per esempio Milano Centro" required maxLength={28} style={fieldStyle} />
      <input name="address" defaultValue={site?.address ?? ""} placeholder="Indirizzo" maxLength={160} style={fieldStyle} />
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>Dove si timbra</span>
        <GpsLocationField
          latitudeName="latitude"
          longitudeName="longitude"
          initialLatitude={site?.latitude ?? null}
          initialLongitude={site?.longitude ?? null}
        />
        <span style={{ fontSize: 12, color: "#8a84a8" }}>
          Premi il tasto stando nella sede: le persone di questa sede timbrano solo lì.
        </span>
      </div>
      <StatusLine status={status} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={pending}
          style={{ height: 42, padding: "0 16px", borderRadius: 14, border: 0, background: "#6d3df0", color: "#fff", fontWeight: 850, fontSize: 14, cursor: "pointer" }}
        >
          {pending ? "Salvo…" : site ? "Salva sede" : "Aggiungi sede"}
        </button>
        {site ? (
          confirm ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const formData = new FormData();
                formData.set("slot", site.id);
                run(deleteSiteAction, formData, "Sede tolta.");
              }}
              style={{ height: 42, padding: "0 14px", borderRadius: 14, border: 0, background: "#dc2626", color: "#fff", fontWeight: 850, fontSize: 14, cursor: "pointer" }}
            >
              Sì, togli {site.name}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              style={{ height: 42, padding: "0 14px", borderRadius: 14, border: "1px solid #fecdd3", background: "#fff", color: "#b3202f", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
            >
              Togli sede
            </button>
          )
        ) : null}
      </div>
      {confirm && site ? (
        <span style={{ fontSize: 12.5, color: "#8a84a8" }}>
          Le persone di {site.name} restano nell&apos;azienda senza sede, e i turni da oggi in poi non hanno più sede.
        </span>
      ) : null}
    </form>
  );
}

export function SitesForm({
  sites,
  limit,
  mode,
  counts,
}: {
  sites: SiteInfo[];
  limit: number;
  mode: DepartmentMode;
  counts: Record<string, number>;
}) {
  const [current, setCurrent] = useState<DepartmentMode>(mode);
  const [adding, setAdding] = useState(sites.length === 0);
  const { pending, status, run } = useRun();
  const options: Array<{ value: DepartmentMode; title: string; lead: string }> = [
    { value: "UNIFIED", title: "Un calendario unico", lead: "La settimana di sempre, con i filtri per sede" },
    { value: "SEPARATE", title: "Un calendario per sede", lead: "Ogni responsabile di sede gestisce la sua" },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>Come vuoi i turni</span>
        {options.map((option) => {
          const active = current === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => {
                setCurrent(option.value);
                const formData = new FormData();
                formData.set("mode", option.value);
                run(updateDepartmentSettingsAction, formData, "Salvato.");
              }}
              style={{
                display: "grid",
                gap: 2,
                padding: "12px 13px",
                borderRadius: 16,
                border: active ? "2px solid #6d3df0" : "1px solid #e9e6f5",
                background: active ? "#faf7ff" : "#ffffff",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <strong style={{ fontSize: 14, color: "#17161f" }}>{option.title}</strong>
              <span style={{ fontSize: 12, color: "#8a84a8" }}>{option.lead}</span>
            </button>
          );
        })}
        <StatusLine status={status} />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>
          Le sedi · {sites.length} su {limit}
        </span>
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} count={counts[site.id] ?? 0} />
        ))}
        {sites.length < limit ? (
          adding ? (
            <SiteCard site={null} count={0} onDone={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{ height: 46, borderRadius: 16, border: "1.5px dashed #c4b5fd", background: "#faf8ff", color: "#6d3df0", fontWeight: 850, fontSize: 14.5, cursor: "pointer" }}
            >
              + Aggiungi una sede
            </button>
          )
        ) : (
          <span style={{ fontSize: 12.5, color: "#8a84a8" }}>
            {limit >= 6 ? "Il Pro arriva a 6 sedi." : "Con l'extra Sedi arrivi a 3 sedi; il Pro ne comprende fino a 6."}
          </span>
        )}
      </div>
    </div>
  );
}
