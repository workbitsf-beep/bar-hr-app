"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createOwnerBySuperAdminAction } from "../../actions";
import {
  EmptyState,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  TextInput,
} from "../../ui";

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

function StatusBanner({
  kind,
  text,
}: {
  kind: "success" | "warning" | "error";
  text: string;
}) {
  const palette =
    kind === "success"
      ? { background: "#f0fdf4", border: "#bbf7d0", color: "#166534" }
      : kind === "warning"
        ? { background: "#fff7ed", border: "#fed7aa", color: "#c2410c" }
        : { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" };

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <Panel
        title="Titolari"
        action={
          <PrimaryButton type="button" onClick={() => setOpen(true)}>
            +
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
                <span style={{ fontWeight: 600, color: "#1e293b" }}>Cerca titolare</span>
                <TextInput name="q" defaultValue={query} placeholder="Nome, email o locale" />
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <PrimaryButton type="submit">Cerca</PrimaryButton>
                <Link
                  href="/dashboard/super-admin/owners"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    padding: "12px 16px",
                    textDecoration: "none",
                    background: "#f8fafc",
                    color: "#0f172a",
                    border: "1px solid #e2e8f0",
                    fontWeight: 700,
                  }}
                >
                  Reset
                </Link>
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

      {mounted && open
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483646,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <button
                type="button"
                aria-label="Chiudi popup nuovo titolare"
                onClick={() => setOpen(false)}
                style={{
                  position: "absolute",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.28)",
                  backdropFilter: "blur(6px)",
                }}
              />

              <section
                style={{
                  position: "relative",
                  width: "min(92vw, 520px)",
                  maxHeight: "calc(100dvh - 32px)",
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 28,
                  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  padding: 22,
                  display: "grid",
                  gap: 18,
                  zIndex: 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <strong style={{ fontSize: 22, color: "#0f172a" }}>Nuovo titolare</strong>

                  <button
                    type="button"
                    aria-label="Chiudi"
                    onClick={() => setOpen(false)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#0f172a",
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    X
                  </button>
                </div>

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
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
