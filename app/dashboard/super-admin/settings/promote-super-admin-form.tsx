"use client";

import { useFormStatus } from "react-dom";
import { promoteToSuperAdminAction } from "../../actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        borderRadius: 999,
        border: "none",
        padding: "12px 20px",
        fontSize: 14,
        fontWeight: 800,
        color: "#ffffff",
        background: "linear-gradient(135deg, #7b2ff7, #a855f7)",
        cursor: pending ? "progress" : "pointer",
        opacity: pending ? 0.75 : 1,
      }}
    >
      {pending ? "..." : "Rendi super admin"}
    </button>
  );
}

export function PromoteSuperAdminForm() {
  return (
    <form
      action={promoteToSuperAdminAction}
      onSubmit={(event) => {
        const email = new FormData(event.currentTarget).get("email");
        if (!window.confirm(`Rendere "${email}" super admin? Avrà accesso completo alla console.`)) {
          event.preventDefault();
        }
      }}
      style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
    >
      <input
        name="email"
        type="email"
        required
        placeholder="email@esempio.it"
        style={{
          flex: "1 1 220px",
          borderRadius: 14,
          border: "1px solid #dbe3ee",
          padding: "12px 14px",
          fontSize: 15,
          background: "#ffffff",
          color: "#0f172a",
        }}
      />
      <SubmitButton />
    </form>
  );
}
