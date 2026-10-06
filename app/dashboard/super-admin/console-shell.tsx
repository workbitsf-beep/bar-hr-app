import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ConsoleAccount } from "./console-account";
import { ConsoleRail } from "./console-rail";
import { VenueJump } from "./console-venue-jump";

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='m1 1.5 5 5 5-5' stroke='%239a9cac' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export function ConsoleShell({
  userName,
  venues,
  accountPanel,
  children,
}: {
  userName: string;
  venues: Array<{ id: string; name: string }>;
  accountPanel: ReactNode;
  children: ReactNode;
}) {
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "W";

  return (
    <div className="wbc-root">
      <header className="wbc-head">
        <div className="wbc-head-in">
          <span className="wbc-mark">
            <BrandMark size={36} />
            <span>
              Workbit
              <small>Console</small>
            </span>
          </span>

          <div className="wbc-head-tools">
            <VenueJump venues={venues} />

            <ConsoleAccount initials={initials} name={userName}>
              {accountPanel}
            </ConsoleAccount>
          </div>
        </div>
      </header>

      <div className="wbc-scroll">{children}</div>

      <ConsoleRail />

      <style
        dangerouslySetInnerHTML={{
          __html: `
.wbc-root {
  --k-paper: #ffffff;
  --k-ink: #15132b;
  --k-ink-2: #4c4670;
  --k-ink-3: #8a84a8;
  --k-line: #efe9fc;
  --k-line-strong: #ddd3f8;
  --k-accent: #6d3df0;
  --k-accent-2: #9b5cff;
  --k-accent-soft: #efe8ff;
  --k-pos: #1f9d63;
  --k-warn: #b7791f;
  --k-neg: #c2334d;
  --k-fill: #fbfaff;
  --k-card: rgba(255, 255, 255, 0.86);
  --k-shadow: 0 18px 44px rgba(80, 40, 160, 0.08);
  --k-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(60% 40% at 85% 0%, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0) 70%),
    linear-gradient(180deg, #f1ebff 0%, #e2d6fc 70%, #d6c6f8 100%);
  color: var(--k-ink);
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}

.wbc-root *, .wbc-root *::before, .wbc-root *::after { box-sizing: border-box; }

/* ---------- chrome ---------- */
/* Inside the installed app the system bar sizes arrive as --wb-inset-*, since
   a web view is not told about them through env(). In a browser those
   variables are absent and env() answers instead. */
.wbc-head {
  flex: 0 0 auto;
  background: rgba(241, 235, 255, 0.82);
  border-bottom: 1px solid rgba(109, 61, 240, 0.08);
  backdrop-filter: saturate(1.4) blur(12px);
  -webkit-backdrop-filter: saturate(1.4) blur(12px);
  padding-top: max(env(safe-area-inset-top, 0px), var(--wb-inset-top, 0px));
}

.wbc-head-in {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  max-width: 920px;
  margin: 0 auto;
  width: 100%;
}

.wbc-mark {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--k-ink);
}

.wbc-mark small {
  display: block;
  margin-top: 1px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--k-accent);
}

.wbc-head-tools { display: flex; align-items: center; gap: 9px; flex: 0 1 auto; min-width: 0; }

.wbc-jump {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 160px;
  min-width: 0;
  height: 38px;
  padding: 0 15px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 0 0 1px rgba(109, 61, 240, 0.18);
  color: var(--k-ink);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}

.wbc-jump svg { flex: 0 0 auto; color: var(--k-accent); }
.wbc-jump span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbc-jump:disabled { opacity: 0.55; cursor: default; }

.wbc-jump-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 52px;
  padding: 0 16px;
  border: 1px solid var(--k-line);
  border-radius: 16px;
  background: #ffffff;
  color: var(--k-ink);
  font-family: inherit;
  font-size: 15px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}

.wbc-jump-row span { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.wbc-jump-row i { font-style: normal; color: var(--k-ink-3); font-size: 17px; }
.wbc-jump-row svg { flex: 0 0 auto; color: var(--k-accent); }
.wbc-jump-row:disabled { opacity: 0.55; cursor: default; }

@media (max-width: 400px) {
  .wbc-mark small { display: none; }
  .wbc-jump { max-width: 120px; }
}

.wbc-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 0;
  background: linear-gradient(120deg, #6d3df0, #9b5cff);
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
  flex: 0 0 auto;
  box-shadow: 0 8px 18px rgba(109, 61, 240, 0.28);
}

.wbc-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.wbc-page { padding: 26px 16px 40px; max-width: 920px; margin: 0 auto; }

/* The four sections stay at the bottom, as a floating bar. */
.wbc-rail {
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
  width: min(560px, calc(100% - 24px));
  margin: 0 auto calc(max(env(safe-area-inset-bottom, 0px), var(--wb-inset-bottom, 0px)) + 10px);
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: saturate(1.4) blur(12px);
  -webkit-backdrop-filter: saturate(1.4) blur(12px);
  box-shadow: 0 16px 40px rgba(80, 40, 160, 0.16);
}

.wbc-rail a {
  flex: 1 1 0;
  padding: 11px 4px;
  border-radius: 999px;
  text-align: center;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--k-ink-2);
  text-decoration: none;
}

.wbc-rail a[data-on="1"] {
  background: linear-gradient(120deg, #6d3df0, #9b5cff);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(109, 61, 240, 0.3);
}

/* ---------- page furniture ---------- */
.wbc-page-head { display: grid; gap: 10px; margin-bottom: 24px; }
.wbc-title {
  margin: 0;
  font-size: clamp(30px, 6vw, 44px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.045em;
  text-transform: uppercase;
  text-wrap: balance;
}
.wbc-desc { margin: 0; font-size: 15px; line-height: 1.55; color: var(--k-ink-2); max-width: 60ch; }

.wbc-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--k-accent);
  text-decoration: none;
}

.wbc-label {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--k-ink-3);
}

/* ---------- figures ---------- */
.wbc-figure-band {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.wbc-figure {
  display: grid;
  gap: 6px;
  align-content: start;
  padding: 16px 18px 18px;
  border-radius: 22px;
  background: #ffffff;
  box-shadow: var(--k-shadow);
  min-width: 0;
}

/* The first figure of a band is the one that matters: in violet. */
.wbc-figure:first-child { background: linear-gradient(135deg, #6d3df0, #9b5cff); color: #ffffff; }
.wbc-figure:first-child .wbc-label,
.wbc-figure:first-child .wbc-figure-meta { color: rgba(255, 255, 255, 0.82); }
.wbc-figure:first-child .wbc-figure-value { color: #ffffff; }

.wbc-figure-value {
  font-size: clamp(24px, 5.4vw, 34px);
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.wbc-figure-word { font-size: clamp(17px, 4.2vw, 22px); letter-spacing: -0.02em; }
.wbc-figure-meta { font-size: 12.5px; line-height: 1.4; color: var(--k-ink-2); }

/* ---------- sections: white cards ---------- */
.wbc-section {
  margin-top: 18px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: 26px;
  background: var(--k-card);
  box-shadow: var(--k-shadow);
}
.wbc-section:first-child { margin-top: 0; }

.wbc-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
}

.wbc-section-body { padding-top: 4px; display: grid; gap: 15px; }
.wbc-section-body.wbc-flush { padding-top: 0; gap: 8px; }

/* ---------- rows ---------- */
.wbc-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 15px;
  border: 1px solid var(--k-line);
  border-radius: 18px;
  background: #ffffff;
}
.wbc-row-link { text-decoration: none; color: inherit; transition: border-color 0.15s ease; }
.wbc-row-link:hover { border-color: var(--k-line-strong); }
.wbc-row-link:active { background: var(--k-fill); }
.wbc-row-main { flex: 1 1 auto; min-width: 0; display: grid; gap: 3px; }
.wbc-row-title { font-size: 15.5px; font-weight: 750; letter-spacing: -0.012em; overflow-wrap: anywhere; }
.wbc-row-meta { font-size: 13px; line-height: 1.4; color: var(--k-ink-3); overflow-wrap: anywhere; }
.wbc-row-side { flex: 0 0 auto; display: grid; gap: 4px; justify-items: end; text-align: right; }
.wbc-row-value { font-size: 14.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
.wbc-row-value-meta { font-size: 11.5px; color: var(--k-ink-3); font-variant-numeric: tabular-nums; }
.wbc-row-chevron { flex: 0 0 auto; color: var(--k-ink-3); }

/* ---------- status: soft pills ---------- */
.wbc-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: #f1eef9;
  font-size: 12px;
  font-weight: 750;
  white-space: nowrap;
}
.wbc-status:has(.wbc-t-positive) { background: #e2f6ec; }
.wbc-status:has(.wbc-t-warning) { background: #fff3dc; }
.wbc-status:has(.wbc-t-negative) { background: #fde8ec; }
.wbc-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
.wbc-bg-neutral { background: var(--k-ink-3); }
.wbc-bg-positive { background: var(--k-pos); }
.wbc-bg-warning { background: var(--k-warn); }
.wbc-bg-negative { background: var(--k-neg); }
.wbc-t-neutral { color: var(--k-ink); }
.wbc-t-positive { color: var(--k-pos); }
.wbc-t-warning { color: var(--k-warn); }
.wbc-t-negative { color: var(--k-neg); }

/* ---------- data list ---------- */
.wbc-datalist { margin: 0; display: grid; }
.wbc-datalist-row { display: flex; justify-content: space-between; align-items: baseline; gap: 18px; padding: 12px 0; border-bottom: 1px solid var(--k-line); }
.wbc-datalist-row:last-child { border-bottom: 0; }
.wbc-datalist-row dt { margin: 0; font-size: 14px; color: var(--k-ink-3); font-weight: 600; flex: 0 0 auto; }
.wbc-datalist-row dd { margin: 0; font-size: 14.5px; font-weight: 700; text-align: right; overflow-wrap: anywhere; }

/* ---------- donut ---------- */
.wbc-donut { display: flex; flex-wrap: wrap; align-items: center; gap: 22px; }
.wbc-donut-figure { position: relative; flex: 0 0 auto; }
.wbc-donut-figure svg { display: block; }

.wbc-donut-center {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 3px;
  text-align: center;
  pointer-events: none;
}

.wbc-donut-center strong {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.wbc-donut-center span {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--k-ink-3);
}

.wbc-donut-legend { flex: 1 1 190px; min-width: 0; margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }

.wbc-donut-legend li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--k-ink-2);
}

.wbc-donut-legend-label { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }

.wbc-donut-legend-value {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--k-ink);
}

.wbc-donut-legend-value i { font-style: normal; font-size: 11px; font-weight: 600; color: var(--k-ink-3); min-width: 32px; text-align: right; }

/* ---------- charts ---------- */
.wbc-chart { display: grid; gap: 10px; }
.wbc-chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }

.wbc-chart-scale {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--k-ink-3);
}

.wbc-chart-plot {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding-top: 2px;
  border-bottom: 1px solid var(--k-line-strong);
  background-image: repeating-linear-gradient(
    to top,
    transparent 0,
    transparent calc(25% - 1px),
    var(--k-line) calc(25% - 1px),
    var(--k-line) 25%
  );
}

.wbc-col { flex: 1 1 0; min-width: 0; height: 100%; display: flex; align-items: flex-end; }

.wbc-col-fill {
  display: block;
  width: 100%;
  border-radius: 7px 7px 3px 3px;
  background: linear-gradient(180deg, #a98cff, #6d3df0);
}

.wbc-chart-axis {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  font-size: 11px;
  color: var(--k-ink-3);
}

.wbc-chart-peak { color: var(--k-ink-2); text-align: center; }

.wbc-stamp {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--k-ink-3);
}

.wbc-stamp i { font-style: normal; margin-right: 8px; color: var(--k-line-strong); }

/* ---------- prose helpers ---------- */
.wbc-empty { margin: 0; padding: 16px 2px; color: var(--k-ink-3); font-size: 14px; }
.wbc-note { margin: 0; padding: 12px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.55; background: #f6f2ff; color: var(--k-ink-2); }
.wbc-note-positive { background: #e2f6ec; color: var(--k-pos); }
.wbc-note-warning { background: #fff3dc; color: var(--k-warn); }
.wbc-note-negative { background: #fde8ec; color: var(--k-neg); }

/* ---------- forms ---------- */
.wbc-field { display: grid; gap: 7px; min-width: 0; }
.wbc-field-label { font-size: 12.5px; font-weight: 750; color: #3a3850; }
.wbc-field-hint { font-size: 12px; line-height: 1.45; color: var(--k-ink-3); }
.wbc-field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 15px; }

.wbc-root input[type="text"],
.wbc-root input[type="email"],
.wbc-root input[type="tel"],
.wbc-root input[type="url"],
.wbc-root input[type="number"],
.wbc-root input[type="date"],
.wbc-root input[type="search"],
.wbc-root input[type="password"],
.wbc-root input:not([type]),
.wbc-root select,
.wbc-root textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background-color: var(--k-fill);
  border: 1.5px solid #e4e1f0;
  border-radius: 14px;
  padding: 12px 14px;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.35;
  color: var(--k-ink);
  appearance: none;
  -webkit-appearance: none;
}

.wbc-root select {
  background-image: ${SELECT_CHEVRON};
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 38px;
}

.wbc-root input:focus,
.wbc-root select:focus,
.wbc-root textarea:focus {
  outline: none;
  background-color: #ffffff;
  border-color: var(--k-accent);
  box-shadow: 0 0 0 3px var(--k-accent-soft);
}

.wbc-root input:disabled,
.wbc-root select:disabled,
.wbc-root textarea:disabled { opacity: 0.45; }

.wbc-root textarea { min-height: 150px; resize: vertical; line-height: 1.6; }

.wbc-root input[type="file"] {
  width: 100%;
  background: var(--k-fill);
  border: 1.5px dashed var(--k-line-strong);
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 13.5px;
  color: var(--k-ink-2);
}

.wbc-check { display: inline-flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 650; }
.wbc-check input { width: 18px; height: 18px; accent-color: var(--k-accent); }

.wbc-search { position: relative; display: flex; align-items: center; }
.wbc-search svg { position: absolute; left: 15px; color: var(--k-ink-3); pointer-events: none; }
.wbc-root .wbc-search input { padding-left: 42px; border-radius: 999px; background-color: #ffffff; }

/* ---------- buttons ---------- */
.wbc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 46px;
  padding: 11px 22px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 750;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
}

.wbc-btn-primary { background: linear-gradient(120deg, #6d3df0, #9b5cff); color: #ffffff; box-shadow: 0 10px 24px rgba(109, 61, 240, 0.28); }
.wbc-btn-ghost { background: #ffffff; color: var(--k-ink); border-color: rgba(109, 61, 240, 0.2); }
.wbc-btn-danger { background: #fde8ec; color: var(--k-neg); border-color: rgba(194, 51, 77, 0.2); }
.wbc-btn:disabled { opacity: 0.42; cursor: default; }
.wbc-btn-sm { min-height: 38px; padding: 8px 16px; font-size: 13px; }
.wbc-btn-block { width: 100%; }
.wbc-btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

.wbc-chips { display: flex; gap: 6px; flex-wrap: wrap; }

.wbc-chip {
  display: inline-flex;
  align-items: center;
  border: 0;
  border-radius: 999px;
  padding: 8px 15px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 0 0 1px var(--k-line-strong);
  font-size: 13px;
  font-weight: 700;
  color: var(--k-ink-2);
  text-decoration: none;
  white-space: nowrap;
}

.wbc-chip[data-on="1"] { background: var(--k-ink); box-shadow: none; color: #ffffff; }

/* ---------- account dialog ---------- */
.wbc-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(21, 19, 43, 0.4);
}

.wbc-dialog {
  width: 100%;
  max-width: 400px;
  max-height: 84vh;
  overflow-y: auto;
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 26px;
  background: #ffffff;
  color: var(--k-ink);
  font-size: 15px;
  box-shadow: 0 30px 70px rgba(40, 20, 90, 0.3);
}

.wbc-dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.wbc-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: #f1ebff;
  color: var(--k-ink-2);
  cursor: pointer;
}

.wbc-account-id { display: grid; gap: 3px; padding-bottom: 14px; border-bottom: 1px solid var(--k-line); }
.wbc-account-id strong { font-size: 17px; font-weight: 800; }
.wbc-account-id span { font-size: 13px; color: var(--k-ink-2); }
          `,
        }}
      />
    </div>
  );
}
