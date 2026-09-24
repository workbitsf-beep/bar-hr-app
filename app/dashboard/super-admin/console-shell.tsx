import type { ReactNode } from "react";
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
            <i />
            Workbit <span>Console</span>
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
  --k-ink: #15161c;
  --k-ink-2: #5b5e70;
  --k-ink-3: #9a9cac;
  --k-line: #e8e8ef;
  --k-line-strong: #d5d5e0;
  --k-accent: #6d28d9;
  --k-accent-soft: #f2ecfd;
  --k-pos: #0e7a5f;
  --k-warn: #a5620d;
  --k-neg: #b3261e;
  --k-fill: #f6f6fa;
  --k-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--k-paper);
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
  background: var(--k-ink);
  padding-top: max(env(safe-area-inset-top, 0px), var(--wb-inset-top, 0px));
}

.wbc-head-in {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
}

.wbc-mark {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--k-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.17em;
  text-transform: uppercase;
  color: #ffffff;
}

.wbc-mark i { width: 6px; height: 6px; border-radius: 50%; background: var(--k-accent); flex: 0 0 auto; }
.wbc-mark span { color: rgba(255, 255, 255, 0.5); }

.wbc-head-tools { display: flex; align-items: center; gap: 9px; flex: 0 1 auto; min-width: 0; }

.wbc-jump {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 152px;
  min-width: 0;
  height: 34px;
  padding: 0 13px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.09);
  color: #ffffff;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 650;
  cursor: pointer;
  touch-action: manipulation;
}

.wbc-jump svg { flex: 0 0 auto; opacity: 0.75; }
.wbc-jump span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbc-jump:disabled { opacity: 0.55; cursor: default; }

.wbc-jump-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid var(--k-line);
  border-radius: 12px;
  background: var(--k-fill);
  color: var(--k-ink);
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.wbc-jump-row span { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.wbc-jump-row i { font-style: normal; color: var(--k-ink-3); font-size: 17px; }
.wbc-jump-row svg { flex: 0 0 auto; color: var(--k-accent); }
.wbc-jump-row:disabled { opacity: 0.55; cursor: default; }

@media (max-width: 400px) {
  .wbc-mark span { display: none; }
  .wbc-jump { max-width: 118px; }
}

.wbc-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.09);
  color: #ffffff;
  font-family: var(--k-mono);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  flex: 0 0 auto;
}

.wbc-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.wbc-page { padding: 22px 16px 34px; max-width: 760px; margin: 0 auto; }

.wbc-rail {
  flex: 0 0 auto;
  display: flex;
  background: var(--k-ink);
  padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--wb-inset-bottom, 0px));
}

.wbc-rail a {
  flex: 1 1 0;
  padding: 12px 4px 14px;
  text-align: center;
  font-family: var(--k-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.46);
  text-decoration: none;
  border-top: 2px solid transparent;
}

.wbc-rail a[data-on="1"] { color: #ffffff; border-top-color: var(--k-accent); }

/* ---------- page furniture ---------- */
.wbc-page-head { display: grid; gap: 8px; margin-bottom: 22px; }
.wbc-title { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.028em; text-wrap: balance; }
.wbc-desc { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--k-ink-2); max-width: 58ch; }

.wbc-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-family: var(--k-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--k-ink-3);
  text-decoration: none;
}

.wbc-label {
  margin: 0;
  font-family: var(--k-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--k-ink-3);
}

/* ---------- figures ---------- */
.wbc-figure-band {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  border-top: 1px solid var(--k-line);
  border-bottom: 1px solid var(--k-line);
}

.wbc-figure { display: grid; gap: 6px; padding: 15px 14px 16px; border-left: 1px solid var(--k-line); min-width: 0; }
.wbc-figure:first-child { border-left: 0; padding-left: 0; }
.wbc-figure-value {
  font-size: clamp(19px, 5.4vw, 28px);
  font-weight: 600;
  letter-spacing: -0.038em;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.wbc-figure-word { font-size: clamp(15px, 4.2vw, 20px); letter-spacing: -0.015em; }
.wbc-figure-meta { font-size: 11.5px; line-height: 1.4; color: var(--k-ink-2); }

/* ---------- sections ---------- */
.wbc-section { margin-top: 28px; }
.wbc-section:first-child { margin-top: 0; }

.wbc-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--k-line);
}

.wbc-section-body { padding-top: 15px; display: grid; gap: 15px; }
.wbc-section-body.wbc-flush { padding-top: 0; gap: 0; }

/* ---------- rows ---------- */
.wbc-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--k-line); }
.wbc-row-link { text-decoration: none; color: inherit; }
.wbc-row-link:active { background: var(--k-fill); }
.wbc-row-main { flex: 1 1 auto; min-width: 0; display: grid; gap: 3px; }
.wbc-row-title { font-size: 15px; font-weight: 600; letter-spacing: -0.012em; overflow-wrap: anywhere; }
.wbc-row-meta { font-size: 12.5px; line-height: 1.4; color: var(--k-ink-2); overflow-wrap: anywhere; }
.wbc-row-side { flex: 0 0 auto; display: grid; gap: 4px; justify-items: end; text-align: right; }
.wbc-row-value { font-family: var(--k-mono); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.wbc-row-value-meta { font-family: var(--k-mono); font-size: 10.5px; color: var(--k-ink-3); font-variant-numeric: tabular-nums; }
.wbc-row-chevron { flex: 0 0 auto; color: var(--k-ink-3); }

/* ---------- status ---------- */
.wbc-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; }
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
.wbc-datalist-row dt { margin: 0; font-size: 13px; color: var(--k-ink-2); flex: 0 0 auto; }
.wbc-datalist-row dd { margin: 0; font-size: 13.5px; font-weight: 600; text-align: right; overflow-wrap: anywhere; }

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
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.wbc-donut-center span {
  font-family: var(--k-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--k-ink-3);
}

