import type { ReactNode } from "react";
import type { NoteMeta } from "@/lib/note-list-format";

export type NoteChip = { text: string; tone: "plain" | "alarm" | "day" };

const CHIP = {
  plain: { background: "#f4f3f9", color: "#6f6a88" },
  alarm: { background: "#fdecec", color: "#b3202f" },
  day: { background: "#f1eeff", color: "#4c1d95" },
};

/** The meta of a note as small chips: what is wrong in red, a day ahead in violet. */
export function chipsOf(meta: NoteMeta, options: { ahead: boolean; repeat: boolean; department: string | null }): NoteChip[] {
  return [
    ...meta.parts.map((part, index): NoteChip => {
      if (part.alarming) return { text: part.text.charAt(0).toUpperCase() + part.text.slice(1), tone: "alarm" };
      const text = part.text.charAt(0).toUpperCase() + part.text.slice(1);
      if (index === 0 && options.ahead && !meta.done) return { text: `📅 ${text}`, tone: "day" };
      if (options.repeat && /^ogni|^tutti/i.test(part.text)) return { text: `🔁 ${part.text}`, tone: "plain" };
      return { text, tone: "plain" };
    }),
    ...(options.department ? [{ text: options.department, tone: "plain" as const }] : []),
  ];
}

/**
 * A note as a card: the round tick on the left, the text, its chips. A note
 * with nothing to confirm shows 📣 where the tick would be.
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
        alignItems: "flex-start",
        boxShadow: urgent && !done ? "inset 3px 0 0 #e5484d, 0 1px 2px rgba(31,27,58,.04)" : "0 1px 2px rgba(31,27,58,.04)",
      }}
    >
      <span style={{ flex: "0 0 auto", width: 28, display: "flex", justifyContent: "center", marginTop: 0 }}>
        {done ? (
          <span aria-label="Fatta" style={{ width: 26, height: 26, borderRadius: 999, background: "#10b981", color: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            ✓
          </span>
        ) : (
          tick ?? <span aria-hidden style={{ fontSize: 18, lineHeight: "26px" }}>📣</span>
        )}
      </span>
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
    </div>
  );
}

/** The empty round tick that confirms a note. */
export const tickStyle = {
  width: 26,
  height: 26,
  borderRadius: 999,
  border: 0,
  background: "#ffffff",
  boxShadow: "inset 0 0 0 2px #d9d5e8",
  cursor: "pointer",
  padding: 0,
  display: "block",
} as const;
