"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createBarBySuperAdminAction, createOwnerBySuperAdminAction } from "../actions";
import { PrimaryButton, Select, TextInput } from "../ui";

type OwnerOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ModalType = "owner" | "bar" | null;

export function SuperAdminHomeCreateActions({ owners }: { owners: OwnerOption[] }) {
  const [mounted, setMounted] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!modal) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [modal]);

  function close() {
    setModal(null);
  }

  return (
    <>
      <div className="sa-quick-actions">
        <button type="button" onClick={() => setModal("bar")}>
          + Nuova attività
        </button>
        <button type="button" onClick={() => setModal("owner")}>
          + Nuovo titolare
        </button>
      </div>

      {mounted && modal
        ? createPortal(
            <div
              role="presentation"
              onClick={close}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483647,
                display: "grid",
                placeItems: "center",
                padding: 16,
                background: "rgba(15, 23, 42, 0.30)",
                backdropFilter: "blur(10px)",
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label={modal === "owner" ? "Nuovo titolare" : "Nuova attività"}
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(92vw, 520px)",
                  maxHeight: "calc(100dvh - 32px)",
                  overflowY: "auto",
                  borderRadius: 28,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.24)",
                  padding: 20,
                  display: "grid",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <strong style={{ color: "#0f172a", fontSize: 22 }}>
                    {modal === "owner" ? "Nuovo titolare" : "Nuova attività"}
                  </strong>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Chiudi"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#0f172a",
                      fontSize: 18,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    X
                  </button>
                </div>

                {modal === "owner" ? (
                  <form action={createOwnerBySuperAdminAction} style={{ display: "grid", gap: 14 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 12,
                      }}
                    >
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Nome</span>
                        <TextInput name="firstName" required />
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Cognome</span>
                        <TextInput name="lastName" required />
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Email</span>
                        <TextInput name="email" type="email" required />
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Lingua</span>
                        <Select name="language" defaultValue="it">
                          <option value="it">Italiano</option>
                          <option value="en">English</option>
                          <option value="es">Espanol</option>
                          <option value="fr">Francais</option>
                        </Select>
                      </label>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <PrimaryButton type="button" tone="sand" onClick={close}>
                        Annulla
                      </PrimaryButton>
                      <PrimaryButton type="submit">Crea titolare</PrimaryButton>
                    </div>
                  </form>
                ) : (
                  <form action={createBarBySuperAdminAction} style={{ display: "grid", gap: 14 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 12,
                      }}
                    >
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Nome attività</span>
                        <TextInput name="name" required />
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Categoria</span>
                        <Select name="activityType" defaultValue="RESTAURANT">
                          <option value="RESTAURANT">Ristorazione</option>
                          <option value="COMPANY">Azienda</option>
                        </Select>
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Titolare</span>
                        <Select name="ownerId" required defaultValue="">
                          <option value="" disabled>
                            Seleziona titolare
                          </option>
                          {owners.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.firstName} {owner.lastName}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Email attività</span>
                        <TextInput name="email" type="email" />
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Telefono</span>
                        <TextInput name="phone" />
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Città</span>
                        <TextInput name="city" />
                      </label>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <PrimaryButton type="button" tone="sand" onClick={close}>
                        Annulla
                      </PrimaryButton>
                      <PrimaryButton type="submit" disabled={owners.length === 0}>
                        Crea attività
                      </PrimaryButton>
                    </div>
                  </form>
                )}
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
