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

const TONE_COLOR: Record<Tone, string> = {
  neutral: "var(--k-ink-3)",
  positive: "var(--k-pos)",
  warning: "var(--k-warn)",
  negative: "var(--k-neg)",
};

/** Palette for donuts whose slices are things (venues), not states. */
export const SERIES_COLORS = ["#6d28d9", "#0e7a5f", "#a5620d", "#3b6fd4", "#b3261e", "#8b8fa3"];

export type Slice = { label: string; value: number; tone?: Tone; color?: string };

/**
 * A donut. Drawn as one circle per slice with a dashed stroke, which keeps
 * the edges crisp at any size and needs no charting library. Every slice is
 * named in the legend with its value and share, and the total sits in the
 * middle, so the ring never has to be read by eye alone.
 */
export function Donut({
  slices,
  centerLabel,
  size = 150,
  thickness = 19,
  format = (value: number) => String(value),
}: {
  slices: Slice[];
  centerLabel: string;
  size?: number;
  thickness?: number;
  format?: (value: number) => string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const present = slices.filter((slice) => slice.value > 0);
  const total = present.reduce((sum, slice) => sum + slice.value, 0);

  let consumed = 0;

  return (
    <div className="wbc-donut">
      <div className="wbc-donut-figure" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="presentation">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--k-line)"
              strokeWidth={thickness}
            />
            {total > 0
              ? present.map((slice) => {
                  const length = (slice.value / total) * circumference;
                  const offset = -consumed;
                  consumed += length;

                  return (
                    <circle
                      key={slice.label}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={slice.color ?? TONE_COLOR[slice.tone ?? "neutral"]}
                      strokeWidth={thickness}
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={offset}
                    />
                  );
                })
              : null}
          </g>
        </svg>

        <div className="wbc-donut-center">
          <strong>{total > 0 ? format(total) : "—"}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>

      <ul className="wbc-donut-legend">
        {slices.map((slice) => (
          <li key={slice.label}>
            <span
              className="wbc-dot"
              style={{ background: slice.color ?? TONE_COLOR[slice.tone ?? "neutral"] }}
              aria-hidden="true"
            />
            <span className="wbc-donut-legend-label">{slice.label}</span>
            <span className="wbc-donut-legend-value">
              {format(slice.value)}
              {total > 0 ? <i>{Math.round((slice.value / total) * 100)}%</i> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A column plot. Laid out with flex rather than SVG so it stays sharp and
 * responsive at any width; the gridlines come from a repeating gradient.
 * The scale is stated (peak at top) and the peak column is named, so every
 * label on the chart refers to a value the chart actually reaches.
 */
export function ColumnChart({
  data,
  caption,
  height = 108,
  format = (value: number) => String(value),
}: {
  data: Array<{ label: string; value: number }>;
  caption?: string;
  height?: number;
  format?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <Empty>Nessun dato nel periodo.</Empty>;
  }

  const max = Math.max(1, ...data.map((point) => point.value));
  const peak = data.reduce((best, point) => (point.value > best.value ? point : best), data[0]);
  const total = data.reduce((sum, point) => sum + point.value, 0);

  return (
    <div className="wbc-chart">
      <div className="wbc-chart-head">
        <span className="wbc-chart-scale">picco {format(max)}</span>
        {caption ? <span className="wbc-chart-scale">{caption}</span> : null}
      </div>

      <div className="wbc-chart-plot" style={{ height, gap: data.length > 20 ? 2 : 3 }}>
        {data.map((point, index) => (
          <span key={`${point.label}-${index}`} className="wbc-col" title={`${point.label}: ${format(point.value)}`}>
            {/* A day with nothing in it draws nothing, so an empty column is
                never mistaken for a small value. */}
            {point.value > 0 ? (
              <span className="wbc-col-fill" style={{ height: `${Math.max(3, (point.value / max) * 100)}%` }} />
            ) : null}
          </span>
        ))}
      </div>

      <div className="wbc-chart-axis">
        <span>{data[0]?.label}</span>
        {total > 0 ? (
          <span className="wbc-chart-peak">
            max {format(peak.value)} il {peak.label}
          </span>
        ) : (
          <span className="wbc-chart-peak">nessuna attività</span>
        )}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** A terse machine-readable status line, the way a console states its state. */
export function Stamp({ parts }: { parts: string[] }) {
  return (
    <p className="wbc-stamp">
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 ? <i aria-hidden="true">·</i> : null}
          {part}
        </span>
      ))}
    </p>
  );
}

