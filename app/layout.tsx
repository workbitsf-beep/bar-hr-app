import type { Metadata, Viewport } from "next";
// The app-wide stylesheet. It was a 58,000-character string inside <head>,
// rebuilt by the server and sent twice with every page - in the HTML and again
// in the data React hydrates from. As a file it is sent once and cached.
import "./workbit-global.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Image from "next/image";
import { PwaRegister } from "@/app/components/pwa-register";
import { PasskeySetupPrompt } from "@/app/components/passkey-setup-prompt";
import { BootSplash } from "@/app/components/boot-splash";
import { DayRollover } from "@/app/components/day-rollover";
import { RefreshOnReturn } from "@/app/components/refresh-on-return";
import { RuntimeLanguageSync } from "@/app/components/runtime-language-sync";
import { ViewportResizeSync } from "@/app/components/viewport-resize-sync";
import { WorkbitRouteTransition } from "@/app/components/workbit-route-transition";
import { LANGUAGE_COOKIE_NAME, normalizeLanguage } from "@/lib/language";

type RootLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "Workbit",
  applicationName: "Workbit",
  manifest: "/manifest.webmanifest",
  description: "Gestione turni, timbrature, richieste e comunicazioni con Workbit.",
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/apple-icon",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Workbit",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f3ff",
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const htmlLang = normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value ?? "it");
  // Set by the script below the first time the page runs inside the installed
  // app, so every later page is already marked when the server renders it.
  const isNativeShell = cookieStore.get("wb-native")?.value === "1";

  return (
    <html
      lang={htmlLang}
      style={{ colorScheme: "light" }}
      data-native={isNativeShell ? "1" : undefined}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light" />
        {/* Inside the installed app nothing is sold: Apple and Google refuse an
            app that takes payment outside their own systems. The native bridge
            is injected before the page's scripts, so this marks the document
            before anything paints and the purchase controls never flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=window.Capacitor;if(c&&c.isNativePlatform&&c.isNativePlatform()){document.documentElement.setAttribute("data-native","1");if(document.cookie.indexOf("wb-native=1")<0){document.cookie="wb-native=1; path=/; max-age=31536000; samesite=lax; secure"}}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily:
            '"SF Pro Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
          background: "var(--workbit-app-bg)",
          color: "var(--workbit-ink)",
          width: "100%",
          maxWidth: "100%",
          minHeight: "var(--workbit-vh, 100dvh)",
          overflowX: "hidden",
        }}
      >
        {/* Decided before anything paints: a document that has already booted
            in this web view - or belongs to someone who asked for less motion
            - never shows the curtain at all, so there is no flash of it on a
            page change. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;var booted=false;try{booted=sessionStorage.getItem("workbit-booted")==="1";sessionStorage.setItem("workbit-booted","1")}catch(e){}if(!booted&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){booted=true}if(booted){r.setAttribute("data-workbit-booted","1")}else{r.setAttribute("data-workbit-booting","1")}}catch(e){}})()`,
          }}
        />

        <div className="workbit-boot" id="workbit-boot" aria-hidden="true">
          <span className="workbit-boot__wipe" />
          <span className="workbit-boot__stack">
            <span className="workbit-boot__mark">
              <Image src="/logo.png" alt="" width={112} height={112} priority unoptimized />
            </span>
            <span className="workbit-boot__word">Workbit</span>
          </span>
        </div>

        <ViewportResizeSync />
        <RuntimeLanguageSync language={htmlLang} />
        <PwaRegister />
        <PasskeySetupPrompt />
        <RefreshOnReturn />
        <DayRollover />
        <BootSplash />
        <WorkbitRouteTransition />
        <div className="workbit-global-ambient" aria-hidden="true">
          <span className="workbit-global-ambient__light workbit-global-ambient__light--one" />
          <span className="workbit-global-ambient__light workbit-global-ambient__light--two" />
          <span className="workbit-global-ambient__light workbit-global-ambient__light--three" />
          <span className="workbit-global-ambient__smoke" />
          <span className="workbit-global-ambient__beam" />
          <span className="workbit-global-ambient__veil" />
          <span className="workbit-global-ambient__orbit workbit-global-ambient__orbit--one" />
          <span className="workbit-global-ambient__orbit workbit-global-ambient__orbit--two" />
          <span className="workbit-global-ambient__orbit workbit-global-ambient__orbit--three" />
        </div>
        <div className="workbit-app-content">{children}</div>
      </body>
    </html>
  );
}
