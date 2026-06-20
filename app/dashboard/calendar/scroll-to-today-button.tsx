"use client";

import { useRouter } from "next/navigation";

export function scrollToTodayCard(behavior: ScrollBehavior = "smooth") {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('[data-calendar-today="true"]')
  );
  const visibleTarget =
    candidates.find((node) => node.offsetParent !== null) ?? candidates[0] ?? null;

  if (!visibleTarget) {
    return false;
  }

  visibleTarget.scrollIntoView({
    behavior,
    block: "center",
    inline: "center",
  });

  return true;
}

export function ScrollToTodayButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  function handleClick() {
    if (scrollToTodayCard()) {
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
        height: 44,
        padding: "0 16px",
        borderRadius: 999,
        background: "linear-gradient(180deg, #ffffff 0%, #f6f2ff 100%)",
        color: "#4c1d95",
        border: "1px solid rgba(124, 58, 237, 0.16)",
        boxShadow: "0 10px 24px rgba(88, 28, 135, 0.08)",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      Oggi
    </button>
  );
}
