"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

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
        | { ok?: boolean; message?: string; redirectTo?: string }
        | null;

      if (!response.ok || data?.ok !== true) {
        setError(data?.message || "Impossibile aggiornare la password");
        return;
      }

      router.push(data.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setError("Impossibile aggiornare la password in questo momento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top left, rgba(241,245,249,1), rgba(255,255,255,1) 55%, rgba(248,250,252,1) 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          background: "rgba(255,255,255,0.96)",
          border: "1px solid #e2e8f0",
          borderRadius: 28,
          padding: 30,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          Primo accesso
        </p>
        <h1 style={{ margin: "12px 0 8px", fontSize: 32, color: "#0f172a" }}>
          Cambia password
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
          Per continuare devi impostare una nuova password personale.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Nuova password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              style={{
                borderRadius: 16,
                border: "1px solid #dbe3ee",
                padding: "12px 14px",
                fontSize: 15,
                background: "#fff",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Conferma password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={{
                borderRadius: 16,
                border: "1px solid #dbe3ee",
                padding: "12px 14px",
                fontSize: 15,
                background: "#fff",
              }}
            />
          </label>

          {error ? (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "12px 18px",
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 12px 22px rgba(15, 23, 42, 0.14)",
            }}
          >
            {loading ? "Salvataggio..." : "Salva password"}
          </button>
        </form>
      </section>
    </main>
  );
}
