"use client";

import { Playfair_Display } from "next/font/google";
import { useEffect, useState } from "react";
import type { VenueStatus } from "@/lib/venue-status";

const signFont = Playfair_Display({ subsets: ["latin"], weight: "800", display: "swap" });

/** Checked again this often while the app is on screen. */
const REFRESH_MS = 60_000;

/**
 * The venue's name in the middle of the phone header, set like the sign of a
 * historic café, with a live line underneath: how many are working for whoever
 * runs the venue, where their own shift stands for everyone else.
 */
export function VenueSign({
  name,
  initialStatus,
  shiftsEnabled,
}: {
  name: string;
  /** Null when the venue does not track time: then the sign is the name alone. */
  initialStatus: VenueStatus | null;
  shiftsEnabled: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const live = initialStatus !== null;

  // A refresh of the page brings a fresh line from the server: take it at
  // once, rather than at the next minute's check.
  const [served, setServed] = useState(initialStatus);
  if (initialStatus?.label !== served?.label || initialStatus?.tone !== served?.tone) {
    setServed(initialStatus);
    setStatus(initialStatus);
  }

  useEffect(() => {
    if (!live) return;

    let cancelled = false;

    async function refresh() {
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch(`/api/dashboard/venue-status?shifts=${shiftsEnabled ? 1 : 0}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as { ok?: boolean; status?: VenueStatus };

        if (!cancelled && body.ok && body.status) setStatus(body.status);
      } catch {
        // Offline for a moment: the line keeps what it last knew.
      }
    }

    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [live, shiftsEnabled]);

  const size = name.length <= 12 ? "l" : name.length <= 22 ? "m" : "s";

  return (
    <div className="wb-sign wb-phone-only" data-size={size} data-no-runtime-translate="">
      <span className="wb-sign-name">
        <i aria-hidden="true" />
        <b className={signFont.className}>{name}</b>
        <i aria-hidden="true" />
      </span>
      {status ? (
        <small className="wb-sign-line" data-tone={status.tone}>
          <em aria-hidden="true" />
          {status.label}
        </small>
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: venueSignStyles }} />
    </div>
  );
}

const venueSignStyles = `
  .dashboard-shell-top { position: relative; }

  .wb-sign {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: max-content;
    max-width: calc(100% - 116px);
    display: grid;
    justify-items: center;
    gap: 5px;
    pointer-events: none;
    line-height: 1;
  }

  .wb-sign-name {
    display: flex;
    align-items: center;
    gap: 7px;
    max-width: 100%;
    min-width: 0;
  }

  .wb-sign-name i {
    flex: 0 0 12px;
    height: 1.5px;
    border-radius: 2px;
    background: #9b5cff;
  }

  .wb-sign-name b {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #17183d;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 15px;
    letter-spacing: 0.12em;
  }

  .wb-sign[data-size="m"] .wb-sign-name i { display: none; }
  /* Long names go on two short lines rather than losing their end. */
  .wb-sign[data-size="m"] .wb-sign-name b,
  .wb-sign[data-size="s"] .wb-sign-name b {
    font-size: 11px;
    letter-spacing: 0.04em;
    line-height: 1.15;
    white-space: normal;
    text-align: center;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .wb-sign[data-size="m"] .wb-sign-name b { font-size: 13px; letter-spacing: 0.06em; }
  .wb-sign[data-size="s"] .wb-sign-name i { display: none; }

  .wb-sign-line {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    white-space: nowrap;
    color: #8a84a8;
  }

  .wb-sign-line em {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #b9b3d1;
    box-shadow: 0 0 0 3px #efedf6;
  }

  .wb-sign-line[data-tone="in"] { color: #167a4c; }
  .wb-sign-line[data-tone="in"] em { background: #1f9d63; box-shadow: 0 0 0 3px #d9f3e6; }
  .wb-sign-line[data-tone="next"] { color: #6d3df0; }
  .wb-sign-line[data-tone="next"] em { background: #8b4dff; box-shadow: 0 0 0 3px #efe8ff; }
  .wb-sign-line[data-tone="late"] { color: #b42a44; }
  .wb-sign-line[data-tone="late"] em { background: #e5484d; box-shadow: 0 0 0 3px #fde8ec; }
`;
