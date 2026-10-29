import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/*
 * The app's page style since 29 Oct 2026 (Loris chose it as "il mix"): his
 * Oggi look made more minimal. A violet line above a big title says what the
 * page is for; white cards with a light border carry a bold title inside;
 * rows are low; pills and avatars are small and light. Every page is built
 * from these pieces, so a page reads like the others at a glance.
 */

export const MIX = {
  ink: "#111827",
  quiet: "#667085",
  violet: "#5e4ae3",
  border: "#ece9f7",
  rule: "#f1eff8",
} as const;

/** The page's title and its buttons on the right. No line above the title: Loris found it ugly and useless (29 Oct). */
export function PageHead({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 56 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05, color: MIX.ink }}>{title}</h1>
      </div>
      {actions ? <div style={{ display: "flex", gap: 10, alignItems: "center", flex: "0 0 auto" }}>{actions}</div> : null}
    </header>
  );
}

export const mixCard: CSSProperties = {
  background: "#ffffff",
  border: `1px solid ${MIX.border}`,
  borderRadius: 20,
  padding: "12px 16px",
  boxShadow: "0 3px 10px rgba(76, 29, 149, 0.04)",
  color: MIX.ink,
  minWidth: 0,
};

/** A card of the page: its bold title inside, an aside on the right, rows under it. */
export function MixCard({ title, aside, children, style }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ ...mixCard, ...style }}>
      {title || aside ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 14.5, fontWeight: 750, letterSpacing: "-0.01em", marginBottom: 4 }}>
          <span>{title}</span>
          {aside ? <span style={{ fontSize: 13, fontWeight: 400, color: MIX.quiet }}>{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** One low row inside a card; the first one of a card has no rule above it. */
export const mixRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 0",
  borderTop: `1px solid ${MIX.rule}`,
  fontSize: 15,
  color: MIX.ink,
  textDecoration: "none",
  minWidth: 0,
};

export function MixRows({ children }: { children: ReactNode }) {
  return <div className="wb-mix-rows">{children}</div>;
}

const PILL_TONES = {
  wait: { background: "#fdf0c4", color: "#92400e" },
  good: { background: "#dcfce7", color: "#166534" },
  bad: { background: "#fdecec", color: "#b3202f" },
  violet: { background: "#f1eeff", color: "#4c1d95" },
  grey: { background: "#f4f3f9", color: "#6f6a88" },
} as const;

export type PillTone = keyof typeof PILL_TONES;

export function Pill({ tone = "grey", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", ...PILL_TONES[tone] }}>{children}</span>
  );
}

/** Initials (or an emoji) in a light lilac circle. */
export function Avatar({ children, size = 30 }: { children: ReactNode; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "#f1eeff",
        color: "#4c1d95",
        fontSize: size > 40 ? 19 : 11.5,
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      {children}
    </span>
  );
}

/** Two lines: a name in bold, a quiet detail under it. */
export function Stacked({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <span style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2, flex: 1, minWidth: 0 }}>
      <b style={{ fontWeight: 650, overflowWrap: "anywhere" }}>{title}</b>
      {detail ? <span style={{ color: MIX.quiet, fontSize: 13 }}>{detail}</span> : null}
    </span>
  );
}

/** A single quiet line with a coloured dot, for a fact that needs no card. */
export function MixLine({ dot = "#22c55e", children, href }: { dot?: string; children: ReactNode; href?: string }) {
  const style: CSSProperties = {
    background: "#fbfaff",
    border: `1px solid ${MIX.border}`,
    borderRadius: 16,
    padding: "10px 14px",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: MIX.ink,
    textDecoration: "none",
  };
  const body = (
    <>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: dot, flex: "0 0 auto" }} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </>
  );
  return href ? (
    <Link href={href} style={style}>
      {body}
    </Link>
  ) : (
    <div style={style}>{body}</div>
  );
}

/** The views of a page: a segmented bar of links, never a dropdown. */
export function Segmented({ items, label }: { items: { href: string; label: string; active: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} style={{ display: "flex", background: "#eeebf7", borderRadius: 14, padding: 3 }}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "center",
            padding: "7px 0",
            borderRadius: 11,
            fontSize: 13.5,
            textDecoration: "none",
            whiteSpace: "nowrap",
            color: item.active ? "#1f1b3a" : "#5b5675",
            fontWeight: item.active ? 600 : 500,
            background: item.active ? "#ffffff" : "transparent",
            boxShadow: item.active ? "0 1px 2px rgba(31,27,58,.08)" : "none",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** The column every page sits in. */
export const mixPage: CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "minmax(0, 1fr)",
  maxWidth: 640,
  margin: "0 auto",
  width: "100%",
  padding: "4px 4px 8px",
  color: MIX.ink,
};
