"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { SuccessCallout, TextInput } from "../ui";
import { useOverlayLock } from "../use-overlay-lock";

export function PasswordChangePanel() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  useOverlayLock(open);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword.trim()) {
      setError("Inserisci la password attuale.");
      return;
    }

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
        body: JSON.stringify({
          currentPassword,
          newPassword,
          requireCurrentPassword: true,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || data?.ok !== true) {
        setError(data?.message || "Impossibile aggiornare la password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password aggiornata.");
      setOpen(false);
    } catch {
      setError("Impossibile aggiornare la password in questo momento.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * The three fields, here, in the window that asked how you get in.
   *
   * They used to wait behind an "Aggiorna" button that opened a third modal
   * on top of the settings sheet - a window, inside a window, inside a page.
   */
  const field = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    autoComplete: string
  ) => (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 830,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#a3a0b8",
        }}
      >
        {label}
      </span>
      <TextInput
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
      />
    </label>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 11 }}>
      {success ? <SuccessCallout style={{ fontSize: 13 }}>{success}</SuccessCallout> : null}

      {field("Password attuale", currentPassword, setCurrentPassword, "current-password")}
      {field("Nuova", newPassword, setNewPassword, "new-password")}
      {field("Conferma", confirmPassword, setConfirmPassword, "new-password")}

      {error ? (
        <p
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 13,
            background: "#fdeef0",
            color: "#a8424f",
            fontSize: 12.5,
            fontWeight: 650,
            lineHeight: 1.45,
          }}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        style={{
          minHeight: 46,
          border: 0,
          borderRadius: 14,
          background: "linear-gradient(135deg, #3b1d8f 0%, #5e4ae3 55%, #8b5cf6 100%)",
          color: "#ffffff",
          font: "inherit",
          fontSize: 14.5,
          fontWeight: 820,
          boxShadow: "0 10px 22px rgba(94, 74, 227, 0.26)",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Salvo…" : "Cambia password"}
      </button>
    </form>
  );
}
