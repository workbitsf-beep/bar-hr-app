import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { RuntimeLanguageSync } from "@/app/components/runtime-language-sync";
import { LANGUAGE_COOKIE_NAME, normalizeLanguage } from "@/lib/language";

type RootLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "Workbit ShiftHub",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const session = await getSession();
  const cookieStore = await cookies();
  const htmlLang = normalizeLanguage(
    session?.user.language ?? cookieStore.get(LANGUAGE_COOKIE_NAME)?.value ?? "it"
  );

  return (
    <html lang={htmlLang}>
      <body
        style={{
          margin: 0,
          fontFamily:
            '"SF Pro Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
          backgroundColor: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <RuntimeLanguageSync language={htmlLang} />
        {children}
      </body>
    </html>
  );
}
