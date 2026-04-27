import type { ReactNode } from "react";

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
          backgroundColor: "#f4f1ea",
          color: "#1f2937",
        }}
      >
        {children}
      </body>
    </html>
  );
}
