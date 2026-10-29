"use client";

import { useState, type CSSProperties } from "react";
import { showAppToast } from "@/app/components/app-toast";
import { isNativeApp, shareFileFromUrl } from "@/lib/native-extras";

/**
 * The month's PDF for one person. In a browser it downloads; inside the app,
 * where a web view cannot save a file, it goes to the phone's share sheet.
 */
export function PdfButton({ userId, month, year, style }: { userId: string; month: number; year: number; style?: CSSProperties }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const asLink = isNativeApp();
      const response = await fetch("/api/export/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, month, year, format: "pdf", deliver: asLink ? "link" : "file" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        showAppToast(payload?.message ?? "PDF non disponibile.", "error");
        return;
      }
      const fileName = `report-${year}-${String(month).padStart(2, "0")}.pdf`;
      if (asLink) {
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
        if (!payload?.ok || !payload.url) {
          showAppToast("Impossibile preparare il PDF.", "error");
          return;
        }
        const link = new URL(payload.url, window.location.origin).toString();
        if (await shareFileFromUrl(link, fileName, "Report ore")) return;
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: link });
        return;
      }
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch {
      showAppToast("PDF non scaricato: controlla la connessione.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={() => void download()} disabled={busy} style={style}>
      {busy ? "Preparo…" : "PDF del mese"}
    </button>
  );
}
