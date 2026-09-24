"use client";

import { useEffect } from "react";

export function ViewportResizeSync() {
  useEffect(() => {
    let frame = 0;
    let lastWidth = -1;
    let lastHeight = -1;
    const timers = new Set<number>();

    function clearSettledTimers() {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      timers.clear();
    }

    function syncViewport() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const width = Math.round(viewport?.width ?? window.innerWidth);
        const height = Math.round(viewport?.height ?? window.innerHeight);

        // visualViewport fires "scroll" on every scrolled frame, but the size
        // only actually changes when the keyboard or a browser bar moves.
        // These custom properties drive layout (page min-height, bottom nav
        // width, modal sizes), so rewriting them unchanged forced a style
        // recalculation on every frame of every scroll.
        if (width === lastWidth && height === lastHeight) {
          return;
        }

        lastWidth = width;
        lastHeight = height;
        const root = document.documentElement;

        root.style.setProperty("--workbit-vw", `${width}px`);
        root.style.setProperty("--workbit-vh", `${height}px`);
        root.style.setProperty(
          "--workbit-orientation",
          width > height ? "landscape" : "portrait"
        );
        root.dataset.workbitCompact = width <= 900 ? "true" : "false";
        root.dataset.viewportSync = `${width}x${height}`;
      });
    }

    function syncViewportSettled() {
      syncViewport();
      clearSettledTimers();

      for (const delay of [80, 240, 600, 1000]) {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          syncViewport();
        }, delay);
        timers.add(timer);
      }
    }

    syncViewport();

    window.addEventListener("resize", syncViewportSettled);
    window.addEventListener("orientationchange", syncViewportSettled);
    window.visualViewport?.addEventListener("resize", syncViewportSettled);
    window.visualViewport?.addEventListener("scroll", syncViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      clearSettledTimers();
      window.removeEventListener("resize", syncViewportSettled);
      window.removeEventListener("orientationchange", syncViewportSettled);
      window.visualViewport?.removeEventListener("resize", syncViewportSettled);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
    };
  }, []);

  return null;
}
