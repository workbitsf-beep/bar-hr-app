"use client";

import { useState, type CSSProperties } from "react";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";

const group: CSSProperties = { background: "#f7f6fb", borderRadius: 18, overflow: "hidden" };
const line: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "0 16px", borderTop: "1px solid #ebe8f4", fontSize: 16, color: "#1f1b3a" };
const lineLabel: CSSProperties = { width: 92, flex: "0 0 auto" };
const input: CSSProperties = { flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 16, color: "#1f1b3a", padding: "14px 0", outline: "none" };
const caption: CSSProperties = { fontSize: 13, color: "#8a85a3", padding: "0 6px" };

/**
 * Who they are, what they do here, and - if the owner has it to hand - what
 * the payslips need: reparto, pay, and how the consultant knows them.
 * The person is sent an email with a password, and the form says so.
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
  const [department, setDepartment] = useState<string>(employeesOnly ? departments[0]?.id ?? "" : "");

  const roles = [
    { value: Role.EMPLOYEE, label: "Dipendente" },
    { value: Role.MANAGER, label: "Responsabile" },
    ...(isCompany ? [{ value: Role.AMMINISTRAZIONE, label: "Amministraz." }] : []),
    { value: Role.OWNER, label: "Titolare" },
  ];
  const place = isCompany ? "Sede" : "Reparto";
  const showDepartment = departments.length > (employeesOnly ? 1 : 0) && role !== Role.OWNER;

  return (
    <ActionForm action={action} success="Persona aggiunta." style={{ display: "grid", gap: 12 }}>
      <div style={group}>
        <label style={{ ...line, borderTop: 0 }}>
          <span style={lineLabel}>Nome</span>
          <input name="firstName" required autoComplete="off" autoCapitalize="words" style={input} />
        </label>
        <label style={line}>
          <span style={lineLabel}>Cognome</span>
          <input name="lastName" required autoComplete="off" autoCapitalize="words" style={input} />
        </label>
        <label style={line}>
          <span style={lineLabel}>Email</span>
          <input name="email" type="email" required autoComplete="off" autoCapitalize="none" inputMode="email" style={input} />
        </label>
      </div>

      <input type="hidden" name="role" value={role} />
      {employeesOnly ? null : (
        <>
          <span style={{ ...caption, marginTop: 4 }}>Cosa fa</span>
          <div style={{ display: "flex", background: "#eeebf7", borderRadius: 14, padding: 3 }}>
            {roles.map((option) => {
              const active = role === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRole(option.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 38,
                    border: 0,
                    borderRadius: 11,
                    background: active ? "#ffffff" : "transparent",
                    color: active ? "#1f1b3a" : "#5b5675",
                    fontSize: 14,
                    fontWeight: active ? 650 : 500,
                    boxShadow: active ? "0 1px 2px rgba(31,27,58,.08)" : "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {role === Role.MANAGER || role === Role.AMMINISTRAZIONE ? (
            <span style={caption}>Parte con i permessi di base: li cambi dalla sua scheda.</span>
          ) : null}
        </>
      )}

      {employeesOnly ? (
        <>
          <input type="hidden" name="department" value={department} />
          {showDepartment ? (
            <div style={group}>
              <label style={{ ...line, borderTop: 0 }}>
                <span style={lineLabel}>{place}</span>
                <select value={department} onChange={(event) => setDepartment(event.currentTarget.value)} style={{ ...input, appearance: "none", WebkitAppearance: "none" }}>
                  {departments.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18 }}>›</span>
              </label>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <span style={{ ...caption, marginTop: 4 }}>Per le buste paga · facoltativo</span>
          <div style={group}>
            {showDepartment ? (
              <label style={{ ...line, borderTop: 0 }}>
                <span style={lineLabel}>{place}</span>
                <select name="department" value={department} onChange={(event) => setDepartment(event.currentTarget.value)} style={{ ...input, appearance: "none", WebkitAppearance: "none", color: department ? "#1f1b3a" : "#b5b0c8" }}>
                  <option value="">Nessuno</option>
                  {departments.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18 }}>›</span>
              </label>
            ) : null}
            <label style={{ ...line, ...(showDepartment ? {} : { borderTop: 0 }) }}>
              <span style={lineLabel}>Paga oraria</span>
              <input name="hourlyRate" type="number" step="0.01" min="0" inputMode="decimal" placeholder="€ all'ora" style={input} />
            </label>
            <label style={line}>
              <span style={lineLabel}>Matricola</span>
              <input name="payrollCode" maxLength={30} autoComplete="off" autoCapitalize="characters" placeholder="o codice fiscale" style={input} />
            </label>
          </div>
          <span style={caption}>Il codice va nel file delle presenze per il consulente.</span>
        </>
      )}

      <input type="hidden" name="notifySuccess" value="1" />

      <PendingButton
        type="submit"
        pendingLabel="Aggiungo…"
        style={{ marginTop: 6, minHeight: 52, borderRadius: 999, border: 0, background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)", color: "#ffffff", fontSize: 16, fontWeight: 700, width: "100%", cursor: "pointer" }}
      >
        Aggiungi al locale
      </PendingButton>
      <span style={{ ...caption, textAlign: "center" }}>Riceve una mail con la password per entrare.</span>
    </ActionForm>
  );
}
