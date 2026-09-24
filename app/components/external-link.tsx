"use client";

import type { CSSProperties, ReactNode } from "react";
import { isNativeApp } from "@/lib/native-app";

/**
 * A link to something that has to open outside the page — a PDF, an external
 * site.
 *
 * In a browser this is an ordinary new-tab link. Inside the installed app it
 * cannot be: Android web views ignore requests to open a new window entirely,
 * so the tap does nothing at all, and even loaded in place a web view cannot
 * display a PDF. Hand those to the system browser instead, which renders them
 * and gives the reader a way back.
 */
export function ExternalLink({
  href,
  children,
  className,
  style,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      style={style}
      onClick={(event) => {
        if (!isNativeApp()) {
          return;
        }

        event.preventDefault();

        void (async () => {
          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.open({ url: new URL(href, window.location.origin).toString() });
          } catch {
            // Better to try the doomed navigation than to swallow the tap.
            window.location.href = href;
          }
        })();
      }}
    >
      {children}
    </a>
  );
}
