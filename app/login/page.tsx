"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || data?.ok !== true) {
        setError(data?.message || "Login failed");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to sign in right now");
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
          "linear-gradient(180deg, #f8f2e6 0%, #efe5d3 45%, #f7f4ec 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fffdf8",
          border: "1px solid #eadfc9",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 14px 36px rgba(74, 58, 27, 0.08)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#8a6f48",
          }}
        >
          Bar management
        </p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 32 }}>Login</h1>
        <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.6 }}>
          Sign in to access your dashboard.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: 16, marginTop: 24 }}
        >
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                borderRadius: 14,
                border: "1px solid #d9cdb8",
                padding: "12px 14px",
                fontSize: 15,
                background: "#fff",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Password</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                borderRadius: 14,
                border: "1px solid #d9cdb8",
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
              background: "#1f2937",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "12px 18px",
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              marginTop: 4,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
