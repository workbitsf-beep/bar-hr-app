"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import { FormField, PrimaryButton, TextInput } from "../ui";
import { ActionForm } from "@/app/components/action-form";

/**
 * Who they are, and what they do here.
 *
 * The form used to end on "Crea o collega account", which is the name this has
 * in the code, and said nothing about what happens next - the person is sent
 * an email with a password, and nobody reading the form could know it.
 */
export function NewPersonForm({
  action,
  isCompany,
  employeesOnly = false,
  departments = [],
}: {
  action: (formData: FormData) => Promise<unknown>;
  isCompany: boolean;
  /** Staff with "Persone": they add employees, in the departments they cover. */
  employeesOnly?: boolean;
  departments?: Array<{ id: string; name: string }>;
}) {
  const [role, setRole] = useState<string>(Role.EMPLOYEE);
  const [department, setDepartment] = useState<string>(departments[0]?.id ?? "");
  const [showRate, setShowRate] = useState(false);

  const roles = [
    { value: Role.EMPLOYEE, label: "Dipendente" },
    { value: Role.MANAGER, label: "Responsabile" },
    ...(isCompany ? [{ value: Role.AMMINISTRAZIONE, label: "Amministrazione" }] : []),
    { value: Role.OWNER, label: "Titolare" },
  ];

  return (
    <ActionForm action={action} success="Persona aggiunta." style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <FormField label="Nome">
          <TextInput name="firstName" required />
        </FormField>
        <FormField label="Cognome">
          <TextInput name="lastName" required />
        </FormField>
      </div>

      <FormField label="Email">
        <TextInput name="email" type="email" required />
      </FormField>

      {employeesOnly && departments.length > 1 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>{isCompany ? "Sede" : "Reparto"}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {departments.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={department === option.id}
                onClick={() => setDepartment(option.id)}
                style={{
                  minHeight: 38,
                  padding: "0 13px",
                  borderRadius: 999,
                  border: department === option.id ? "1px solid rgba(124, 58, 237, 0.46)" : "1px solid #e2e8f0",
                  background: department === option.id ? "#f3e8ff" : "#ffffff",
                  color: department === option.id ? "#4c1d95" : "#475569",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {employeesOnly ? <input type="hidden" name="department" value={department} /> : null}

      <div style={{ display: employeesOnly ? "none" : "grid", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>Cosa fa qui</span>
        <input type="hidden" name="role" value={role} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {roles.map((option) => {
            const active = role === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                style={{
                  minHeight: 38,
                  padding: "0 13px",
                  borderRadius: 999,
                  border: active ? "1px solid rgba(124, 58, 237, 0.46)" : "1px solid #e2e8f0",
                  background: active ? "#f3e8ff" : "#ffffff",
                  color: active ? "#4c1d95" : "#475569",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {role === Role.MANAGER || role === Role.AMMINISTRAZIONE ? (
          <span style={{ fontSize: 12, color: "#8a84a8" }}>
            Parte con i permessi di base: li cambi dalla sua scheda nel Team.
          </span>
        ) : null}
      </div>

      {employeesOnly ? null : showRate ? (
        <FormField label="Paga oraria">
          <TextInput name="hourlyRate" type="number" step="0.01" />
        </FormField>
      ) : (
        <button
          type="button"
          onClick={() => setShowRate(true)}
          style={{
            justifySelf: "start",
            padding: "10px 13px",
            borderRadius: 14,
            border: "1px dashed #cbd5e1",
            background: "transparent",
            color: "#64748b",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ＋ Aggiungi la paga oraria
        </button>
      )}

      <input type="hidden" name="notifySuccess" value="1" />

      <PrimaryButton type="submit">Aggiungi al locale</PrimaryButton>

      <span
        style={{
          color: "#94a3b8",
          fontSize: 12.5,
          fontWeight: 700,
          lineHeight: 1.5,
          textAlign: "center",
        }}
      >
        Riceverà una mail con la password per il primo accesso.
      </span>
    </ActionForm>
  );
}
