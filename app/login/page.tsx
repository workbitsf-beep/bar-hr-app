"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { AnimatedBackground, RevealOnScroll } from "@/app/components/workbit-animations";
import {
  clearRememberedLoginEmail,
  clearPersistentSession,
  clearPasskeySetupPending,
  hasPasskeyPreferred,
  getRememberedLoginEmail,
  hasPersistentSessionMarker,
  markPersistentSession,
  markPasskeySetupPending,
  rememberLoginEmail,
} from "@/lib/client-session";
import { PasskeyLoginButton } from "./passkey-login-button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [autoPromptPasskey, setAutoPromptPasskey] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!active) {
          return;
        }

        if (response.ok) {
          active = false;
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        if (hasPersistentSessionMarker()) {
          clearPersistentSession();
        }
      } catch {
        // Keep the login form usable if the session check cannot complete.
      } finally {
        if (active) {
          setSessionChecked(true);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const rememberedEmail = getRememberedLoginEmail();

    if (rememberedEmail) {
      setEmail(rememberedEmail);
    }

  }, []);

  useEffect(() => {
    if (!sessionChecked) {
      return;
    }

    setAutoPromptPasskey(hasPasskeyPreferred());
  }, [sessionChecked]);

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
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            redirectTo?: string;
            promptPasskeySetup?: boolean;
          }
        | null;

      if (!response.ok || data?.ok !== true) {
        setError(data?.message || "Accesso non riuscito");
        return;
      }

      if (rememberMe) {
        rememberLoginEmail(email);
      } else {
        clearRememberedLoginEmail();
      }

      if (data?.promptPasskeySetup) {
        markPasskeySetupPending();
      } else {
        clearPasskeySetupPending();
      }

      markPersistentSession();
      router.push(data.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setError("Impossibile accedere in questo momento");
    } finally {
      setLoading(false);
    }
  }

  function handlePasskeySuccess(redirectTo: string, authenticatedEmail?: string) {
    setAutoPromptPasskey(true);

    if (rememberMe) {
      rememberLoginEmail(authenticatedEmail || email);
    } else {
      clearRememberedLoginEmail();
    }

    markPersistentSession();
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main
      className="workbit-animated-page workbit-login-page"
      style={{
        position: "relative",
        isolation: "isolate",
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "var(--workbit-app-bg)",
      }}
    >
      <AnimatedBackground level="full" />
      <RevealOnScroll
        as="section"
        className="workbit-animated-page__content"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 460,
          padding: "24px 0",
        }}
      >
        <div
          className="workbit-login-card"
          style={{
            display: "grid",
            gap: 26,
            padding: 28,
            borderRadius: 30,
            background:
              "radial-gradient(circle at 90% 0%, rgba(168,85,247,0.16), transparent 30%), var(--workbit-card)",
            border: "1px solid var(--workbit-border)",
            boxShadow: "var(--workbit-shadow)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div style={{ display: "grid", justifyItems: "center", gap: 14, textAlign: "center" }}>
            <BrandLogo size={44} priority showIcon label="Workbit" style={{ gap: 12 }} />
            <div style={{ display: "grid", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 34, color: "var(--workbit-navy)", letterSpacing: "-0.03em" }}>
                Accedi
              </h1>
              <p style={{ margin: 0, color: "var(--workbit-purple-dark)", lineHeight: 1.7, fontWeight: 700 }}>
                ✨ Turni, timbrature e richieste in uno spazio semplice e pulito.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "var(--workbit-navy)" }}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@locale.it"
                style={{
                  borderRadius: 18,
                  border: "1px solid var(--workbit-border)",
                  padding: "14px 16px",
                  fontSize: 16,
                  background: "linear-gradient(180deg, #ffffff 0%, #fdfbff 100%)",
                  color: "var(--workbit-text)",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "var(--workbit-navy)" }}>Password</span>
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Inserisci la password"
                  style={{
                    borderRadius: 18,
                    border: "1px solid var(--workbit-border)",
                    padding: "14px 16px",
                    fontSize: 16,
                    background: "linear-gradient(180deg, #ffffff 0%, #fdfbff 100%)",
                    color: "var(--workbit-text)",
                  }}
                />
                <button
                  className="workbit-press-feedback"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  style={{
                    width: "fit-content",
                    border: "1px solid var(--workbit-border)",
                    background: "linear-gradient(180deg, #ffffff, #f7f3ff)",
                    color: "var(--workbit-purple-dark)",
                    borderRadius: 999,
                    padding: "9px 13px",
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

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 18,
                background: "linear-gradient(180deg, #ffffff 0%, #f7f3ff 100%)",
                border: "1px solid var(--workbit-border)",
                color: "#334155",
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ display: "grid", gap: 2 }}>
                <span style={{ fontWeight: 700, color: "var(--workbit-navy)" }}>Ricordami</span>
                <span style={{ fontSize: 13, color: "var(--workbit-muted)", lineHeight: 1.5 }}>
                  Mantieni l&apos;accesso più a lungo su questo dispositivo.
                </span>
              </span>
            </label>

            <button
              className="workbit-press-feedback"
              type="button"
              onClick={() => router.push("/forgot-password")}
              style={{
                justifySelf: "start",
                border: 0,
                background: "transparent",
                padding: 0,
                color: "var(--workbit-muted)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Hai dimenticato la password?
            </button>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <button
                className="workbit-press-feedback"
                type="submit"
                disabled={loading}
                style={{
                  background: "var(--workbit-gradient)",
                  color: "#fff",
                  border: 0,
                  borderRadius: 999,
                  padding: "14px 18px",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  boxShadow: "0 16px 30px rgba(124, 58, 237, 0.18)",
                }}
              >
                {loading ? "Accesso in corso..." : "Entra"}
              </button>

              <PasskeyLoginButton
                email={email}
                rememberMe={rememberMe}
                onError={setError}
                onSuccess={handlePasskeySuccess}
                compact
                autoPrompt={autoPromptPasskey}
              />
            </div>
          </form>
        </div>
      </RevealOnScroll>
    </main>
  );
}
