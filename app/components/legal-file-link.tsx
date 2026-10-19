"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { isNativeApp } from "@/lib/native-app";
import { shareFileFromUrl } from "@/lib/native-extras";

/**
 * Opens or saves a published legal document's PDF. In a browser, a plain
 * link. In the installed app the PDF goes to the phone's browser, which has
 * no session ("Sessione scaduta"), so the page hands it a signed address
 * (lib/legal-link.ts) and the app opens that.
 */
export function LegalFileLink({
  documentId,
  signedHref,
  mode,
  fileName,
  children,
  style,
}: {
  documentId: string;
  /** Made by the page (lib/legal-link.ts): opens without a session, in the phone's browser. */
  signedHref: string;
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
            const url = new URL(signedHref, window.location.origin);
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
