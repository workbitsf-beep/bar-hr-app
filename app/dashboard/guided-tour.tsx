"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TOUR_SEEN_PREFIX, tourFor, type TourProfile, type TourStep } from "@/lib/tours";

/** Asked by "Rivedi la guida": forget what was seen and start again here. */
export const TOUR_REPLAY_EVENT = "wb-tour-replay";

type Box = { top: number; left: number; width: number; height: number };

function seen(key: string) {
  try {
    return window.localStorage.getItem(TOUR_SEEN_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    window.localStorage.setItem(TOUR_SEEN_PREFIX + key, "1");
  } catch {
    // Private mode: the tour may show again, which is harmless.
  }
}

/** The first match that is really on screen (the phone and the computer layouts are both in the page). */
function findTarget(selector: string): HTMLElement | null {
  let nodes: HTMLElement[] = [];
  try {
    nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  } catch {
    return null;
  }
  return (
    nodes.find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
    }) ?? null
  );
}

function boxOf(node: HTMLElement): Box {
  const rect = node.getBoundingClientRect();
  const pad = 6;
  return { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
}

/**
 * The guide while the app is used (lib/tours.ts): the screen dims, the thing
 * to use lights up with a hand on it, and a bubble says what it does, with
 * Avanti and Salta. Each page's tour is shown once on this device.
 */
export function GuidedTour({ enabled, profile }: { enabled: boolean; profile: TourProfile }) {
  const pathname = usePathname();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [tourKey, setTourKey] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [replay, setReplay] = useState(0);

  // Start the page's tour once the page has settled, with only the steps whose thing is there.
  useEffect(() => {
    setSteps(null);
    setBox(null);
    if (!enabled) return;
    const tour = tourFor(pathname, profile);
    if (!tour || seen(tour.key)) return;
    const timer = window.setTimeout(() => {
      const present = tour.steps.filter((step) => findTarget(step.target));
      if (!present.length) return;
      setTourKey(tour.key);
      setIndex(0);
      setSteps(present);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [enabled, pathname, profile, replay]);

  useEffect(() => {
    const onReplay = () => {
      try {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith(TOUR_SEEN_PREFIX))
          .forEach((key) => window.localStorage.removeItem(key));
      } catch {
        // Nothing stored: nothing to forget.
      }
      setReplay((value) => value + 1);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, []);

  const step = steps?.[index] ?? null;

  // Bring the thing on screen, then follow it while the page scrolls or resizes.
  useEffect(() => {
    if (!step) return;
    const node = findTarget(step.target);
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    let frame = 0;
    const follow = () => {
      const current = findTarget(step.target);
      if (current) setBox(boxOf(current));
      frame = window.requestAnimationFrame(follow);
    };
    frame = window.requestAnimationFrame(follow);
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const close = useCallback(() => {
    if (tourKey) markSeen(tourKey);
    setSteps(null);
    setBox(null);
  }, [tourKey]);

  if (!steps || !step || !box || typeof document === "undefined") return null;

  const last = index === steps.length - 1;
  const viewportHeight = window.innerHeight;
  const below = box.top + box.height + 230 < viewportHeight || box.top < 240;
  const tipStyle = below ? { top: box.top + box.height + 16 } : { bottom: viewportHeight - box.top + 16 };
  const arrowLeft = Math.min(Math.max(box.left + box.width / 2 - 8, 28), window.innerWidth - 44);
  const gesture = step.gesture;

  return createPortal(
    <div className="wb-tour" role="dialog" aria-modal="true" aria-label={step.title}>
      <style>{TOUR_CSS}</style>
      <div className="wb-tour-block" onClick={(event) => event.stopPropagation()} />
      <div className="wb-tour-spot" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
      {gesture ? (
        <span
          aria-hidden
          className={`wb-tour-hand wb-tour-hand--${gesture}`}
          style={{
            top: box.top + box.height / 2 + (gesture === "tap" ? 4 : -10),
            left: gesture === "swipe-left" ? box.left + box.width * 0.72 : gesture === "swipe-right" ? box.left + box.width * 0.18 : box.left + box.width / 2 - 6,
          }}
        >
          {gesture === "tap" ? "👆" : gesture === "swipe-left" ? "👈" : "👉"}
        </span>
      ) : null}
      <span aria-hidden className="wb-tour-arrow" style={{ left: arrowLeft, ...(below ? { top: box.top + box.height + 9 } : { top: box.top - 25 }) }} />
      <div className="wb-tour-tip" style={tipStyle}>
        <b>{step.title}</b>
        <p>{step.body}</p>
        <div className="wb-tour-foot">
          <span className="wb-tour-dots" aria-label={`${index + 1} di ${steps.length}`}>
            {steps.map((entry, position) => (
              <i key={entry.target} className={position === index ? "on" : undefined} />
            ))}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {last ? null : (
              <button type="button" className="wb-tour-skip" onClick={close}>
                Salta
              </button>
            )}
            <button type="button" className="wb-tour-next" onClick={() => (last ? close() : setIndex(index + 1))}>
              {last ? "Ho capito" : "Avanti"}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

const TOUR_CSS = `
.wb-tour { position: fixed; inset: 0; z-index: 10000; }
.wb-tour-block { position: fixed; inset: 0; }
.wb-tour-spot {
  position: fixed; border-radius: 18px; pointer-events: none;
  box-shadow: 0 0 0 4px #ffffff, 0 0 0 9px rgba(139, 92, 246, 0.6), 0 0 0 200vmax rgba(17, 12, 40, 0.62);
  transition: top .28s ease, left .28s ease, width .28s ease, height .28s ease;
}
.wb-tour-tip {
  position: fixed; left: 16px; right: 16px; max-width: 420px; margin: 0 auto;
  background: #ffffff; border-radius: 20px; padding: 15px 16px 12px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28); color: #111827;
  animation: wb-tour-in .22s ease both;
}
.wb-tour-tip b { display: block; font-size: 16.5px; font-weight: 750; margin-bottom: 4px; letter-spacing: -0.01em; }
.wb-tour-tip p { margin: 0; color: #475467; font-size: 14.5px; line-height: 1.42; }
.wb-tour-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; gap: 10px; }
.wb-tour-dots { display: inline-flex; gap: 5px; }
.wb-tour-dots i { width: 6px; height: 6px; border-radius: 9px; background: #d7d1f1; transition: width .2s ease; }
.wb-tour-dots i.on { background: #5e4ae3; width: 16px; }
.wb-tour-skip { border: 0; background: none; color: #8a85a3; font-size: 14px; padding: 8px 10px; cursor: pointer; }
.wb-tour-next { border: 0; background: #5e4ae3; color: #ffffff; border-radius: 999px; padding: 9px 18px; font-weight: 700; font-size: 14.5px; cursor: pointer; }
.wb-tour-arrow { position: fixed; width: 16px; height: 16px; background: #ffffff; transform: rotate(45deg); pointer-events: none; }
.wb-tour-hand { position: fixed; font-size: 34px; line-height: 1; pointer-events: none; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35)); }
.wb-tour-hand--tap { animation: wb-tour-tap 1.3s ease-in-out infinite; }
.wb-tour-hand--swipe-right { animation: wb-tour-swipe-right 1.6s ease-in-out infinite; }
.wb-tour-hand--swipe-left { animation: wb-tour-swipe-left 1.6s ease-in-out infinite; }
@keyframes wb-tour-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes wb-tour-tap { 0%, 100% { transform: translateY(0) scale(1); } 45% { transform: translateY(-8px) scale(1.05); } 60% { transform: translateY(0) scale(0.92); } }
@keyframes wb-tour-swipe-right { 0% { transform: translateX(0); opacity: 0; } 15% { opacity: 1; } 75% { transform: translateX(120px); opacity: 1; } 100% { transform: translateX(130px); opacity: 0; } }
@keyframes wb-tour-swipe-left { 0% { transform: translateX(0); opacity: 0; } 15% { opacity: 1; } 75% { transform: translateX(-120px); opacity: 1; } 100% { transform: translateX(-130px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .wb-tour-hand, .wb-tour-tip { animation: none; } }
`;

/** "Rivedi la guida" in Impostazioni: the row it is given, as a button. */
export function ReplayTourButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent", textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }}
      onClick={() => {
        window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
        window.location.assign("/dashboard");
      }}
    >
      {children}
    </button>
  );
}
