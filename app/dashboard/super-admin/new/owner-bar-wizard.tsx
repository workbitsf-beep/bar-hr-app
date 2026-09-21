"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { createOwnerAndBarBySuperAdminAction } from "../../actions";
import { AdditionalOwnersPicker } from "../additional-owners-picker";

type OwnerOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  borderRadius: 14,
  border: "1px solid #dbe3ee",
  padding: "13px 14px",
  fontSize: 15,
  background: "#ffffff",
  color: "#0f172a",
};

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        borderRadius: 999,
        border: "none",
        padding: "14px 22px",
        fontSize: 15,
        fontWeight: 800,
        color: "#ffffff",
        background: pending
          ? "linear-gradient(135deg, #5b21b6, #7b2ff7)"
          : "linear-gradient(135deg, #7b2ff7, #a855f7)",
        cursor: pending ? "progress" : "pointer",
        opacity: pending ? 0.75 : 1,
        boxShadow: "0 14px 30px rgba(123, 47, 247, 0.32)",
        width: "100%",
      }}
    >
      {pending ? "Creazione in corso..." : children}
    </button>
  );
}

export function OwnerBarWizard({ owners }: { owners: OwnerOption[] }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [ownerMode, setOwnerMode] = useState<"new" | "existing">("new");
  const [existingOwnerId, setExistingOwnerId] = useState("");
  const [additionalOwnerIds, setAdditionalOwnerIds] = useState<string[]>([]);
  const [additionalDraftId, setAdditionalDraftId] = useState("");

  const canGoToStep2 = ownerMode === "existing" ? Boolean(existingOwnerId) : true;

  return (
    <form action={createOwnerAndBarBySuperAdminAction} style={{ display: "grid", gap: 22 }}>
      <input type="hidden" name="ownerMode" value={ownerMode} />

      <div className="sa-wizard-steps">
        <span className={`sa-wizard-step ${step === 1 ? "sa-wizard-step-active" : "sa-wizard-step-done"}`}>
          <span className="sa-wizard-step-dot">1</span> Titolare
        </span>
        <span className="sa-wizard-step-line" />
        <span className={`sa-wizard-step ${step === 2 ? "sa-wizard-step-active" : ""}`}>
          <span className="sa-wizard-step-dot">2</span> Locale
        </span>
      </div>

      <div style={{ display: step === 1 ? "grid" : "none", gap: 16 }}>
        <div className="sa-wizard-toggle">
          <button
            type="button"
            className={ownerMode === "new" ? "sa-wizard-toggle-active" : ""}
            onClick={() => setOwnerMode("new")}
          >
            Nuovo titolare
          </button>
          <button
            type="button"
            className={ownerMode === "existing" ? "sa-wizard-toggle-active" : ""}
            onClick={() => setOwnerMode("existing")}
          >
            Titolare esistente
          </button>
        </div>

        {ownerMode === "new" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <Field label="Nome">
              <input name="firstName" required style={inputStyle} placeholder="Mario" />
            </Field>
            <Field label="Cognome">
              <input name="lastName" required style={inputStyle} placeholder="Rossi" />
            </Field>
            <Field label="Email">
              <input
                name="email_owner"
                type="email"
                required
                style={{ ...inputStyle, gridColumn: "1 / -1" }}
                placeholder="titolare@email.it"
              />
            </Field>
          </div>
        ) : (
          <Field label="Seleziona titolare">
            <select
              name="existingOwnerId"
              required
              value={existingOwnerId}
              onChange={(event) => setExistingOwnerId(event.target.value)}
              style={inputStyle}
            >
              <option value="">Scegli un titolare</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName} · {owner.email}
                </option>
              ))}
            </select>
          </Field>
        )}

        <button
          type="button"
          disabled={!canGoToStep2}
          onClick={() => setStep(2)}
          style={{
            justifySelf: "end",
            borderRadius: 999,
            border: "none",
            padding: "12px 20px",
            fontSize: 14.5,
            fontWeight: 800,
            color: "#ffffff",
            background: canGoToStep2 ? "#7b2ff7" : "rgba(123,47,247,0.35)",
            cursor: canGoToStep2 ? "pointer" : "not-allowed",
          }}
        >
          Avanti: locale →
        </button>
      </div>

      <div style={{ display: step === 2 ? "grid" : "none", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Nome locale/azienda">
            <input name="name" required style={inputStyle} placeholder="Bar Centrale" />
          </Field>
          <Field label="Tipo attività">
            <select name="activityType" defaultValue="RESTAURANT" style={inputStyle}>
              <option value="RESTAURANT">Ristorazione</option>
              <option value="COMPANY">Azienda</option>
            </select>
          </Field>
          <Field label="Email locale (opzionale)">
            <input name="email" type="email" style={inputStyle} placeholder="info@locale.it" />
          </Field>
          <Field label="Telefono (opzionale)">
            <input name="phone" style={inputStyle} placeholder="+39 ..." />
          </Field>
          <Field label="Indirizzo (opzionale)">
            <input name="addressLine1" style={inputStyle} placeholder="Via Roma 1" />
          </Field>
          <Field label="Città (opzionale)">
            <input name="city" style={inputStyle} placeholder="Milano" />
          </Field>
          <Field label="CAP (opzionale)">
            <input name="postalCode" style={inputStyle} placeholder="20100" />
          </Field>
        </div>

        <AdditionalOwnersPicker
          owners={owners}
          excludeOwnerId={ownerMode === "existing" ? existingOwnerId : ""}
          selectedIds={additionalOwnerIds}
          onChange={setAdditionalOwnerIds}
          draftId={additionalDraftId}
          onDraftChange={setAdditionalDraftId}
          emitHiddenInputs
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setStep(1)}
            style={{
              borderRadius: 999,
              border: "1px solid #dbe3ee",
              padding: "12px 20px",
              fontSize: 14.5,
              fontWeight: 700,
              color: "#334155",
              background: "#f8fafc",
              cursor: "pointer",
            }}
          >
            ← Indietro
          </button>
          <div style={{ flex: "1 1 220px" }}>
            <SubmitButton>Crea titolare e locale</SubmitButton>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sa-wizard-steps {
              display: flex;
              align-items: center;
              gap: 10px;
            }

            .sa-wizard-step {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              font-size: 13px;
              font-weight: 700;
              color: #94a3b8;
            }

            .sa-wizard-step-active,
            .sa-wizard-step-done {
              color: #0f172a;
            }

            .sa-wizard-step-dot {
              width: 24px;
              height: 24px;
              border-radius: 999px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              background: #eef1f8;
              color: #64748b;
            }

            .sa-wizard-step-active .sa-wizard-step-dot,
            .sa-wizard-step-done .sa-wizard-step-dot {
              background: #7b2ff7;
              color: #ffffff;
            }

            .sa-wizard-step-line {
              flex: 1;
              height: 1px;
              background: #e2e8f0;
            }

            .sa-wizard-toggle {
              display: inline-flex;
              padding: 4px;
              border-radius: 999px;
              background: #f1f5f9;
              border: 1px solid #e2e8f0;
              width: fit-content;
            }

            .sa-wizard-toggle button {
              border: none;
              background: transparent;
              color: #64748b;
              font-size: 13.5px;
              font-weight: 700;
              padding: 9px 16px;
              border-radius: 999px;
              cursor: pointer;
            }

            .sa-wizard-toggle-active {
              background: #7b2ff7 !important;
              color: #ffffff !important;
            }
          `,
        }}
      />
    </form>
  );
}
