"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Panel, PrimaryButton, TextInput } from "../ui";

export function PasswordChangePanel() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("La password deve avere almeno 6 caratteri.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || data?.ok !== true) {
        setError(data?.message || "Impossibile aggiornare la password.");
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password aggiornata.");
    } catch {
      setError("Impossibile aggiornare la password in questo momento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Cambia password">
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Nuova password</span>
            <TextInput
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Conferma password</span>
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        </div>

        {error ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p> : null}
        {success ? <p style={{ margin: 0, color: "#166534", fontSize: 14 }}>{success}</p> : null}

        <div className="dashboard-form-actions">
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Salvataggio..." : "Aggiorna password"}
          </PrimaryButton>
        </div>
      </form>
    </Panel>
  );
}
