"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Panel, PrimaryButton, SuccessCallout, TextInput } from "../ui";

export function PasswordChangePanel() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

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

  function closeModal() {
    if (loading) {
      return;
    }

    setOpen(false);
  }

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

  return (
    <>
      <Panel
        title="Aggiorna password"
        action={
          <PrimaryButton type="button" onClick={() => setOpen(true)}>
            Aggiorna
          </PrimaryButton>
        }
      >
        {success ? <SuccessCallout style={{ fontSize: 14 }}>{success}</SuccessCallout> : null}
      </Panel>

      {mounted && open
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483647,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <button
                type="button"
                aria-label="Chiudi popup password"
                onClick={closeModal}
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
                  <strong style={{ fontSize: 22, color: "#0f172a" }}>Aggiorna password</strong>

                  <button
                    type="button"
                    aria-label="Chiudi"
                    onClick={closeModal}
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

                <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Password attuale</span>
                      <TextInput
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                      />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Nuova password</span>
                      <TextInput
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                      />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Conferma password</span>
                      <TextInput
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                      />
                    </label>
                  </div>

                  {error ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p> : null}

                  <div className="dashboard-form-actions">
                    <PrimaryButton type="button" tone="sand" onClick={closeModal} disabled={loading}>
                      Annulla
                    </PrimaryButton>
                    <PrimaryButton type="submit" disabled={loading}>
                      {loading ? "Salvataggio..." : "Salva password"}
                    </PrimaryButton>
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
