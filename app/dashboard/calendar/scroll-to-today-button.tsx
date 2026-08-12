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
      className={variant === "segment" ? "workbit-calendar-today-segment" : undefined}
      aria-label={variant === "segment" ? "Torna a oggi" : undefined}
      title={variant === "segment" ? "Torna a oggi" : undefined}
      onClick={handleClick}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: variant === "segment" ? 46 : 54,
        width: variant === "segment" ? 46 : undefined,
        maxWidth: variant === "segment" ? 46 : undefined,
        height: variant === "segment" ? 46 : 36,
        minHeight: variant === "segment" ? 46 : undefined,
        maxHeight: variant === "segment" ? 46 : undefined,
        aspectRatio: variant === "segment" ? "1 / 1" : undefined,
        padding: variant === "segment" ? 0 : "0 13px",
        borderRadius: 999,
        background: variant === "segment" ? "#f4f1fb" : "linear-gradient(180deg, #ffffff 0%, #f6f2ff 100%)",
        color: variant === "segment" ? "#6255ed" : "#4c1d95",
        border: "1px solid rgba(98, 85, 237, 0.15)",
        boxShadow: variant === "segment" ? "none" : "0 8px 18px rgba(88, 28, 135, 0.06)",
        fontWeight: 800,
        fontSize: variant === "segment" ? 13 : 14,
        cursor: "pointer",
        flex: variant === "segment" ? "0 0 46px" : undefined,
        whiteSpace: "nowrap",
      }}
    >
      {variant === "segment" ? (
        <svg
          aria-hidden="true"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            display: "block",
            color: "#6255ed",
            flex: "0 0 24px",
          }}
        >
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      ) : (
        "Oggi"
      )}
    </button>
  );
}
