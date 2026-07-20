"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SCROLL_REVEAL_SELECTOR = [
  ".dashboard-panel",
  ".dashboard-card",
  ".dashboard-item-card",
  ".dashboard-list-card",
  ".dashboard-compact-list-item",
  ".dashboard-page-hero",
  ".dashboard-profile-shift-grid > div",
  ".sa-overview-head",
  ".sa-overview-metric",
  ".sa-overview-card",
  ".super-admin-hero",
].join(",");

export function WorkbitRouteTransition() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    setActive(true);

    const timeout = window.setTimeout(() => setActive(false), 520);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(SCROLL_REVEAL_SELECTOR)
    ).filter(
      (element) =>
        !element.closest(".dashboard-week-card, .dashboard-calendar-day, .dashboard-calendar-scroll") &&
        !element.dataset.workbitScrollReveal
    );

    if (elements.length === 0) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.dataset.workbitScrollReveal = "visible";
        element.classList.add("workbit-scroll-reveal", "workbit-scroll-reveal--visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const element = entry.target as HTMLElement;
          element.dataset.workbitScrollReveal = "visible";
          element.classList.add("workbit-scroll-reveal--visible");
          observer.unobserve(element);
        }
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.12,
      }
    );

    elements.forEach((element, index) => {
      element.dataset.workbitScrollReveal = "pending";
      element.style.setProperty("--workbit-scroll-reveal-delay", `${Math.min(index * 22, 140)}ms`);
      element.classList.add("workbit-scroll-reveal");
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className={`workbit-route-transition${active ? " workbit-route-transition--active" : ""}`}
    />
  );
}
