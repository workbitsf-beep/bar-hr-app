"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || data?.ok !== true) {
        setError(data?.message || "Recupero password non disponibile.");
        return;
      }

      setMessage(
        "Se l'indirizzo esiste, riceverai una password temporanea via email."
      );
    } catch {
      setError("Impossibile inviare la richiesta in questo momento.");
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
          display: "grid",
          gap: 20,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
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
            Recupero accesso
          </p>
          <h1 style={{ margin: 0, fontSize: 32, color: "#0f172a" }}>
            Password temporanea via email
          </h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
            Inserisci la tua email. Ti invieremo una password temporanea e al
            prossimo accesso dovrai cambiarla.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@locale.it"
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
          {message ? (
            <p style={{ margin: 0, color: "#166534", fontSize: 14 }}>{message}</p>
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
            {loading ? "Invio in corso..." : "Invia password temporanea"}
          </button>
        </form>

        <Link
          href="/login"
          style={{
            color: "#475569",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Torna al login
        </Link>
      </section>
    </main>
  );
}
