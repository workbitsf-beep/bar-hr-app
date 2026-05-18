"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; redirectTo?: string }
        | null;

      if (!response.ok || data?.ok !== true) {
        setError(data?.message || "Accesso non riuscito");
        return;
      }

      router.push(data.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setError("Impossibile accedere in questo momento");
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
          maxWidth: 430,
          background: "rgba(255,255,255,0.96)",
          border: "1px solid #e2e8f0",
          borderRadius: 28,
          padding: 30,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ margin: 0 }}>
          <BrandLogo
            size={42}
            priority
            showSecondaryLabel
            style={{ gap: 12 }}
          />
        </div>
        <h1 style={{ margin: "12px 0 8px", fontSize: 34, color: "#0f172a" }}>
          Accedi
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
          Gestisci turni, timbrature, richieste e bacheca del locale da un unico
          spazio.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
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

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Password</span>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Inserisci la password"
                style={{
                  borderRadius: 16,
                  border: "1px solid #dbe3ee",
                  padding: "12px 14px",
                  fontSize: 15,
                  background: "#fff",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                style={{
                  width: "fit-content",
                  border: "1px solid #dbe3ee",
                  background: "#f8fafc",
                  color: "#334155",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {showPassword ? "Nascondi password" : "Mostra password"}
              </button>
            </div>
          </label>

          {error ? (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
          ) : null}

          <div>
            <button
              type="button"
              onClick={() => router.push("/forgot-password")}
              style={{
                border: 0,
                background: "transparent",
                padding: 0,
                color: "#475569",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Hai dimenticato la password?
            </button>
          </div>

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
            {loading ? "Accesso in corso..." : "Entra"}
          </button>
        </form>
      </section>
    </main>
  );
}
