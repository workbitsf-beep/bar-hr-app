"use client";

import { useFormStatus } from "react-dom";
import { promoteToSuperAdminAction } from "../../actions";
import { Field } from "../console-ui";

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="wbc-btn wbc-btn-ghost" disabled={pending}>
      {pending ? "Promozione…" : "Rendi super admin"}
    </button>
  );
}

export function PromoteSuperAdminForm() {
  return (
    <form
      action={promoteToSuperAdminAction}
      style={{ display: "grid", gap: 14 }}
      onSubmit={(event) => {
        const email = new FormData(event.currentTarget).get("email");

        if (!window.confirm(`Dare i permessi di super admin a ${String(email || "questo account")}?`)) {
          event.preventDefault();
        }
      }}
    >
      <Field label="Email dell'account" hint="L'account deve già esistere in Workbit.">
        <input name="email" type="email" required autoComplete="off" placeholder="nome@esempio.it" />
      </Field>

      <Submit />
    </form>
  );
}
