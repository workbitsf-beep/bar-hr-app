import type { CSSProperties } from "react";

/*
 * The app's round buttons, one style (30 Oct 2026): 44 px everywhere; the +
 * that adds something is violet, every other round button (settings, the
 * widgets, the cart) is white with a violet icon. The stylesheet repeats the
 * same values for the buttons drawn by class (dashboard.css, "Tasti tondi").
 */

export const ROUND_SIZE = 44;
export const ADD_GRADIENT = "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)";

export const roundWhite: CSSProperties = {
  width: ROUND_SIZE,
  height: ROUND_SIZE,
  borderRadius: 999,
  background: "#ffffff",
  color: "#4c1d95",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  boxShadow: "0 4px 12px rgba(76, 29, 149, 0.08)",
};

export const roundAdd: CSSProperties = {
  ...roundWhite,
  background: ADD_GRADIENT,
  color: "#ffffff",
  boxShadow: "0 6px 14px rgba(94, 74, 227, 0.25)",
};

export function PlusIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** The violet + of a page or a card, for a trigger that is a span (PopupAction triggerRow). */
export function AddFace() {
  return (
    <span style={roundAdd}>
      <PlusIcon />
    </span>
  );
}
