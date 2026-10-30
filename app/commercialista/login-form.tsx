"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestCodeAction, verifyCodeAction } from "./actions";

const input = {
  minHeight: 48,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid #ddd6fe",
  background: "#ffffff",
  fontSize: 16,
  width: "100%",
} as const;

const button = {
  minHeight: 48,
  borderRadius: 999,
  border: 0,
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
} as const;

/** Email, then the six digits mailed to it. */
export function AccountantLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function ask(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await requestCodeAction(email);
      if ("ruleError" in result) setError(result.ruleError);
      else setSent(true);
    });
  }

  function verify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await verifyCodeAction(email, code);
      if ("ruleError" in result) setError(result.ruleError);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={sent ? verify : ask} style={{ display: "grid", gap: 12 }}>
      {!sent ? (
        <>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 650 }}>La tua email</span>
            <input style={input} type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button type="submit" style={button} disabled={pending}>
            {pending ? "Invio…" : "Mandami il codice"}
          </button>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#4c4670" }}>
            Se {email} ha dei clienti su Workbit, gli abbiamo mandato un codice di 6 cifre. Vale 10 minuti.
          </p>
          <input
            style={{ ...input, fontSize: 22, letterSpacing: "0.3em", textAlign: "center" }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          <button type="submit" style={button} disabled={pending || code.length !== 6}>
            {pending ? "Controllo…" : "Entra"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
            }}
            style={{ border: 0, background: "none", color: "#5e4ae3", fontSize: 14, fontWeight: 650, cursor: "pointer" }}
          >
            Cambia email o chiedi un altro codice
          </button>
        </>
      )}
      {error ? (
        <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 14, background: "#fff1f2", color: "#b3202f", fontSize: 14, fontWeight: 650 }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
