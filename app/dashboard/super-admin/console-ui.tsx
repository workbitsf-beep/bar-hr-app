import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

export type Tone = "neutral" | "positive" | "warning" | "negative";

export function Figure({
  label,
  value,
  meta,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  meta?: string;
  tone?: Tone;
}) {
  // Word values ("Attivo") need far more room per character than figures do,
  // so they get their own smaller size instead of overflowing the column.
  const isWord = typeof value === "string" && !/^[\d\s.,%+€-]+$/.test(value);

  return (
    <div className="wbc-figure">
      <span className="wbc-label">{label}</span>
      <strong className={`wbc-figure-value${isWord ? " wbc-figure-word" : ""} wbc-t-${tone}`}>{value}</strong>
      {meta ? <span className="wbc-figure-meta">{meta}</span> : null}
    </div>
  );
}

export function FigureBand({ children }: { children: ReactNode }) {
  return <div className="wbc-figure-band">{children}</div>;
}

export function Section({
  title,
  action,
  children,
  flush = false,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="wbc-section">
      {title || action ? (
        <header className="wbc-section-head">
          {title ? <h2 className="wbc-label">{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      <div className={flush ? "wbc-section-body wbc-flush" : "wbc-section-body"}>{children}</div>
    </section>
  );
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  return <span className={`wbc-dot wbc-bg-${tone}`} aria-hidden="true" />;
}

export function Status({ tone = "neutral", label }: { tone?: Tone; label: string }) {
  return (
    <span className="wbc-status">
      <Dot tone={tone} />
      <span className={`wbc-t-${tone}`}>{label}</span>
    </span>
  );
}

/**
 * The console's workhorse: a hairline-separated record. Used instead of cards
 * so long lists stay scannable and the page reads as one continuous document.
 */
export function Row({
  href,
  title,
  meta,
  status,
  value,
  valueMeta,
}: {
  href?: string;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  value?: string;
  valueMeta?: string;
}) {
  const body = (
    <>
      <span className="wbc-row-main">
        <span className="wbc-row-title">{title}</span>
        {meta ? <span className="wbc-row-meta">{meta}</span> : null}
      </span>

      {status || value || valueMeta ? (
        <span className="wbc-row-side">
          {status}
          {value ? <span className="wbc-row-value">{value}</span> : null}
          {valueMeta ? <span className="wbc-row-value-meta">{valueMeta}</span> : null}
        </span>
      ) : null}

      {href ? (
        <svg className="wbc-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="wbc-row wbc-row-link">
        {body}
      </Link>
    );
  }

  return <div className="wbc-row">{body}</div>;
}

export function Field({
  label,
  hint,
  children,
  span,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <label className="wbc-field" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <span className="wbc-field-label">{label}</span>
      {children}
      {hint ? <span className="wbc-field-hint">{hint}</span> : null}
    </label>
  );
}

/**
 * Same furniture as Field, but not a <label> — for groups that hold more than
 * one control, where a wrapping label would hijack clicks on the extra ones.
 */
export function Group({
  label,
  hint,
  children,
  span,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <div className="wbc-field" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <span className="wbc-field-label">{label}</span>
      {children}
      {hint ? <span className="wbc-field-hint">{hint}</span> : null}
    </div>
  );
}

export function FieldGrid({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="wbc-field-grid" style={style}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="wbc-empty">{children}</p>;
}

export function Note({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <p className={`wbc-note wbc-note-${tone}`}>{children}</p>;
}

export function DataList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="wbc-datalist">
      {items.map((item) => (
        <div key={item.label} className="wbc-datalist-row">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Forbidden() {
  return (
    <div className="wbc-page">
      <Section title="Accesso negato">
        <Empty>Questa area è riservata al super admin.</Empty>
      </Section>
    </div>
  );
}

/** A horizontal proportion bar. Segments with a zero share are dropped. */
export function Distribution({
  segments,
}: {
  segments: Array<{ label: string; value: number; tone: Tone }>;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="wbc-dist">
      <div className="wbc-dist-track">
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment) => (
                <span
                  key={segment.label}
                  className={`wbc-bg-${segment.tone}`}
                  style={{ width: `${(segment.value / total) * 100}%` }}
                />
              ))
          : null}
      </div>
      <div className="wbc-dist-legend">
        {segments.map((segment) => (
          <span key={segment.label} className="wbc-dist-item">
            <Dot tone={segment.tone} />
            {segment.label}
            <strong>{segment.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
