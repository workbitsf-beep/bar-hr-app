"use client";

import { useState } from "react";
import { showAppToast } from "@/app/components/app-toast";
import { isNativeApp } from "@/lib/native-app";
import { shareFileFromUrl } from "@/lib/native-extras";

const button = {
  minHeight: 42,
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 760,
  cursor: "pointer",
  padding: "0 16px",
} as const;

/**
 * The month's files: downloaded in a browser, handed to the phone's share
 * sheet inside the app (a web view cannot save a file), or emailed straight
 * to the consultant.
 */
export function ExportButtons({ month, year, consultantEmail }: { month: number; year: number; consultantEmail: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function download(format: "xlsx" | "csv") {
    setBusy(format);
    try {
      const asLink = isNativeApp();
      const response = await fetch("/api/export/consulente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, format, deliver: asLink ? "link" : "file" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        showAppToast(payload?.message ?? "File non disponibile.", "error");
        return;
      }
      if (asLink) {
        const payload = (await response.json().catch(() => null)) as { url?: string; fileName?: string } | null;
        if (!payload?.url) {
          showAppToast("Impossibile preparare il file.", "error");
          return;
        }
        const link = new URL(payload.url, window.location.origin).toString();
        if (await shareFileFromUrl(link, payload.fileName ?? `presenze.${format}`, "Presenze del mese")) return;
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: link });
        return;
      }
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? `presenze.${format}`;
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch {
      showAppToast("Download non riuscito: controlla la connessione.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!consultantEmail) {
      showAppToast("Scrivi prima l'email del consulente, qui sotto.", "error");
      return;
    }
    setBusy("send");
    try {
      const response = await fetch("/api/export/consulente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, send: true }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; sentTo?: string } | null;
      if (!response.ok || !payload?.ok) {
        showAppToast(payload?.message ?? "Email non partita.", "error");
        return;
      }
      showAppToast(`Inviate a ${payload.sentTo}`);
    } catch {
      showAppToast("Email non partita: controlla la connessione.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void send()}
        style={{
          ...button,
          minHeight: 46,
          border: 0,
          color: "#ffffff",
          background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
          boxShadow: "0 10px 22px rgba(124, 58, 237, 0.18)",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy === "send" ? "Invio…" : consultantEmail ? `Invia a ${consultantEmail}` : "Invia al consulente"}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void download("xlsx")}
          style={{ ...button, border: "1px solid #ddd6fe", background: "#f6f3ff", color: "#4c1d95" }}
        >
          {busy === "xlsx" ? "Preparo…" : "Scarica Excel"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void download("csv")}
          style={{ ...button, border: "1px solid #ddd6fe", background: "#f6f3ff", color: "#4c1d95" }}
        >
          {busy === "csv" ? "Preparo…" : "Scarica CSV"}
        </button>
      </div>
    </div>
  );
}
