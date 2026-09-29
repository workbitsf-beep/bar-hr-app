"use client";

import { useEffect } from "react";

/**
 * Takes the opening curtain away once it has played.
 *
 * The curtain itself is in the server HTML, so it is on screen in the very
 * first paint - before React has hydrated, before the page underneath has
 * drawn anything. Putting it in a client component meant the page flashed up
 * first and the logo landed on top of it a moment later, which is backwards.
 *
 * This only does the leaving: wait, fade, and mark the document booted so the
 * curtain is gone for good. Whatever was rendering behind it - the login
 * screen, or the dashboard when the session is still good - has had the whole
 * time to arrive.
 */
/** The ground has finished closing in on itself by here. */
const ON_SCREEN_MS = 1520;
const FADE_MS = 160;

export function BootSplash() {
  useEffect(() => {
    const root = document.documentElement;

    // The inline script in the layout has already decided. A document marked
    // booted either came from a page change or belongs to someone who asked
    // for less motion, and there is no curtain to take away.
    if (root.getAttribute("data-workbit-booted") === "1") {
      return;
    }

    const leave = window.setTimeout(() => {
      document.getElementById("workbit-boot")?.setAttribute("data-leaving", "true");
    }, ON_SCREEN_MS);

    const done = window.setTimeout(() => {
      root.setAttribute("data-workbit-booted", "1");
      root.removeAttribute("data-workbit-booting");
    }, ON_SCREEN_MS + FADE_MS);

    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, []);

  return null;
}
