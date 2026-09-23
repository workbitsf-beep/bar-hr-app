"use client";

import { useEffect, useState, type ReactNode } from "react";

export function ConsoleAccount({
  initials,
  name,
  children,
}: {
  initials: string;
  name: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="wbc-avatar" onClick={() => setOpen(true)} aria-label={`Account di ${name}`}>
        {initials}
      </button>

      {open ? (
        <div className="wbc-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="wbc-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="wbc-dialog-head">
              <span className="wbc-label">Account</span>
              <button type="button" className="wbc-close" onClick={() => setOpen(false)} aria-label="Chiudi">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
