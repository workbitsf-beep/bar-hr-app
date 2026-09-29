"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native-app";

/**
 * Takes the opening curtain away once it has played, and dismisses the native
 * launch screen the moment the curtain is on screen.
 *
 * The curtain itself is in the server HTML, so it is on screen in the very
 * first paint - before React has hydrated, before the page underneath has
 * drawn anything. Putting it in a client component meant the page flashed up
 * first and the logo landed on top of it a moment later, which is backwards.
 *
 * The launch screen is the shell's, not the page's. It used to let go after
 * half a second, which left the web view showing its own background while it
 * was still fetching the site: the blank screen before the opening. Now it
 * waits here, and hands over to a curtain already painted, so there is never
 * a frame with nothing on it.
 */
const ON_SCREEN_MS = 1400;
const FADE_MS = 120;

/**
 * Two frames of grace, so the browser has certainly painted the curtain
 * before the launch screen is taken away from over it.
 */
function afterNextPaint(run: () => void) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(run));
}

export function BootSplash() {
  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    let cancelled = false;

    afterNextPaint(() => {
      if (cancelled) {
        return;
      }

      void import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 180 }))
        .catch(() => {
          // An older installed build carries no splash plugin, and there the
          // launch screen hides by itself. Nothing to do and nothing broken.
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
