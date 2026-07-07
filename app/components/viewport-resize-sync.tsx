"use client";

import { useEffect } from "react";

export function ViewportResizeSync() {
  useEffect(() => {
    let frame = 0;

    function syncViewport() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const width = Math.round(viewport?.width ?? window.innerWidth);
        const height = Math.round(viewport?.height ?? window.innerHeight);
        const root = document.documentElement;

        root.style.setProperty("--workbit-vw", `${width}px`);
        root.style.setProperty("--workbit-vh", `${height}px`);
      });
    }

    syncViewport();

    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
    };
  }, []);

  return null;
}
