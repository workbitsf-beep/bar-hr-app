import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { RuntimeLanguageSync } from "@/app/components/runtime-language-sync";
import { LANGUAGE_COOKIE_NAME, normalizeLanguage } from "@/lib/language";

type RootLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "Workbit",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const htmlLang = normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value ?? "it");

  return (
    <html lang={htmlLang}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html {
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
                background: #f8fafc;
              }

              body {
                width: 100%;
                max-width: 100%;
                min-height: 100dvh;
                overflow-x: hidden;
              }

              *,
              *::before,
              *::after {
                box-sizing: border-box;
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily:
            '"SF Pro Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          width: "100%",
          maxWidth: "100%",
          minHeight: "100dvh",
          overflowX: "hidden",
        }}
      >
        <RuntimeLanguageSync language={htmlLang} />
        {children}
      </body>
    </html>
  );
}
