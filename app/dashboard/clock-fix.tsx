"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ClockFixForReview, ClockFixOffer, PendingClockFixView } from "@/lib/clock-fixes";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { approveClockFixAction, rejectClockFixAction, requestClockFixAction } from "./clock-fix-actions";
import { ModalShell } from "./modal-shell";
import { useOverlayLock } from "./use-overlay-lock";

/**
 * Forgotten entries and exits. The person sees a quiet row with a button; the
 * popup asks when they really came in or left. The owner sees one row with
 * the count, and approves in a popup - at the time asked for, or another.
 */

const ROME = "Europe/Rome";

function hhmm(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ROME }).format(
    new Date(iso)
  );
}

function shiftMinutes(time: string, delta: number) {
  const total = (Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + delta + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** What was typed, as a time; minutes nobody typed are zero. */
function resolveTime(digits: string) {
  if (digits.length < 2) return null;
  const hours = digits.slice(0, 2);
  const minutes = digits.slice(2, 4).padEnd(2, "0");
  if (Number(hours) > 23 || Number(minutes) > 59) return null;
  return `${hours}:${minutes}`;
}

function span(from: string, to: string) {
  const start = Number(from.slice(0, 2)) * 60 + Number(from.slice(3));
  const end = Number(to.slice(0, 2)) * 60 + Number(to.slice(3));
  const minutes = end > start ? end - start : end + 24 * 60 - start;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

type Field = { key: "in" | "out"; label: string; chips: Array<{ label: string; value: string }>; initial: string };

/** One or two times, the app's own keypad, and the shortcuts around the shift. */
function TimePicker({
  fields,
  values,
  onChange,
}: {
  fields: Field[];
  values: Record<string, string>;
  onChange: (key: string, digits: string) => void;
}) {
  const [active, setActive] = useState(fields[0].key);
  const [fresh, setFresh] = useState(true);
  const field = fields.find((entry) => entry.key === active) ?? fields[0];
  const digits = values[field.key] ?? "";

  function press(value: string) {
    const current = fresh ? "" : digits;
    setFresh(false);
    if (current.length >= 4) return;
    const next = current.length === 0 && Number(value) > 2 ? `0${value}` : current + value;
    if (next.length === 3 && Number(value) > 5) return;
    onChange(field.key, next);
    if (next.length === 4 && fields.length > 1 && field.key === fields[0].key) {
      setActive(fields[1].key);
      setFresh(true);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))`, gap: 8 }}>
        {fields.map((entry) => {
          const on = entry.key === field.key;
          const shown = resolveTime(values[entry.key] ?? "") ?? (values[entry.key] ? `${values[entry.key].slice(0, 2)}:__` : "--:--");
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                setActive(entry.key);
                setFresh(true);
              }}
              className="wbfix-big"
              data-on={on}
            >
              <strong>{shown}</strong>
              <small>{entry.label}</small>
            </button>
          );
        })}
      </div>
      <div className="wbfix-chips">
        {field.chips.filter((chip, index, all) => all.findIndex((other) => other.value === chip.value) === index).map((chip) => (
          <button
            key={chip.label}
            type="button"
            data-on={resolveTime(digits) === chip.value}
            onClick={() => {
              onChange(field.key, chip.value.replace(":", ""));
              setFresh(true);
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="wbfix-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0"].map((key, index) =>
          key ? (
            <button key={key} type="button" onClick={() => press(key)}>
              {key}
            </button>
          ) : (
            <span key={`gap-${index}`} />
          )
        )}
        <button
          type="button"
          className="wbfix-del"
          aria-label="Togli una cifra"
          onClick={() => {
            setFresh(false);
            onChange(field.key, digits.slice(0, -1));
          }}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

function Head({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="wbfix-head">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <button type="button" className="wbfix-x" aria-label="Chiudi" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

function Row({
  tone,
  title,
  detail,
  badge,
  action,
  onClick,
}: {
  tone: "orange" | "violet";
  title: string;
  detail: string;
  badge?: number;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="wbfix-row" data-tone={tone}>
      <i />
      <div>
        <b>{title}</b>
        <small>{detail}</small>
      </div>
      {badge ? <span className="wbfix-badge">{badge}</span> : null}
      {action ? (
        <button type="button" onClick={onClick}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** The person's side: a row with "Segnala", or the request waiting. */
export function ClockFixEmployee({
  offer,
  pending,
  reviewerName,
}: {
  offer: ClockFixOffer | null;
  pending: PendingClockFixView | null;
  reviewerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  useOverlayLock(open);

  const missedOut = offer?.kind === "MISSED_OUT";
  const startTime = hhmm(offer?.shiftStart);
  const endTime = hhmm(offer?.shiftEnd);
  const nowTime = hhmm(new Date().toISOString());

  const fields: Field[] = [];
  if (offer) {
    if (!missedOut) {
      const base = startTime || nowTime;
      fields.push({
        key: "in",
        label: "Entrata alle",
        initial: base,
        chips: [
          ...(startTime ? [{ label: `${startTime} inizio turno`, value: startTime }] : []),
          { label: shiftMinutes(base, -15), value: shiftMinutes(base, -15) },
          { label: shiftMinutes(base, 15), value: shiftMinutes(base, 15) },
          { label: shiftMinutes(base, 30), value: shiftMinutes(base, 30) },
        ],
      });
    }
    if (missedOut || offer.needsOut) {
      const base = endTime || nowTime;
      fields.push({
        key: "out",
        label: "Uscita alle",
        initial: base,
        chips: [
          ...(endTime ? [{ label: `${endTime} fine turno`, value: endTime }] : []),
          { label: shiftMinutes(base, 15), value: shiftMinutes(base, 15) },
          { label: shiftMinutes(base, 30), value: shiftMinutes(base, 30) },
          { label: shiftMinutes(base, 60), value: shiftMinutes(base, 60) },
        ],
      });
    }
  }

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.initial.replace(":", "")]))
  );

  if (pending) {
    const what =
      pending.kind === "MISSED_OUT"
        ? `Uscita alle ${hhmm(pending.requestedOutAt)}`
        : `Entrata alle ${hhmm(pending.requestedInAt)}` +
          (pending.requestedOutAt ? ` · uscita ${hhmm(pending.requestedOutAt)}` : "");
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: styles }} />
        <Row tone="violet" title={what} detail={`in attesa di ${reviewerName}`} />
      </>
    );
  }

  if (!offer) return null;

  const close = () => {
    setOpen(false);
    setError(null);
  };
  const resolved = Object.fromEntries(fields.map((field) => [field.key, resolveTime(values[field.key] ?? "")]));
  const ready = fields.every((field) => resolved[field.key]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <Row
        tone="orange"
        title={missedOut ? "Uscita dimenticata?" : "Entrata dimenticata?"}
        detail={
          missedOut
            ? endTime
              ? `il turno è finito alle ${endTime}`
              : `sei dentro dalle ${hhmm(offer.inAt)}`
            : `il turno è iniziato alle ${startTime}`
        }
        action="Segnala"
        onClick={() => setOpen(true)}
      />
      <ModalShell
        open={open}
        onClose={close}
        title={missedOut ? "Uscita dimenticata" : "Entrata dimenticata"}
        width="min(94vw, 440px)"
        panelClassName="wbfix-panel"
        header={
          <Head
            title={missedOut ? "Uscita dimenticata" : "Entrata dimenticata"}
            subtitle={`${offer.dayLabel}${startTime ? ` · turno ${startTime}–${endTime}` : ""}`}
            onClose={close}
          />
        }
      >
        {missedOut && offer.inAt ? (
          <p className="wbfix-note">Hai timbrato l&apos;entrata alle {hhmm(offer.inAt)}.</p>
        ) : null}
        <TimePicker fields={fields} values={values} onChange={(key, digits) => setValues((current) => ({ ...current, [key]: digits }))} />
        {error ? <div className="wbfix-error">{error}</div> : null}
        <button
          type="button"
          className="wbfix-go"
          disabled={!ready || isPending}
          onClick={() => {
            setError(null);
            const formData = new FormData();
            formData.set("kind", offer.kind);
            for (const field of fields) formData.set(field.key, resolved[field.key] ?? "");
            start(async () => {
              try {
                const result = await requestClockFixAction(formData);
                if (isActionFailure(result)) {
                  setError(result.ruleError);
                  return;
                }
                setOpen(false);
                router.refresh();
              } catch (caught) {
                setError(describeActionError(caught));
              }
            });
          }}
        >
          {isPending ? "Invio…" : `Manda a ${reviewerName}`}
        </button>
        <span className="wbfix-sub">Conta solo quando {reviewerName} lo approva.</span>
      </ModalShell>
    </>
  );
}

function ReviewItem({ item, onDone }: { item: ClockFixForReview; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const missedOut = item.kind === "MISSED_OUT";
  const askedIn = hhmm(item.requestedInAt);
  const askedOut = hhmm(item.requestedOutAt);
  const startTime = hhmm(item.shiftStart);
  const endTime = hhmm(item.shiftEnd);

  const fields: Field[] = [];
  if (!missedOut) {
    fields.push({
      key: "in",
      label: "Entrata alle",
      initial: askedIn,
      chips: [
        ...(startTime ? [{ label: `${startTime} inizio turno`, value: startTime }] : []),
        { label: `${askedIn} come indicato`, value: askedIn },
      ],
    });
  }
  if (missedOut || item.requestedOutAt) {
    fields.push({
      key: "out",
      label: "Uscita alle",
      initial: askedOut,
      chips: [
        ...(endTime ? [{ label: `${endTime} fine turno`, value: endTime }] : []),
        { label: `${askedOut} come indicato`, value: askedOut },
      ],
    });
  }
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.initial.replace(":", "")]))
  );
  const resolved = Object.fromEntries(fields.map((field) => [field.key, resolveTime(values[field.key] ?? "")]));

  function run(action: typeof approveClockFixAction, withTimes: boolean) {
    setError(null);
    const formData = new FormData();
    formData.set("id", item.id);
    if (withTimes) for (const field of fields) formData.set(field.key, resolved[field.key] ?? "");
    start(async () => {
      try {
        const result = await action(formData);
        if (isActionFailure(result)) {
          setError(result.ruleError);
          return;
        }
        onDone();
      } catch (caught) {
        setError(describeActionError(caught));
      }
    });
  }

  const facts = missedOut
    ? [
        { label: "Entrato", value: hhmm(item.inAt) },
        { label: "Fine turno", value: endTime || "—" },
        { label: "Indica uscita", value: askedOut, hi: true },
      ]
    : [
        { label: "Inizio turno", value: startTime || "—" },
        { label: "Indica entrata", value: askedIn, hi: true },
        ...(item.requestedOutAt ? [{ label: "Indica uscita", value: askedOut, hi: true }] : []),
      ];
  const approveLabel = missedOut
    ? `Approva ${askedOut}`
    : item.requestedOutAt
      ? `Approva ${askedIn}–${askedOut}`
      : `Approva ${askedIn}`;
  const editedIn = resolved.in ?? askedIn;
  const editedOut = resolved.out ?? askedOut;
  const editedLabel = missedOut
    ? `Registra uscita alle ${editedOut}`
    : item.requestedOutAt
      ? `Registra ${editedIn}–${editedOut}`
      : `Registra entrata alle ${editedIn}`;
  const from = missedOut ? hhmm(item.inAt) : editedIn;
  const to = missedOut ? editedOut : item.requestedOutAt ? editedOut : null;

  return (
    <div className="wbfix-req">
      <div className="wbfix-who">
        <span className="wbfix-av">{item.initials}</span>
        <div>
          <b>{item.name}</b>
          <span>
            {missedOut ? "uscita dimenticata" : "entrata dimenticata"} · {item.dayLabel}
            {item.shiftLabel ? ` · ${item.shiftLabel}` : ""}
          </span>
        </div>
      </div>
      <div className="wbfix-line" style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
        {facts.map((fact) => (
          <div key={fact.label}>
            <small>{fact.label}</small>
            <strong data-hi={fact.hi ? "true" : undefined}>{fact.value}</strong>
          </div>
        ))}
      </div>
      {editing ? (
        <>
          <TimePicker fields={fields} values={values} onChange={(key, digits) => setValues((current) => ({ ...current, [key]: digits }))} />
          {from && to ? (
            <div className="wbfix-total">
              <b>
                {from} → {to}
              </b>
              <span>{span(from, to)}</span>
            </div>
          ) : null}
          {error ? <div className="wbfix-error">{error}</div> : null}
          <button
            type="button"
            className="wbfix-go"
            disabled={isPending || fields.some((field) => !resolved[field.key])}
            onClick={() => run(approveClockFixAction, true)}
          >
            {isPending ? "Salvo…" : editedLabel}
          </button>
          <button type="button" className="wbfix-reject" disabled={isPending} onClick={() => run(rejectClockFixAction, false)}>
            Rifiuta
          </button>
        </>
      ) : (
        <>
          {error ? <div className="wbfix-error">{error}</div> : null}
          <div className="wbfix-two">
            <button type="button" className="alt" disabled={isPending} onClick={() => setEditing(true)}>
              Altro orario
            </button>
            <button type="button" className="ok" disabled={isPending} onClick={() => run(approveClockFixAction, false)}>
              {isPending ? "Salvo…" : approveLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The owner's side: one row with the count, and the popup to approve. */
export function ClockFixReview({ items }: { items: ClockFixForReview[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useOverlayLock(open);
  if (items.length === 0) return null;

  const allOut = items.every((item) => item.kind === "MISSED_OUT");
  const allIn = items.every((item) => item.kind === "MISSED_IN");
  const title = allOut ? "Uscite da approvare" : allIn ? "Entrate da approvare" : "Timbrature da approvare";
  const names = Array.from(new Set(items.map((item) => item.name)));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <Row
        tone="orange"
        title={title}
        detail={names.length > 2 ? `${names.slice(0, 2).join(", ")} e altri` : names.join(", ")}
        badge={items.length}
        action="Apri"
        onClick={() => setOpen(true)}
      />
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        width="min(94vw, 460px)"
        panelClassName="wbfix-panel"
        header={
          <Head
            title={title}
            subtitle={`${items.length} ${items.length === 1 ? "richiesta" : "richieste"}`}
            onClose={() => setOpen(false)}
          />
        }
      >
        {items.map((item) => (
          <ReviewItem
            key={item.id}
            item={item}
            onDone={() => {
              if (items.length === 1) setOpen(false);
              router.refresh();
            }}
          />
        ))}
        <span className="wbfix-sub">Con &quot;Altro orario&quot; scegli tu l&apos;ora, oppure rifiuti.</span>
      </ModalShell>
    </>
  );
}

const styles = `
.wbfix-row { display: flex; align-items: center; gap: 12px; padding: 13px 14px 13px 16px; border-radius: 22px; background: #fff;
  border: 1px solid #ebe6f7; box-shadow: 0 6px 16px rgba(61,42,153,.06); }
.wbfix-row > i { width: 9px; height: 9px; border-radius: 50%; background: #e8700c; flex: none; box-shadow: 0 0 0 4px #fff1e3; }
.wbfix-row[data-tone="violet"] > i { background: #8b4dff; box-shadow: 0 0 0 4px #efe8ff; }
.wbfix-row > div { flex: 1; min-width: 0; display: grid; gap: 1px; }
.wbfix-row b { font-size: 15px; font-weight: 850; color: #17161f; }
.wbfix-row small { font-size: 12.5px; font-weight: 650; color: #8b88a3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbfix-row > button { height: 36px; padding: 0 14px; border-radius: 999px; border: 0; background: #f1ecff; color: #4c1d95;
  font-size: 13.5px; font-weight: 850; cursor: pointer; flex: none; }
.wbfix-badge { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px; background: #e8700c; color: #fff;
  font-size: 12.5px; font-weight: 900; display: grid; place-items: center; flex: none; }
.wbfix-panel { gap: 14px !important; padding: 22px 20px 20px !important; border-radius: 30px !important; }
.wbfix-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.wbfix-head h3 { margin: 0; font-size: 22px; font-weight: 900; color: #17161f; letter-spacing: -.01em; }
.wbfix-head p { margin: 3px 0 0; font-size: 14px; font-weight: 700; color: #a39fb8; }
.wbfix-x { width: 40px; height: 40px; border-radius: 50%; border: 0; background: #f1ecff; color: #4c1d95; font-size: 22px;
  font-weight: 700; flex: none; cursor: pointer; line-height: 1; }
.wbfix-note { margin: 0; font-size: 13.5px; font-weight: 700; color: #5b5873; }
.wbfix-big { height: 76px; border-radius: 20px; border: 1.5px solid #e9e6f5; background: #fff; display: grid; place-items: center;
  align-content: center; gap: 1px; cursor: pointer; font: inherit; }
.wbfix-big[data-on="true"] { border-color: #8b5cf6; background: #f6f3ff; }
.wbfix-big strong { font-size: 28px; font-weight: 900; color: #17161f; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.wbfix-big small { font-size: 10px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: #7c6bd6; }
.wbfix-chips { display: flex; gap: 7px; flex-wrap: wrap; }
.wbfix-chips button { padding: 8px 12px; border-radius: 999px; border: 1.5px solid #c4b5fd; color: #4c1d95; font-size: 13px;
  font-weight: 850; background: #fff; cursor: pointer; font-family: inherit; }
.wbfix-chips button[data-on="true"] { background: #ede7ff; }
.wbfix-keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.wbfix-keys button { height: 46px; border-radius: 15px; border: 1px solid #ebe8f3; background: #fff; font-size: 20px; font-weight: 800;
  color: #17161f; cursor: pointer; font-family: inherit; }
.wbfix-keys .wbfix-del { background: #f1ecff !important; color: #4c1d95 !important; border: 0; font-size: 17px; box-shadow: none !important; }
.wbfix-go { height: 52px; border: 0; border-radius: 18px; background: linear-gradient(160deg,#9b5cff,#6d3df0); color: #fff;
  font-size: 15.5px; font-weight: 850; box-shadow: 0 10px 22px rgba(109,61,240,.25); cursor: pointer; font-family: inherit; }
.wbfix-go:disabled { opacity: .5; cursor: default; box-shadow: none; }
.wbfix-reject { height: 46px; border: 1px solid #e9e6f5; border-radius: 16px; background: #fff; color: #b3202f; font-size: 14.5px;
  font-weight: 800; cursor: pointer; font-family: inherit; }
.wbfix-sub { text-align: center; font-size: 12px; font-weight: 650; color: #8b88a3; }
.wbfix-error { padding: 10px 12px; border-radius: 14px; background: #fff1f2; border: 1px solid #fecdd3; color: #b3202f; font-weight: 800; font-size: 13.5px; }
.wbfix-req { padding: 14px; border-radius: 20px; border: 1px solid #ebe6f7; display: grid; gap: 11px; }
.wbfix-who { display: flex; align-items: center; gap: 11px; }
.wbfix-av { width: 40px; height: 40px; border-radius: 50%; background: #f1ecff; display: grid; place-items: center; font-weight: 900;
  color: #4c1d95 !important; font-size: 14px !important; flex: none; }
.wbfix-who b { display: block; font-size: 15.5px; color: #17161f; }
.wbfix-who span { font-size: 12.5px; color: #8b88a3; font-weight: 700; }
.wbfix-line { display: grid; text-align: center; padding: 9px 4px; border-radius: 15px; background: #f8f7fd; }
.wbfix-line div { display: grid; gap: 1px; }
.wbfix-line small { font-size: 9px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: #a39fb8; }
.wbfix-line strong { font-size: 16px; color: #17161f; font-variant-numeric: tabular-nums; }
.wbfix-line strong[data-hi] { color: #6d3df0; }
.wbfix-two { display: grid; grid-template-columns: 1fr 1.5fr; gap: 8px; }
.wbfix-two button { height: 44px; border-radius: 15px; font-size: 14px; font-weight: 850; cursor: pointer; font-family: inherit; }
.wbfix-two .alt { border: 1px solid #e9e6f5; background: #fff; color: #4c1d95; }
.wbfix-two .ok { border: 0; background: linear-gradient(160deg,#9b5cff,#6d3df0); color: #fff; }
.wbfix-total { display: flex; justify-content: space-between; align-items: center; padding: 11px 13px; border-radius: 16px;
  background: #f8f7fd; border: 1px solid #ece8f8; }
.wbfix-total b { font-size: 15px; color: #17161f; font-variant-numeric: tabular-nums; }
.wbfix-total span { font-size: 12px; font-weight: 800; color: #6d3df0; }
`;
