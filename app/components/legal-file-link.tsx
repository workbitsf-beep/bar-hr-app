"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { isNativeApp } from "@/lib/native-app";
import { shareFileFromUrl } from "@/lib/native-extras";

/**
 * Opens or saves a published legal document's PDF. In a browser, a plain
 * link. In the installed app the PDF goes to the phone's browser, which has
 * no session ("Sessione scaduta"), so a signed address good for ten minutes
 * is asked for at the tap (app/api/legal-documents/[documentId]/link).
 */
export function LegalFileLink({
  documentId,
  mode,
  fileName,
  children,
  style,
}: {
  documentId: string;
  mode: "open" | "download";
  fileName?: string | null;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [busy, setBusy] = useState(false);
  const href = `/api/legal-documents/${documentId}${mode === "download" ? "?download=1" : ""}`;

  return (
    <a
      href={href}
      target={mode === "open" ? "_blank" : undefined}
      rel="noreferrer"
      style={style}
      aria-busy={busy}
      onClick={(event) => {
        if (!isNativeApp() || busy) return;
        event.preventDefault();
        setBusy(true);
        void (async () => {
          try {
            const response = await fetch(`/api/legal-documents/${documentId}/link`, { method: "POST" });
            const payload = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; message?: string } | null;
            if (!response.ok || !payload?.ok || !payload.url) throw new Error(payload?.message || "Documento non disponibile.");
            const url = new URL(payload.url, window.location.origin);
            if (mode === "download") {
              url.searchParams.set("download", "1");
              if (await shareFileFromUrl(url.toString(), fileName || "documento.pdf", "Documento")) return;
            }
            const { Browser } = await import("@capacitor/browser");
            await Browser.open({ url: url.toString() });
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "Impossibile aprire il documento.");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      {children}
    </a>
  );
}
