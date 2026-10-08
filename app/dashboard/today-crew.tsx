"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { Department } from "@prisma/client";
import type { DepartmentInfo } from "@/lib/departments";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { addTodayShiftAction, changeTodayShiftAction, removeFromTodayShiftAction } from "./actions";
import { ModalShell } from "./modal-shell";
import { SwipeRevealAction } from "./swipe-reveal-action";
import { useOverlayLock } from "./use-overlay-lock";

/**
 * Today, from the Oggi page. Someone rings: "I'll be half an hour late",
 * "I can't come". A row of "In servizio oggi" slides right to change that
 * person's hours, left to take them off today's shift; "Turno al volo" puts
 * someone else on straight away. The person hears about it at once.
 */

function moveTime(time: string, minutes: number) {
  const total = (Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function nowRounded() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Rome" })
    .format(now)
    .split(":");
  const minutes = Number(parts[0]) * 60 + Number(parts[1]);
  const rounded = Math.ceil(minutes / 15) * 15;
  return moveTime("00:00", rounded);
}

function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function run(action: (formData: FormData) => Promise<unknown>, fields: Record<string, string>, done: () => void) {
    setError(null);
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    start(async () => {
      try {
        const result = await action(formData);
        if (isActionFailure(result)) {
          setError(result.ruleError);
          return;
        }
        done();
        router.refresh();
      } catch (caught) {
        setError(describeActionError(caught));
      }
    });
  }
  return { error, setError, pending, run };
}

