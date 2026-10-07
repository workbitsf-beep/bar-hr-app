/**
 * The Workbit mark redrawn for the console: the orbit closes into a ring with
 * four venues on it - the network, seen from above. Used where a super admin
 * who is inside a venue goes back to the console.
 */
export function ConsoleMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-20 -20 1064 1064" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="wb-console-b" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#c06bff" />
          <stop offset="100%" stopColor="#6d2ff0" />
        </linearGradient>
      </defs>
      <circle cx="512" cy="530" r="440" fill="none" stroke="#8b4dff" strokeWidth="44" strokeOpacity="0.55" />
      <g fill="#6d3df0">
        <circle cx="512" cy="90" r="70" />
        <circle cx="952" cy="530" r="70" />
        <circle cx="512" cy="970" r="70" />
        <circle cx="72" cy="530" r="70" />
      </g>
      <polygon
        fill="#15132b"
        points="140,362 265,362 338,575 400,433 452,433 512,575 560,362 668,362 548,705 468,705 426,590 384,705 300,705"
      />
      <path
        fill="url(#wb-console-b)"
        fillRule="evenodd"
        d="M 690 360 H 825 C 885 360 915 395 905 445 C 900 480 880 505 850 518 C 895 535 915 570 908 615 C 900 670 855 705 790 705 H 540 Z M 696 438 L 676 497 H 800 C 822 497 836 486 838 468 C 840 450 828 438 808 438 Z M 655 575 L 635 632 H 793 C 818 632 834 620 836 601 C 838 584 825 575 802 575 Z"
      />
    </svg>
  );
}
