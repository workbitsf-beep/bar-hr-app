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
        height: variant === "segment" ? 44 : 36,
        padding: variant === "segment" ? "0 18px" : "0 13px",
        borderRadius: variant === "segment" ? 14 : 999,
        background: variant === "segment" ? "transparent" : "linear-gradient(180deg, #ffffff 0%, #f6f2ff 100%)",
        color: variant === "segment" ? "#1C1C1E" : "#4c1d95",
        border: variant === "segment" ? 0 : "1px solid rgba(124, 58, 237, 0.16)",
        borderLeft: variant === "segment" ? "0.5px solid rgba(60, 60, 67, 0.12)" : undefined,
        boxShadow: variant === "segment" ? "none" : "0 8px 18px rgba(88, 28, 135, 0.06)",
        fontWeight: 800,
        fontSize: variant === "segment" ? 13 : 14,
        cursor: "pointer",
        flex: variant === "segment" ? "1 1 0" : undefined,
        whiteSpace: "nowrap",
      }}
      aria-label={variant === "segment" ? "Vai a oggi" : undefined}
    >
      {variant === "segment" ? "◎" : "Oggi"}
    </button>
  );
}
