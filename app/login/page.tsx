"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
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
import styles from "./login.module.css";

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
  }

  return (
    <main className={`workbit-login-page ${styles.page}`}>
      <section className={styles.shell}>
        <header className={styles.brandCard}>
          <BrandLogo size={40} priority showIcon label="Workbit" style={{ gap: 11 }} />
        </header>

        <div className={styles.content}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Il tuo spazio di lavoro</span>
            <h1>Bentornato</h1>
            <p>Accedi per continuare su Workbit.</p>
          </div>

          <form className={styles.authCard} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@locale.it"
                autoComplete="email"
                inputMode="email"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Password</span>
              <div className={styles.passwordField}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Inserisci la password"
                  autoComplete="current-password"
                  required
                />
                <button
                  className={`workbit-press-feedback ${styles.passwordToggle}`}
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  title={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M10.6 10.7a2 2 0 002.7 2.7M9.9 5.2A9.7 9.7 0 0112 5c5.4 0 8.5 5.2 8.5 5.2a11.8 11.8 0 01-2.4 3M6.2 6.3a12.8 12.8 0 00-2.7 3.9S6.6 15.4 12 15.4c.7 0 1.4-.1 2-.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3.5 12S6.6 6.8 12 6.8s8.5 5.2 8.5 5.2-3.1 5.2-8.5 5.2S3.5 12 3.5 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <div className={styles.optionsRow}>
              <label className={styles.rememberMe}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Ricordami</span>
              </label>

              <button
                className={`workbit-press-feedback ${styles.forgotPassword}`}
                type="button"
                onClick={() => router.push("/forgot-password")}
              >
                Password dimenticata?
              </button>
            </div>

            {error ? <p className={styles.errorMessage}>{error}</p> : null}

            <div className={styles.actions}>
              <button
                className={`workbit-press-feedback ${styles.submitButton}`}
                type="submit"
                disabled={loading}
              >
                {loading ? "Accesso in corso..." : "Accedi"}
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

          <p className={styles.securityNote}>Accesso protetto e sicuro</p>
        </div>
      </section>
    </main>
  );
}
