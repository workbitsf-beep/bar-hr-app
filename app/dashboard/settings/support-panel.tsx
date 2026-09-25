import Link from "next/link";
import { getSupportEmail } from "@/lib/public-legal";

/**
 * Where to write when something does not work, and what to say.
 *
 * The venue name and the account travel in the prefilled message because they
 * are the first two things support has to ask for otherwise, and nobody knows
 * them by heart.
 */
export function SupportPanel({
  activeBarName,
  userEmail,
}: {
  activeBarName: string | null;
  userEmail: string;
}) {
  const supportEmail = getSupportEmail();
  const subject = encodeURIComponent(`Assistenza Workbit — ${activeBarName ?? "locale"}`);
  const body = encodeURIComponent(
    [
      "Descrivi cosa è successo:",
      "",
      "",
      "—",
      `Locale: ${activeBarName ?? "non selezionato"}`,
      `Account: ${userEmail}`,
    ].join("\n")
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
        Se qualcosa non funziona o hai un dubbio, scrivici. Rispondiamo all&apos;indirizzo del tuo
        account.
      </p>

      <a
        href={`mailto:${supportEmail}?subject=${subject}&body=${body}`}
        className="workbit-support-cta"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          borderRadius: 18,
          background: "linear-gradient(135deg, #3d2a99 0%, #5e5ce6 58%, #8b5cf6 100%)",
          color: "#ffffff",
          textDecoration: "none",
          fontWeight: 800,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 18 }}>
          ✉️
        </span>
        <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <span>Scrivi all&apos;assistenza</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.82, wordBreak: "break-all" }}>
            {supportEmail}
          </span>
        </span>
      </a>

      <div
        style={{
          display: "grid",
          gap: 2,
          padding: "12px 14px",
          borderRadius: 16,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          color: "#64748b",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <span>
          <strong style={{ color: "#0f172a" }}>Locale:</strong> {activeBarName ?? "non selezionato"}
        </span>
        <span>
          <strong style={{ color: "#0f172a" }}>Account:</strong> {userEmail}
        </span>
        <span style={{ marginTop: 6 }}>
          Questi due dati sono già inseriti nel messaggio: servono a ritrovare la tua situazione
          senza doverteli chiedere.
        </span>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13.5, fontWeight: 700 }}>
        <Link href="/support" style={{ color: "#7b2ff7", textDecoration: "none" }}>
          Pagina di supporto
        </Link>
        <Link href="/privacy" style={{ color: "#7b2ff7", textDecoration: "none" }}>
          Privacy
        </Link>
        <Link href="/terms" style={{ color: "#7b2ff7", textDecoration: "none" }}>
          Termini
        </Link>
        <Link href="/account-deletion" style={{ color: "#7b2ff7", textDecoration: "none" }}>
          Cancellazione account
        </Link>
      </div>
    </div>
  );
}
