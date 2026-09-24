"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { isNativeApp } from "@/lib/native-app";

/**
 * Opens or saves a document, in a browser and in the installed app alike.
 *
 * In a browser this is an ordinary link and nothing else is needed. The
 * installed app cannot do either job itself: its web view refuses to render a
 * PDF and ignores a file it is asked to save, so the work goes to the phone's
 * browser. That browser is a separate application and carries none of
 * Workbit's cookies, which is why a plain address answers "not found" there.
 * So the address is asked for at the moment of the tap, with a permission in
 * it that stands in for the session and expires within minutes.
 */
export function DocumentFileLink({
  documentId,
  mode,
  children,
  className,
  style,
  ariaLabel,
  title,
}: {
  documentId: string;
  mode: "open" | "download";
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);

  const href =
    mode === "download" ? `/api/documents/${documentId}?download=1` : `/api/documents/${documentId}`;

  return (
    <a
      href={href}
      target={mode === "open" ? "_blank" : undefined}
      rel="noreferrer"
      className={className}
      style={style}
      aria-label={ariaLabel}
      title={title}
      onClick={(event) => {
        if (!isNativeApp() || busy) {
          return;
        }

        event.preventDefault();
        setBusy(true);

        void (async () => {
          try {
            const response = await fetch(`/api/documents/${documentId}/link`, { method: "POST" });
            const payload = (await response.json().catch(() => null)) as
              | { ok?: boolean; url?: string; message?: string }
              | null;

            if (!response.ok || !payload?.ok || !payload.url) {
              throw new Error(payload?.message || "Collegamento al documento non disponibile.");
            }

            const url = new URL(payload.url, window.location.origin);

            if (mode === "download") {
              url.searchParams.set("download", "1");
            }

            const { Browser } = await import("@capacitor/browser");

            await Browser.open({ url: url.toString() });
          } catch (error) {
            console.error("[documents] open failed", error);
            window.alert(
              error instanceof Error ? error.message : "Impossibile aprire il documento."
            );
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
