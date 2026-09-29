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
    <div style={{ display: "grid", gap: 11 }}>
      <a
        href={`mailto:${supportEmail}?subject=${subject}&body=${body}`}
        className="workbit-support-cta"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          padding: "0 16px",
          borderRadius: 15,
          background: "linear-gradient(135deg, #3b1d8f 0%, #5e4ae3 55%, #8b5cf6 100%)",
          color: "#ffffff",
          textDecoration: "none",
          fontSize: 14.5,
          fontWeight: 820,
          boxShadow: "0 10px 22px rgba(94, 74, 227, 0.26)",
          wordBreak: "break-word",
          textAlign: "center",
        }}
      >
        Scrivi a {supportEmail}
      </a>

      <div
        style={{
          padding: "11px 12px",
          borderRadius: 13,
          background: "#fbfaff",
          border: "1px solid #e9e6f5",
          fontSize: 12,
          fontWeight: 540,
          color: "#6b6880",
          lineHeight: 1.5,
        }}
      >
        Nel messaggio mettiamo già{" "}
        <strong style={{ fontWeight: 780, color: "#17161f" }}>
          {activeBarName ?? "il locale"}
        </strong>{" "}
        e <strong style={{ fontWeight: 780, color: "#17161f" }}>{userEmail}</strong>, così non devi
        spiegare chi sei.
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          justifyContent: "center",
          fontSize: 12.5,
          fontWeight: 720,
        }}
      >
        <Link href="/support" style={{ color: "#8b88a3", textDecoration: "none" }}>
          Pagina di supporto
        </Link>
        <Link href="/privacy" style={{ color: "#8b88a3", textDecoration: "none" }}>
          Privacy
        </Link>
        <Link href="/terms" style={{ color: "#8b88a3", textDecoration: "none" }}>
          Termini
        </Link>
      </div>
    </div>
  );
}
