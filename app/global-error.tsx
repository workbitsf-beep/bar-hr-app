"use client";

/**
 * The last net, for a failure above every page (the root layout). It renders
 * its own document, so it carries its own few styles.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#eeecfb", fontFamily: "system-ui, sans-serif" }}>
        <title>Workbit</title>
        <div style={{ display: "grid", gap: 12, maxWidth: 380, margin: 16, padding: "24px 20px", borderRadius: 22, background: "#ffffff" }}>
          <strong style={{ fontSize: 18, color: "#17161f" }}>Qualcosa non ha funzionato.</strong>
          <span style={{ fontSize: 14, color: "#5b5675", lineHeight: 1.5 }}>
            Riprova tra un attimo. Se succede ancora, chiudi e riapri l&apos;app.
          </span>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 46, borderRadius: 999, border: 0, background: "#5e4ae3", color: "#ffffff", fontWeight: 800, fontSize: 14.5 }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