.wbc-donut-legend { flex: 1 1 190px; min-width: 0; margin: 0; padding: 0; list-style: none; display: grid; gap: 9px; }

.wbc-donut-legend li {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12.5px;
  color: var(--k-ink-2);
}

.wbc-donut-legend-label { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }

.wbc-donut-legend-value {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  font-family: var(--k-mono);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--k-ink);
}

.wbc-donut-legend-value i { font-style: normal; font-size: 10px; color: var(--k-ink-3); min-width: 30px; text-align: right; }

/* ---------- charts ---------- */
.wbc-chart { display: grid; gap: 9px; }
.wbc-chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }

.wbc-chart-scale {
  font-family: var(--k-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--k-ink-3);
}

.wbc-chart-plot {
  display: flex;
  align-items: flex-end;
  gap: 3px;
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
  border-radius: 2px 2px 0 0;
  background: var(--k-accent);
}

.wbc-chart-axis {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  font-family: var(--k-mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  color: var(--k-ink-3);
}

.wbc-chart-peak { color: var(--k-ink-2); text-align: center; }

.wbc-stamp {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  font-family: var(--k-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--k-ink-3);
}

.wbc-stamp i { font-style: normal; margin-right: 8px; color: var(--k-line-strong); }

/* ---------- prose helpers ---------- */
.wbc-empty { margin: 0; padding: 18px 0; color: var(--k-ink-3); font-size: 13.5px; }
.wbc-note { margin: 0; padding: 12px 14px; border-radius: 10px; font-size: 12.5px; line-height: 1.55; background: var(--k-fill); color: var(--k-ink-2); }
.wbc-note-positive { background: #e9f6f1; color: var(--k-pos); }
.wbc-note-warning { background: #fdf4e8; color: var(--k-warn); }
.wbc-note-negative { background: #fdeeed; color: var(--k-neg); }

/* ---------- forms ---------- */
.wbc-field { display: grid; gap: 8px; min-width: 0; }
.wbc-field-label { font-family: var(--k-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--k-ink-3); }
.wbc-field-hint { font-size: 11.5px; line-height: 1.45; color: var(--k-ink-3); }
.wbc-field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }

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
  background: var(--k-fill);
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 12px 13px;
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
  background-position: right 13px center;
  padding-right: 36px;
}

.wbc-root input:focus,
.wbc-root select:focus,
.wbc-root textarea:focus {
  outline: none;
  background: #ffffff;
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
  border-radius: 10px;
  padding: 11px 13px;
  font-size: 13px;
  color: var(--k-ink-2);
}

.wbc-check { display: inline-flex; align-items: center; gap: 9px; font-size: 13.5px; font-weight: 600; }
.wbc-check input { width: 18px; height: 18px; accent-color: var(--k-accent); }

.wbc-search { position: relative; display: flex; align-items: center; }
.wbc-search svg { position: absolute; left: 13px; color: var(--k-ink-3); pointer-events: none; }
.wbc-search input { padding-left: 38px; }

/* ---------- buttons ---------- */
.wbc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding: 11px 18px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 650;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
}

.wbc-btn-primary { background: var(--k-ink); color: #ffffff; }
.wbc-btn-ghost { background: transparent; color: var(--k-ink); border-color: var(--k-line-strong); }
.wbc-btn-danger { background: transparent; color: var(--k-neg); border-color: rgba(179, 38, 30, 0.32); }
.wbc-btn:disabled { opacity: 0.42; cursor: default; }
.wbc-btn-sm { min-height: 36px; padding: 8px 14px; font-size: 12.5px; border-radius: 9px; }
.wbc-btn-block { width: 100%; }
.wbc-btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

.wbc-chips { display: flex; gap: 8px; flex-wrap: wrap; }

.wbc-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--k-line-strong);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--k-ink-2);
  text-decoration: none;
  white-space: nowrap;
}

.wbc-chip[data-on="1"] { background: var(--k-ink); border-color: var(--k-ink); color: #ffffff; }

/* ---------- account dialog ---------- */
.wbc-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(10, 10, 14, 0.52);
}

.wbc-dialog {
  width: 100%;
  max-width: 380px;
  max-height: 84vh;
  overflow-y: auto;
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  background: #ffffff;
  color: var(--k-ink);
  font-size: 15px;
  box-shadow: 0 24px 60px rgba(10, 10, 20, 0.28);
}

.wbc-dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.wbc-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 9px;
  background: var(--k-fill);
  color: var(--k-ink-2);
  cursor: pointer;
}

.wbc-account-id { display: grid; gap: 3px; padding-bottom: 14px; border-bottom: 1px solid var(--k-line); }
.wbc-account-id strong { font-size: 16px; font-weight: 600; }
.wbc-account-id span { font-size: 12.5px; color: var(--k-ink-2); }
          `,
        }}
      />
    </div>
  );
}
