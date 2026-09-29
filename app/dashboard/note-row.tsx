import type { ReactNode } from "react";
import type { NoteMeta } from "@/lib/note-list-format";

/**
 * A note, wherever it is shown.
 *
 * The Note page and the calendar's day popup drew the same note two different
 * ways - different sizes, different wording, one with a pill the other without.
 * They draw it here now. Only the action on the right differs, because a page
 * confirms a note with a form and the calendar with a callback, and that is
 * handed in.
 */
export function NoteRow({
  title,
  meta,
  footnote,
  action,
  compact = false,
}: {
  title: string;
  meta: NoteMeta;
  /** Who else confirmed it: on a team check, the proof it was done. */
  footnote?: string | null;
  action?: ReactNode;
  compact?: boolean;
}) {
  // It used to read the first line of the meta and look for the words "fatta
  // da", which meant a note nobody had signed stayed black and upright after
  // it was finished. The meta says so outright now.
  const done = meta.done;

  return (
    <div
      className="workbit-note-card"
      style={{
        display: "grid",
        gridTemplateColumns: action ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
        alignItems: "center",
        gap: 12,
        padding: compact ? "11px 12px" : "13px 14px",
        borderRadius: compact ? 15 : 18,
        border: "1px solid #e9edf3",
        borderLeft: meta.accent ? `3px solid ${meta.accent}` : "1px solid #e9edf3",
        background: "#ffffff",
      }}
    >
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <strong
          style={{
            fontSize: compact ? 14 : 15.5,
            letterSpacing: "-0.015em",
            color: done ? "#94a3b8" : "#0f172a",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {title}
        </strong>
        <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 650 }}>
          {meta.parts.map((part, index) => (
            <span key={part.text}>
              {index > 0 ? " · " : ""}
              <span style={part.alarming ? { color: "#b91c1c", fontWeight: 800 } : undefined}>
                {part.text}
              </span>
            </span>
          ))}
        </span>
        {footnote ? (
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 650 }}>{footnote}</span>
        ) : null}
      </div>

      {action}
    </div>
  );
}
