import type { ReactNode } from "react";
import type { NoteMeta } from "@/lib/note-list-format";
import { APP_TIME_ZONE } from "@/lib/time-zone";

export type NoteChip = { text: string; tone: "plain" | "alarm" | "day" };

const CHIP = {
  plain: { background: "#f4f3f9", color: "#6f6a88" },
  alarm: { background: "#fdecec", color: "#b3202f" },
  day: { background: "#f1eeff", color: "#4c1d95" },
};

/** The meta of a note as small chips: what is wrong in red, a day ahead in violet. */
export function chipsOf(meta: NoteMeta, options: { ahead: boolean; repeat: boolean; department: string | null; date: Date; next?: Date | null }): NoteChip[] {
  // "Oggi" alone says nothing a week later in the archive: the date goes with it.
  const dayMonth = (date: Date) => new Intl.DateTimeFormat("it-IT", { timeZone: APP_TIME_ZONE, day: "numeric", month: "short" }).format(date).replace(/\.$/, "");
  const dated = (text: string) =>
    /^(oggi|domani|ieri)$/i.test(text)
      ? `${text} · ${dayMonth(options.date)}`
      : text;
  return [
    ...meta.parts.map((part, index): NoteChip => {
      if (part.alarming) return { text: part.text.charAt(0).toUpperCase() + part.text.slice(1), tone: "alarm" };
      const base = index === 0 && !meta.done ? dated(part.text) : part.text;
      const text = base.charAt(0).toUpperCase() + base.slice(1);
      if (index === 0 && options.ahead && !meta.done) return { text: `📅 ${text}`, tone: "day" };
      if (options.repeat && /^ogni|^tutti/i.test(part.text)) return { text: `🔁 ${part.text}${options.next ? ` · poi ${dayMonth(options.next)}` : ""}`, tone: "plain" };
      return { text, tone: "plain" };
    }),
    ...(options.department ? [{ text: options.department, tone: "plain" as const }] : []),
  ];
}

/**
 * A note as a card: the text and its chips, the green tick on the right. A
 * note with nothing to confirm has no tick.
 */
export function NoteCard({
  title,
  chips,
  done,
  urgent,
  tick,
  footnote,
}: {
  title: string;
  chips: NoteChip[];
  done: boolean;
  urgent: boolean;
  /** The confirm button, or null when there is nothing to tick. */
  tick: ReactNode;
  footnote?: string | null;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 20,
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "center",
        boxShadow: urgent && !done ? "inset 3px 0 0 #e5484d, 0 1px 2px rgba(31,27,58,.04)" : "0 1px 2px rgba(31,27,58,.04)",
      }}
    >
      <span style={{ display: "grid", gap: 6, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16, lineHeight: 1.3, color: done ? "#8a85a3" : "#1f1b3a", textDecoration: done ? "line-through" : "none", overflowWrap: "anywhere" }}>{title}</span>
        {chips.length ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {chips.map((chip) => (
              <span key={chip.text} style={{ fontSize: 12.5, padding: "3px 9px", borderRadius: 999, ...CHIP[chip.tone] }}>
                {chip.text}
              </span>
            ))}
          </span>
        ) : null}
        {footnote ? <span style={{ fontSize: 12.5, color: "#8a85a3" }}>{footnote}</span> : null}
      </span>
      {done ? (
        <span aria-label="Fatta" style={{ flex: "0 0 auto", width: 40, height: 40, borderRadius: 999, background: "#10b981", color: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>
          ✓
        </span>
      ) : tick ? (
        <span style={{ flex: "0 0 auto" }}>{tick}</span>
      ) : null}
    </div>
  );
}

/** The green tick on the right that confirms a note. */
export const tickStyle = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: "1px solid #bbf7d0",
  background: "#dcfce7",
  color: "#166534",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} as const;
