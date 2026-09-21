"use client";

import { useFormStatus } from "react-dom";
import { createEmployeeBySuperAdminAction } from "../../actions";

const inputStyle = {
  borderRadius: 14,
  border: "1px solid #dbe3ee",
  padding: "13px 14px",
  fontSize: 15,
  background: "#ffffff",
  color: "#0f172a",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        borderRadius: 999,
        border: "none",
        padding: "13px 20px",
        fontSize: 14.5,
        fontWeight: 800,
        color: "#ffffff",
        background: "linear-gradient(135deg, #7b2ff7, #a855f7)",
        cursor: pending ? "progress" : "pointer",
        opacity: pending ? 0.75 : 1,
        width: "100%",
      }}
    >
      {pending ? "Creazione in corso..." : "Crea o collega account"}
    </button>
  );
}

export function AddEmployeeForm({ barId, isCompany }: { barId: string; isCompany: boolean }) {
  return (
    <form action={createEmployeeBySuperAdminAction} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="barId" value={barId} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <input name="firstName" required placeholder="Nome" style={inputStyle} />
        <input name="lastName" required placeholder="Cognome" style={inputStyle} />
        <input name="email" type="email" required placeholder="Email" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
        <select name="role" defaultValue="EMPLOYEE" style={inputStyle}>
          <option value="EMPLOYEE">Dipendente</option>
          <option value="MANAGER">Responsabile</option>
          <option value="OWNER">Titolare aggiuntivo</option>
          {isCompany ? <option value="AMMINISTRAZIONE">Amministrazione</option> : null}
        </select>
        <input name="hourlyRate" type="number" step="0.01" placeholder="Paga oraria (facoltativa)" style={inputStyle} />
      </div>
      <SubmitButton />
    </form>
  );
}
