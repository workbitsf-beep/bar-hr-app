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

export function ScrollToTodayButton({
  fallbackHref,
  variant = "button",
}: {
  fallbackHref: string;
  variant?: "button" | "segment";
}) {
  const router = useRouter();

  function handleClick() {
    window.dispatchEvent(new CustomEvent("workbit:calendar-show-today-day"));

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
        minWidth: variant === "segment" ? 0 : 54,
        height: variant === "segment" ? 42 : 36,
        padding: variant === "segment" ? "0 18px" : "0 13px",
        borderRadius: 999,
        background: variant === "segment" ? "transparent" : "linear-gradient(180deg, #ffffff 0%, #f6f2ff 100%)",
        color: variant === "segment" ? "#111827" : "#4c1d95",
        border: variant === "segment" ? 0 : "1px solid rgba(124, 58, 237, 0.16)",
        borderLeft: variant === "segment" ? "1px solid rgba(124, 58, 237, 0.10)" : undefined,
        boxShadow: variant === "segment" ? "none" : "0 8px 18px rgba(88, 28, 135, 0.06)",
        fontWeight: 800,
        fontSize: variant === "segment" ? 13 : 14,
        cursor: "pointer",
        flex: variant === "segment" ? "1 1 0" : undefined,
        whiteSpace: "nowrap",
      }}
    >
      Oggi
    </button>
  );
}
