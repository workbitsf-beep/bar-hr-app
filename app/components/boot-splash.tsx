"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * The app turning itself on.
 *
 * Only on a cold start: the app opened from nothing, not a page change inside
 * it. The mark lands, a light passes over it, the name appears, and the whole
 * thing steps aside for whatever was underneath - the login screen, or the
 * dashboard when the session is still good.
 *
 * It never holds anyone up. The page renders behind it from the first frame,
 * so this is a curtain, not a queue: when it lifts the app is already there.
 */
const FLAG = "workbit-booted";
const ON_SCREEN_MS = 1150;
const FADE_MS = 340;

export function BootSplash() {
  const [phase, setPhase] = useState<"hidden" | "playing" | "leaving">("hidden");

  useEffect(() => {
    // sessionStorage lasts as long as the web view does, which in the
    // installed app means one launch. A tab in a browser behaves the same.
    let alreadyBooted = true;

    try {
      alreadyBooted = sessionStorage.getItem(FLAG) === "1";
      sessionStorage.setItem(FLAG, "1");
    } catch {
      // Private windows and locked-down web views refuse storage. Showing the
      // opening twice is better than crashing on the way in.
      alreadyBooted = false;
    }

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (alreadyBooted || reduced) {
      return;
    }

    setPhase("playing");

    const leave = window.setTimeout(() => setPhase("leaving"), ON_SCREEN_MS);
    const done = window.setTimeout(() => setPhase("hidden"), ON_SCREEN_MS + FADE_MS);

    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, []);

  if (phase === "hidden") {
    return null;
  }

  return (
    <div className="workbit-boot" data-leaving={phase === "leaving" ? "true" : undefined} aria-hidden="true">
      <span className="workbit-boot__glow workbit-boot__glow--one" />
      <span className="workbit-boot__glow workbit-boot__glow--two" />

      <span className="workbit-boot__stack">
        <span className="workbit-boot__mark">
          <Image src="/logo.png" alt="" width={112} height={112} priority unoptimized />
          <span className="workbit-boot__shine" />
        </span>
        <span className="workbit-boot__word">Workbit</span>
      </span>
    </div>
  );
}
