"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { selectBarAction } from "../actions";

type Venue = { id: string; name: string };

function ShopIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10h16v10H4V10Zm-1 0 2-6h14l2 6M8 20v-6h4v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function JumpButton({ venue, variant }: { venue: Venue; variant: "pill" | "row" }) {
  const { pending } = useFormStatus();

  if (variant === "row") {
    return (
      <button type="submit" className="wbc-jump-row" disabled={pending}>
        <ShopIcon />
        <span>{venue.name}</span>
        <i aria-hidden="true">›</i>
      </button>
    );
  }

  return (
    <button type="submit" className="wbc-jump" disabled={pending} title={`Entra in ${venue.name}`}>
      <ShopIcon />
      <span>{pending ? "Apro…" : venue.name}</span>
    </button>
  );
}

/**
 * One tap to drop into the venue you also work at. With several venues it
 * opens a list where each row is its own submit, so it is never more than
 * two taps from the console to the floor.
 */
export function VenueJump({ venues }: { venues: Venue[] }) {
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

  if (venues.length === 0) {
    return null;
  }

  if (venues.length === 1) {
    return (
      <form action={selectBarAction}>
        <input type="hidden" name="barId" value={venues[0].id} />
        <JumpButton venue={venues[0]} variant="pill" />
      </form>
    );
  }

  return (
    <>
      <button type="button" className="wbc-jump" onClick={() => setOpen(true)}>
        <ShopIcon />
        <span>Locali</span>
      </button>

      {open ? (
        <div className="wbc-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="wbc-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="wbc-dialog-head">
              <span className="wbc-label">Entra in un locale</span>
              <button type="button" className="wbc-close" onClick={() => setOpen(false)} aria-label="Chiudi">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {venues.map((venue) => (
                <form key={venue.id} action={selectBarAction}>
                  <input type="hidden" name="barId" value={venue.id} />
                  <JumpButton venue={venue} variant="row" />
                </form>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
