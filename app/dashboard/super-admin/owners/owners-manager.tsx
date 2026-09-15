"use client";

import { useState } from "react";
import { createOwnerBySuperAdminAction } from "../../actions";
import { ModalShell } from "../../modal-shell";
import {
  EmptyState,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  ResetLink,
  Select,
  StatusBanner,
  TextInput,
} from "../../ui";
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
      <Panel
        title={`Titolari (${owners.length})`}
        action={
          <PrimaryButton
            type="button"
            onClick={() => setOpen(true)}
            style={{ borderRadius: 999, paddingInline: 16, whiteSpace: "nowrap" }}
          >
            + Nuovo
          </PrimaryButton>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <form method="GET" style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 10,
                alignItems: "end",
              }}
            >
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 700, color: "#344054" }}>Trova un titolare</span>
                <TextInput name="q" defaultValue={query} placeholder="Nome, email o attivita" />
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <PrimaryButton type="submit">Cerca</PrimaryButton>
                <ResetLink href="/dashboard/super-admin/owners" />
              </div>
            </div>
          </form>

          {error === "owner-exists" ? (
            <StatusBanner
              kind="error"
              text="Esiste gia un titolare con questa email. Usa un indirizzo diverso."
            />
          ) : null}
          {success === "owner-created" ? (
            <StatusBanner kind="success" text="Titolare creato correttamente. La welcome email e stata inviata." />
          ) : null}
          {success === "owner-created-email-failed" ? (
            <StatusBanner
              kind="warning"
              text="Titolare creato, ma la welcome email non e partita. Controlla Resend e il dominio mittente."
            />
          ) : null}

          {owners.length === 0 ? (
            <EmptyState message="Nessun titolare presente al momento." />
          ) : (
            <ItemList scrollable maxHeight={540}>
              {owners.map((owner) => (
                <ItemCard
                  key={owner.id}
                  title={`${owner.firstName} ${owner.lastName}`}
                  subtitle={owner.email}
                  meta={`Attivita collegate: ${owner.ownedBars.length}`}
                  footer={
                    owner.ownedBars.length > 0 ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {owner.ownedBars.map((bar) => (
                          <span
                            key={bar.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              borderRadius: 999,
                              padding: "6px 10px",
                              fontSize: 12,
                              fontWeight: 700,
                              background: "#e2e8f0",
                              color: "#475569",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {getActivityLabel(bar.activityType)} - {bar.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: 13 }}>Nessuna attivita collegata</span>
                    )
                  }
                />
              ))}
            </ItemList>
          )}
        </div>
      </Panel>

      <ModalShell open={open} onClose={() => setOpen(false)} title="Nuovo titolare">
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
