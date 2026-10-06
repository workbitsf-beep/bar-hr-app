"use client";

import { useId } from "react";

/**
 * The Workbit mark without its tile: the orbit, the W and the B.
 *
 * The same drawing the opening builds stroke by stroke (app/layout.tsx), here
 * still. Redrawn as a vector from logo.png, so it stays sharp at any size and
 * there is no picture to wait for. The W is navy on light grounds and white on
 * dark ones; the B and the orbit keep their violet either way.
 */
export function BrandMark({
  size = 34,
  tone = "light",
  title,
}: {
  size?: number;
  /** The ground it sits on. */
  tone?: "light" | "dark";
  /** Spoken name; leave out where the mark sits next to its own label. */
  title?: string;
}) {
  // Several marks can be on one page: gradient ids must not collide.
  const id = useId().replace(/:/g, "");
  const bFill = `wb-mark-b-${id}`;
  const orbit = `wb-mark-orbit-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
    >
      <defs>
        <linearGradient id={bFill} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#d27cff" />
          <stop offset="100%" stopColor="#7b34f0" />
        </linearGradient>
        <linearGradient id={orbit} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9b5cff" stopOpacity="0.3" />
          <stop offset="45%" stopColor="#a66bff" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${orbit})`} strokeWidth={16} strokeLinecap="round">
        <path d="M 112 352 A 440 440 0 0 1 652 110" />
        <path d="M 922 712 A 440 440 0 0 1 362 948" />
      </g>
      <polygon
        fill={tone === "dark" ? "#ffffff" : "#17183d"}
        points="140,362 265,362 338,575 400,433 452,433 512,575 560,362 668,362 548,705 468,705 426,590 384,705 300,705"
      />
      <path
        fill={`url(#${bFill})`}
        fillRule="evenodd"
        d="M 690 360 H 825 C 885 360 915 395 905 445 C 900 480 880 505 850 518 C 895 535 915 570 908 615 C 900 670 855 705 790 705 H 540 Z M 696 438 L 676 497 H 800 C 822 497 836 486 838 468 C 840 450 828 438 808 438 Z M 655 575 L 635 632 H 793 C 818 632 834 620 836 601 C 838 584 825 575 802 575 Z"
      />
    </svg>
  );
}
