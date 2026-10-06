"use client";

/**
 * On a computer some pages have a desktop layout (wb-desk-only) next to the
 * phone one (wb-phone-only). "Vista classica" shows the phone layout, with
 * everything it can do, until "Torna alla vista per computer" is pressed.
 * The switch lives on <html> so it holds while moving between pages.
 */
export function ClassicToggle({ label = "Vista classica" }: { label?: string }) {
  return (
    <button
      type="button"
      className="wb-classic-toggle"
      onClick={() => document.documentElement.setAttribute("data-desk-classic", "1")}
    >
      {label}
    </button>
  );
}

export function ClassicBack() {
  return (
    <div className="wb-classic-back">
      <span>Stai usando la vista classica.</span>
      <button type="button" onClick={() => document.documentElement.removeAttribute("data-desk-classic")}>
        Torna alla vista per computer
      </button>
    </div>
  );
}
