"use client";

import { useState } from "react";
import { createOwnerBySuperAdminAction } from "../../actions";
import { ModalShell } from "../../modal-shell";
import { PrimaryButton, Select, StatusBanner, TextInput } from "../light-ui";
import { useOverlayLock } from "../../use-overlay-lock";

type OwnerItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  ownedBars: {
    id: string;
    name: string;
    activityType: "RESTAURANT" | "COMPANY";
  }[];
};

function getActivityLabel(activityType: OwnerItem["ownedBars"][number]["activityType"]) {
  return activityType === "COMPANY" ? "Azienda" : "Ristorazione";
}

export function OwnersManager({
  owners,
  query,
  error,
  success,
}: {
  owners: OwnerItem[];
  query: string;
  error?: string;
  success?: string;
}) {
  const [open, setOpen] = useState(false);
  useOverlayLock(open);

  return (
    <>
      <div style={{ display: "grid", gap: 16 }}>
        <form method="GET" className="sa-search">
          <span className="sa-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input name="q" type="search" defaultValue={query} placeholder="Nome, email o attività" />
        </form>

        <div className="sa-row-head">
          <span className="sa-section-title">Titolari · {owners.length}</span>
          <button type="button" className="sa-pill-btn" onClick={() => setOpen(true)}>
            + Nuovo
          </button>
        </div>

        {error === "owner-exists" ? (
          <StatusBanner kind="error" text="Esiste già un titolare con questa email. Usa un indirizzo diverso." />
        ) : null}
        {success === "owner-created" ? (
          <StatusBanner kind="success" text="Titolare creato correttamente. La welcome email è stata inviata." />
        ) : null}
        {success === "owner-created-email-failed" ? (
          <StatusBanner
            kind="warning"
            text="Titolare creato, ma la welcome email non è partita. Controlla Resend e il dominio mittente."
          />
        ) : null}

        {owners.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 14 }}>Nessun titolare trovato.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {owners.map((owner) => (
              <div key={owner.id} className="sa-card">
                <strong style={{ fontSize: 14.5 }}>{owner.firstName} {owner.lastName}</strong>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>{owner.email}</span>
                {owner.ownedBars.length > 0 ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {owner.ownedBars.map((bar) => (
                      <span key={bar.id} className="sa-badge">
                        {getActivityLabel(bar.activityType)} · {bar.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: "#98a2b3", fontSize: 12.5, marginTop: 2 }}>Nessuna attività collegata</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Nuovo titolare"
        wrapClassName="sa-modal-wrap"
        panelClassName="sa-modal-panel"
      >
        <form action={createOwnerBySuperAdminAction} style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>Nome</span>
              <TextInput name="firstName" required />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>Cognome</span>
              <TextInput name="lastName" required />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>Email</span>
              <TextInput name="email" type="email" required />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>Lingua</span>
              <Select name="language" defaultValue="it">
                <option value="it">Italiano</option>
                <option value="en">English</option>
                <option value="es">Espanol</option>
                <option value="fr">Francais</option>
              </Select>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <PrimaryButton type="button" tone="sand" onClick={() => setOpen(false)}>
              Annulla
            </PrimaryButton>
            <PrimaryButton type="submit">Crea titolare</PrimaryButton>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
