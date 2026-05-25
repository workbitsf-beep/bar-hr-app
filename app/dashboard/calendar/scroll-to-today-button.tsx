"use client";

import { useRouter } from "next/navigation";

export function ScrollToTodayButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  function handleClick() {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('[data-calendar-today="true"]')
    );
    const visibleTarget =
      candidates.find((node) => node.offsetParent !== null) ?? candidates[0] ?? null;

    if (visibleTarget) {
      visibleTarget.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 64,
        height: 42,
        padding: "0 14px",
        borderRadius: 999,
        background: "#f8fafc",
        color: "#0f172a",
        border: "1px solid #e2e8f0",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Oggi
    </button>
  );
}