function Head({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="wbtc-head">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <button type="button" className="wbtc-x" aria-label="Chiudi" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

function TimeFields({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="wbtc-times">
      <label>
        <small>Inizio</small>
        <input type="time" value={from} onChange={(event) => onFrom(event.target.value)} step={300} />
      </label>
      <span aria-hidden="true">→</span>
      <label>
        <small>Fine</small>
        <input type="time" value={to} onChange={(event) => onTo(event.target.value)} step={300} />
      </label>
    </div>
  );
}

/** One row of "In servizio oggi", with the two gestures. */
export function CrewSwipe({
  shiftId,
  userId,
  name,
  from,
  to,
  children,
}: {
  shiftId: string;
  userId: string;
  name: string;
  from: string;
  to: string;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"time" | "remove" | null>(null);
  const [newFrom, setNewFrom] = useState(from);
  const [newTo, setNewTo] = useState(to);
  const { error, setError, pending, run } = useAction();
  useOverlayLock(mode !== null);
  const firstName = name.split(" ")[0];

  const close = () => {
    setMode(null);
    setError(null);
  };
  const open = (next: "time" | "remove") => {
    setNewFrom(from);
    setNewTo(to);
    setError(null);
    setMode(next);
  };

  return (
    <>
      <SwipeRevealAction
        resetKey={`${shiftId}-${from}-${to}`}
        revealWidth={74}
        actionInset={8}
        borderRadius={16}
        leadingAction={
          <button type="button" className="wbtc-swipe wbtc-swipe--time" aria-label={`Cambia orario di ${firstName}`} onClick={() => open("time")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.9" />
              <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            <span>Orario</span>
          </button>
        }
        action={
          <button type="button" className="wbtc-swipe wbtc-swipe--remove" aria-label={`Togli ${firstName} dal turno di oggi`} onClick={() => open("remove")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Togli</span>
          </button>
        }
      >
        {children}
      </SwipeRevealAction>

      <ModalShell
        open={mode === "time"}
        onClose={close}
        title="Cambia orario"
        width="min(94vw, 420px)"
        panelClassName="wbtc-panel"
        header={<Head title={`Orario di ${firstName}`} subtitle={`Oggi era ${from}–${to}`} onClose={close} />}
      >
        <div className="wbtc-chips">
          <button type="button" onClick={() => setNewFrom(moveTime(from, 15))}>Arriva 15 min dopo</button>
          <button type="button" onClick={() => setNewFrom(moveTime(from, 30))}>30 min dopo</button>
          <button type="button" onClick={() => setNewFrom(moveTime(from, 60))}>1 ora dopo</button>
          <button type="button" onClick={() => setNewTo(moveTime(to, -60))}>Esce 1 ora prima</button>
        </div>
        <TimeFields from={newFrom} to={newTo} onFrom={setNewFrom} onTo={setNewTo} />
        {error ? <div className="wbtc-error">{error}</div> : null}
        <button
          type="button"
          className="wbtc-go"
          disabled={pending || (newFrom === from && newTo === to)}
          onClick={() => run(changeTodayShiftAction, { shiftId, userId, from: newFrom, to: newTo }, close)}
        >
          {pending ? "Salvo…" : `Salva ${newFrom}–${newTo}`}
        </button>
        <span className="wbtc-sub">{firstName} riceve subito una notifica con il nuovo orario.</span>
      </ModalShell>

      <ModalShell
        open={mode === "remove"}
        onClose={close}
        title="Togli dal turno"
        width="min(94vw, 420px)"
        panelClassName="wbtc-panel"
        header={<Head title={`${firstName} non viene?`} subtitle={`Turno di oggi ${from}–${to}`} onClose={close} />}
      >
        <p className="wbtc-text">
          Lo togli dal turno di oggi e riceve una notifica. Se il turno era condiviso, gli altri restano com&apos;erano.
        </p>
        {error ? <div className="wbtc-error">{error}</div> : null}
        <button
          type="button"
          className="wbtc-go wbtc-go--red"
          disabled={pending}
          onClick={() => run(removeFromTodayShiftAction, { shiftId, userId }, close)}
        >
          {pending ? "Tolgo…" : "Togli dal turno"}
        </button>
        <button type="button" className="wbtc-ghost" onClick={close}>
          Annulla
        </button>
      </ModalShell>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
    </>
  );
}

/** "Turno al volo": someone on today's roster, now, published at once. */
export function TodayShiftAdd({
  members,
  departments,
}: {
  members: Array<{ id: string; name: string; department: Department | null }>;
  departments: DepartmentInfo[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("23:00");
  const [department, setDepartment] = useState<Department | null>(null);
  const { error, setError, pending, run } = useAction();
  useOverlayLock(open);

  const close = () => {
    setOpen(false);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        className="wbtc-add"
        onClick={() => {
          const start = nowRounded();
          setFrom(start);
          setTo(moveTime(start, 4 * 60));
          setUserId(null);
          setDepartment(null);
          setError(null);
          setOpen(true);
        }}
      >
        + Turno
      </button>

      <ModalShell
        open={open}
        onClose={close}
        title="Turno al volo"
        width="min(94vw, 440px)"
        panelClassName="wbtc-panel"
        header={<Head title="Turno al volo" subtitle="Oggi, pubblicato subito" onClose={close} />}
      >
        <span className="wbtc-label">Chi</span>
        <div className="wbtc-people">
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              aria-pressed={userId === member.id}
              onClick={() => {
                setUserId(member.id);
                if (departments && member.department) setDepartment(member.department);
              }}
            >
              {member.name}
            </button>
          ))}
        </div>
        <span className="wbtc-label">Orario</span>
        <TimeFields from={from} to={to} onFrom={setFrom} onTo={setTo} />
        {departments && departments.length ? (
          <>
            <span className="wbtc-label">Reparto</span>
            <div className="wbtc-people">
              {departments.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={department === entry.id}
                  onClick={() => setDepartment(department === entry.id ? null : entry.id)}
                  style={department === entry.id ? { background: entry.ink, borderColor: entry.ink, color: "#fff" } : undefined}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {error ? <div className="wbtc-error">{error}</div> : null}
        <button
          type="button"
          className="wbtc-go"
          disabled={pending || !userId}
          onClick={() =>
            userId && run(addTodayShiftAction, { userId, from, to, department: department ?? "" }, close)
          }
        >
          {pending ? "Salvo…" : userId ? `Metti in turno ${from}–${to}` : "Scegli chi"}
        </button>
        <span className="wbtc-sub">La persona riceve subito una notifica.</span>
      </ModalShell>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
    </>
  );
}

const styles = `
.wbtc-swipe { width: 62px; height: 52px; border-radius: 14px; border: 0; color: #fff; display: grid; place-items: center;
  align-content: center; gap: 2px; font-size: 10.5px; font-weight: 850; cursor: pointer; font-family: inherit; }
.wbtc-swipe--time { background: #7c3aed; }
.wbtc-swipe--remove { background: #ef4444; }
.wbtc-panel { gap: 14px !important; padding: 22px 20px 20px !important; border-radius: 30px !important; }
.wbtc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.wbtc-head h3 { margin: 0; font-size: 21px; font-weight: 900; color: #17161f; }
.wbtc-head p { margin: 3px 0 0; font-size: 14px; font-weight: 700; color: #a39fb8; }
.wbtc-x { width: 40px; height: 40px; border-radius: 50%; border: 0; background: #f1ecff; color: #4c1d95; font-size: 22px; cursor: pointer; flex: none; line-height: 1; }
.wbtc-chips, .wbtc-people { display: flex; flex-wrap: wrap; gap: 7px; }
.wbtc-chips button, .wbtc-people button { padding: 8px 12px; border-radius: 999px; border: 1.5px solid #ddd6fe; background: #fff; color: #4c1d95;
  font-size: 13px; font-weight: 800; cursor: pointer; font-family: inherit; }
.wbtc-people button[aria-pressed="true"] { background: #6d3df0; border-color: #6d3df0; color: #fff; }
.wbtc-times { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
.wbtc-times > span { color: #a39fb8; font-weight: 800; }
.wbtc-times label { display: grid; gap: 4px; padding: 10px 12px; border-radius: 18px; border: 1.5px solid #8b5cf6; background: #f6f3ff; }
.wbtc-times small { font-size: 10px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: #7c6bd6; }
.wbtc-times input { border: 0 !important; background: transparent !important; box-shadow: none !important; font-size: 24px; font-weight: 900; color: #17161f; font-family: inherit; width: 100%; padding: 0; }
.wbtc-label { font-size: 12px; font-weight: 850; color: #334155; margin-bottom: -6px; }
.wbtc-text { margin: 0; font-size: 14.5px; line-height: 1.45; color: #4c4670; }
.wbtc-go { height: 52px; border: 0; border-radius: 18px; background: linear-gradient(160deg,#9b5cff,#6d3df0); color: #fff; font-size: 15.5px;
  font-weight: 850; cursor: pointer; font-family: inherit; }
.wbtc-go--red { background: linear-gradient(160deg,#f87171,#dc2626); }
.wbtc-go:disabled { opacity: .5; cursor: default; }
.wbtc-ghost { height: 44px; border: 1px solid #e9e6f5; border-radius: 16px; background: #fff; color: #4c1d95; font-weight: 800; font-size: 14.5px; cursor: pointer; font-family: inherit; }
.wbtc-sub { text-align: center; font-size: 12px; font-weight: 650; color: #8b88a3; }
.wbtc-error { padding: 10px 12px; border-radius: 14px; background: #fff1f2; border: 1px solid #fecdd3; color: #b3202f; font-weight: 800; font-size: 13.5px; }
.wbtc-add { height: 34px; padding: 0 12px; border-radius: 999px; border: 0; background: #f1ecff; color: #4c1d95; font-size: 13px; font-weight: 850;
  cursor: pointer; font-family: inherit; white-space: nowrap; }
`;
