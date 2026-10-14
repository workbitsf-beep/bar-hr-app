"use client";

import { useState } from "react";
import { ActionForm } from "@/app/components/action-form";
import { setRestaurantDivisionAction } from "../department-actions";
import { PrimaryButton } from "../ui";

type Division = "departments" | "sites";

const OPTIONS: Array<{ value: Division; title: string; lead: string }> = [
  {
    value: "departments",
    title: "Reparti",
    lead: "Banco, cucina e sala in un solo locale",
  },
  {
    value: "sites",
    title: "Sedi",
    lead: "Più punti vendita con la stessa insegna e gli stessi dati fiscali. Ognuno con il suo punto di timbratura",
  },
];

/**
 * Settings › Reparti o sedi, for a restaurant on Pro. A place with another
 * name is another venue, not a site: said here, since it decides the choice.
 */
export function RestaurantDivisionForm({ current }: { current: Division }) {
  const [choice, setChoice] = useState<Division>(current);
  const changing = choice !== current;

  return (
    <ActionForm
      action={setRestaurantDivisionAction}
      success={choice === "sites" ? "Ora il locale è diviso per sedi." : "Ora il locale è diviso per reparti."}
      style={{ display: "grid", gap: 14 }}
    >
      <input type="hidden" name="division" value={choice} />
      <div style={{ display: "grid", gap: 8 }}>
        {OPTIONS.map((option) => {
          const active = choice === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setChoice(option.value)}
              style={{
                display: "grid",
                gap: 2,
                padding: "12px 14px",
                borderRadius: 16,
                border: active ? "2px solid #6d3df0" : "1px solid #e9e6f5",
                background: active ? "#faf7ff" : "#ffffff",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <strong style={{ fontSize: 15, color: "#17161f" }}>{option.title}</strong>
              <span style={{ fontSize: 12.5, color: "#6b6880", lineHeight: 1.4 }}>{option.lead}</span>
            </button>
          );
        })}
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "#4c4670", lineHeight: 1.5 }}>
        Un locale con un altro nome non è una sede: è un&apos;altra attività. Si aggiunge come nuovo locale, con il 10%
        di sconto.
      </p>

      {changing ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 14,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          Cambiando, le persone, i turni dei prossimi giorni e le checklist perdono{" "}
          {choice === "sites" ? "il reparto" : "la sede"}: li riassegni dopo. I turni passati restano com&apos;erano.
        </p>
      ) : null}

      <PrimaryButton type="submit" disabled={!changing} pendingLabel="Salvo…" style={{ minHeight: 48 }}>
        {changing ? `Dividi per ${choice === "sites" ? "sedi" : "reparti"}` : "Nessun cambiamento"}
      </PrimaryButton>
    </ActionForm>
  );
}
