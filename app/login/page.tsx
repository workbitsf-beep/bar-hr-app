"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import {
  clearRememberedLoginEmail,
  clearRememberedLoginName,
  clearPersistentSession,
  clearPasskeySetupPending,
  hasPasskeyPreferred,
  getRememberedLoginEmail,
  getRememberedLoginName,
  hasPersistentSessionMarker,
  markPersistentSession,
  markPasskeySetupPending,
  rememberLoginEmail,
  rememberLoginName,
} from "@/lib/client-session";
import { PasskeyLoginButton } from "./passkey-login-button";
import styles from "./login.module.css";

/** "Buongiorno" until noon, and so on, from the phone's own clock. */
function greetingFor(date: Date) {
  const hour = date.getHours();

  if (hour < 13) {
    return "Buongiorno";
  }

  return hour < 18 ? "Buon pomeriggio" : "Buonasera";
}

/** Two letters for the circle: from the name if we have it, else the address. */
function initialsFor(name: string, email: string) {
  const fromName = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (fromName) {
    return fromName;
  }

  return email.slice(0, 2).toUpperCase() || "??";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [autoPromptPasskey, setAutoPromptPasskey] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  // Who this phone remembers. While it is set the address is an identity, not
  // a field: nobody types their own email every morning.
  const [knownEmail, setKnownEmail] = useState("");
  const [knownName, setKnownName] = useState("");
  const [greeting, setGreeting] = useState("");

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
    // Arriving from a closed account: the greeting by name and the remembered
    // address belong to an account that no longer exists.
    if (new URLSearchParams(window.location.search).get("deleted") === "1") {
      clearRememberedLoginEmail();
      clearRememberedLoginName();
      clearPasskeySetupPending();
      setHint("Account eliminato. I tuoi dati di accesso sono stati cancellati.");
      setGreeting(greetingFor(new Date()));
      return;
    }

    const rememberedEmail = getRememberedLoginEmail();

    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setKnownEmail(rememberedEmail);
      setKnownName(getRememberedLoginName());
    }

    setGreeting(greetingFor(new Date()));
  }, []);

  useEffect(() => {
    if (!sessionChecked) {
      return;
    }

    setAutoPromptPasskey(hasPasskeyPreferred());
  }, [sessionChecked]);

  function keepIdentity(nextEmail: string, firstName?: string) {
    if (!rememberMe) {
      clearRememberedLoginEmail();
      clearRememberedLoginName();
      return;
    }

    rememberLoginEmail(nextEmail);

    if (firstName) {
      rememberLoginName(firstName);
    }
  }

  /** Forgets this phone's account and hands the form back its email field. */
  function forgetIdentity() {
    clearRememberedLoginEmail();
    clearRememberedLoginName();
    setKnownEmail("");
    setKnownName("");
    setEmail("");
    setPassword("");
    setError("");
    setHint("Account scollegato da questo telefono.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setHint("");
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
            firstName?: string;
            promptPasskeySetup?: boolean;
          }
        | null;

      if (!response.ok || data?.ok !== true) {
        setError(data?.message || "Accesso non riuscito");
        return;
      }

      keepIdentity(email, data.firstName);

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

  function handlePasskeySuccess(
    redirectTo: string,
    authenticatedEmail?: string,
    firstName?: string
  ) {
    setAutoPromptPasskey(true);
    keepIdentity(authenticatedEmail || email, firstName);
    markPersistentSession();
    router.push(redirectTo);
  }

  const initials = initialsFor(knownName, knownEmail);
  const displayName = knownName || knownEmail.split("@")[0] || "";

  return (
    <main className={`workbit-login-page ${styles.page}`}>
      <section className={styles.shell}>
        <header className={styles.brandRow}>
          <BrandLogo size={28} priority showIcon label="Workbit" style={{ gap: 9 }} />
        </header>

        <div className={styles.content}>
          <div className={styles.heading}>
            {knownEmail ? (
              <>
                <span className={styles.eyebrow}>{greeting}</span>
                <h1>{displayName}</h1>
              </>
            ) : (
              <>
                <span className={styles.eyebrow}>Il tuo lavoro, in ordine</span>
                <h1>Accedi</h1>
              </>
            )}
          </div>

          {knownEmail ? (
            <div className={styles.identityCard}>
              <span className={styles.identityRail} aria-hidden="true" />
              <div className={styles.identityRow}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials}
                </span>
                <span className={styles.identityText}>
                  <strong>{displayName}</strong>
                  <span>{knownEmail}</span>
                </span>
                <button
                  className={`workbit-press-feedback ${styles.swapButton}`}
                  type="button"
                  onClick={forgetIdentity}
                >
                  Cambia
                </button>
              </div>
            </div>
          ) : null}

          <form className={styles.authCard} onSubmit={handleSubmit}>
            {knownEmail ? null : (
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
            )}

            <label className={styles.field}>
              <span>Password</span>
              <div className={styles.passwordField}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="La tua password"
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
                <span>Resta collegato</span>
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
            {!error && hint ? <p className={styles.hintMessage}>{hint}</p> : null}

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
                onCancel={(message) => {
                  setError("");
                  setHint(message);
                }}
                onSuccess={handlePasskeySuccess}
                compact
                className={styles.bioButton}
                autoPrompt={autoPromptPasskey}
              />
            </div>
          </form>

          {/* Chi ha scaricato l'app senza un invito: un titolare apre qui il suo
              locale. Un dipendente invece entra con l'accesso del titolare. */}
          <div className={styles.signupCard}>
            <span className={styles.signupText}>
              <strong>Hai un locale?</strong>
              <span>Aprilo su Workbit in due minuti, 30 giorni gratis.</span>
            </span>
            <a className={`workbit-press-feedback ${styles.signupButton}`} href="/registrazione">
              Registrati
            </a>
          </div>
          <p className={styles.inviteNote}>
            Lavori in un locale? Il tuo accesso te lo manda il titolare.
          </p>
        </div>
      </section>
    </main>
  );
}
