"use client";

import { useMemo, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ShiftPreset } from "@/lib/shift-presets";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { toDateInputValueInTimeZone, toTimeInputValueInTimeZone } from "@/lib/time-zone";
import {
  copyPreviousWeekShiftsAction,
  createShiftAction,
  moveShiftMemberAction,
  reviewRequestAction,
} from "../actions";
import { ShiftEditorModal } from "../shifts/shift-editor-modal";
import { PublishWeekPanel } from "./publish-week-panel";

/**
 * The week on a computer: people down the side, days across the top, every
 * shift where it belongs. The phone keeps its own calendar - this one is only
 * shown from 1100px up (see the style block at the bottom).
 *
 * It writes nothing of its own. Opening a shift uses the same editor as the
 * phone; a new shift goes through createShiftAction; a drag goes through
 * moveShiftMemberAction, with the same rules as an edit. A shift that has not
 * been published yet is drawn dashed, and "Pubblica settimana" is the same
 * button the phone has.
 */

type Member = { id: string; firstName: string; lastName: string; role: string };

type PlannerShift = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
  confirmedAt: string | null;
  isOnCall: boolean;
  assignments: Array<{ id: string; firstName: string; lastName: string; role: string; isCurrentUser: boolean }>;
};

type PlannerDay = {
  date: string;
  isToday: boolean;
  shifts: PlannerShift[];
  availabilities: Array<{ id: string; userId: string; startsAt: string; endsAt: string }>;
  requests: Array<{ id: string; type: string; userId: string; startsAt: string; endsAt: string }>;
  closures: Array<{ id: string; title: string }>;
  pendingRequests?: Array<{
    id: string;
    type: string;
    firstName: string;
    lastName: string;
    startsAt: string;
    endsAt: string;
    reason?: string | null;
  }>;
};

const ABSENCE_LABEL: Record<string, string> = {
  VACATION: "Ferie",
  PERMISSION: "Permesso",
  SICKNESS: "Malattia",
};

const REQUEST_LABEL: Record<string, string> = {
  VACATION: "Ferie",
  PERMISSION: "Permesso",
  OVERTIME: "Straordinario",
  SHIFT_CHANGE: "Cambio turno",
  SICKNESS: "Malattia",
};

function dayKeyOf(iso: string) {
  return iso.slice(0, 10);
}

function addDays(dayKey: string, days: number) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function mondayOf(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(dayKey, -((weekday + 6) % 7));
}

function hm(iso: string) {
  return toTimeInputValueInTimeZone(iso);
}

function overlapsDay(startsAt: string, endsAt: string, dayKey: string) {
  const start = toDateInputValueInTimeZone(startsAt);
  const end = toDateInputValueInTimeZone(endsAt);
  return start <= dayKey && dayKey <= end;
}

function hoursOf(shift: PlannerShift) {
  return (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;
}

function formatHours(value: number) {
  const whole = Math.floor(value);
  const minutes = Math.round((value - whole) * 60);
  return minutes ? `${whole} h ${String(minutes).padStart(2, "0")}` : `${whole} h`;
}

export function DesktopWeekPlanner({
  days,
  members,
  presets,
  locale,
  currentUserId,
  initialDayKey,
}: {
  days: PlannerDay[];
  members: Member[];
  presets: ShiftPreset[];
  locale: string;
  currentUserId: string;
  initialDayKey: string;
}) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => mondayOf(initialDayKey));
  const [editing, setEditing] = useState<PlannerShift | null>(null);
  const [creating, setCreating] = useState<{ dayKey: string; member: Member } | null>(null);
  const [dragging, setDragging] = useState<{ shiftId: string; memberId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const todayKey = toDateInputValueInTimeZone(new Date());
  const byKey = useMemo(() => new Map(days.map((day) => [dayKeyOf(day.date), day])), [days]);
  const firstLoaded = days.length ? dayKeyOf(days[0].date) : todayKey;
  const lastLoaded = days.length ? dayKeyOf(days[days.length - 1].date) : todayKey;
  const weekKeys = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekDays = weekKeys.map((key) => byKey.get(key) ?? null);

  // People who work shifts first, the owner last; the order of the team page.
  const rows = useMemo(
    () => [...members].sort((a, b) => Number(a.role === "OWNER") - Number(b.role === "OWNER")),
    [members]
  );

  const weekShifts = weekDays.flatMap((day, index) =>
    (day?.shifts ?? []).filter((shift) => toDateInputValueInTimeZone(shift.startTime) === weekKeys[index])
  );
  const draftCount = weekShifts.filter((shift) => !shift.confirmedAt && !shift.isOnCall).length;

  const pending = useMemo(() => {
    const seen = new Map<string, NonNullable<PlannerDay["pendingRequests"]>[number]>();
    for (const day of days) {
      for (const request of day.pendingRequests ?? []) {
        seen.set(request.id, request);
      }
    }
    return [...seen.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [days]);

  function goToWeek(nextStart: string) {
    // Inside the loaded range the switch is instant; outside it the page
    // loads the weeks around the one asked for.
    if (nextStart >= mondayOf(firstLoaded) && addDays(nextStart, 6) <= lastLoaded) {
      setWeekStart(nextStart);
      return;
    }
    router.push(`/dashboard/calendar?anchor=${nextStart}`);
  }

  function report(result: unknown, success: string) {
    if (isActionFailure(result)) {
      setFeedback({ tone: "bad", text: describeActionError(result) });
      return false;
    }
    setFeedback({ tone: "ok", text: success });
    router.refresh();
    return true;
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, dayKey: string, member: Member) {
    event.preventDefault();
    setDropTarget(null);
    const moving = dragging;
    setDragging(null);
    if (!moving) {
      return;
    }
    const form = new FormData();
    form.set("shiftId", moving.shiftId);
    form.set("fromMemberId", moving.memberId);
    form.set("toMemberId", member.id);
    form.set("toDay", dayKey);
    startTransition(async () => {
      try {
        report(await moveShiftMemberAction(form), "Turno spostato. Ricorda di pubblicare la settimana.");
      } catch (error) {
        setFeedback({ tone: "bad", text: describeActionError(error) });
      }
    });
  }

  function copyPreviousWeek() {
    const form = new FormData();
    form.set("weekStart", weekStart);
    startTransition(async () => {
      try {
        const result = await copyPreviousWeekShiftsAction(form);
        if (isActionFailure(result)) {
          report(result, "");
          return;
        }
        const created = (result as { created?: number })?.created ?? 0;
        report(
          result,
          created > 0
            ? `${created} turni copiati come bozza. Controllali e pubblica la settimana.`
            : "Niente da copiare: la settimana prima è vuota o i turni ci sono già."
        );
      } catch (error) {
        setFeedback({ tone: "bad", text: describeActionError(error) });
      }
    });
  }

  const rangeLabel = (() => {
    const first = new Date(`${weekKeys[0]}T12:00:00Z`);
    const last = new Date(`${weekKeys[6]}T12:00:00Z`);
    const day = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" });
    const full = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" });
    return first.getUTCMonth() === last.getUTCMonth()
      ? `${day.format(first)} – ${full.format(last)}`
      : `${full.format(first)} – ${full.format(last)}`;
  })();

  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });

  return (
    <div className="wbp">
      <div className="wbp-bar">
        <div className="wbp-weeknav">
          <button type="button" aria-label="Settimana prima" onClick={() => goToWeek(addDays(weekStart, -7))}>
            ‹
          </button>
          <strong>{rangeLabel}</strong>
          <button type="button" aria-label="Settimana dopo" onClick={() => goToWeek(addDays(weekStart, 7))}>
            ›
          </button>
          {weekStart !== mondayOf(todayKey) ? (
            <button type="button" className="wbp-today" onClick={() => goToWeek(mondayOf(todayKey))}>
              Oggi
            </button>
          ) : null}
        </div>
        <div className="wbp-actions">
          <button type="button" className="wbp-btn" disabled={isPending} onClick={copyPreviousWeek}>
            Copia settimana prima
          </button>
          <PublishWeekPanel
            rangeStart={weekKeys[0]}
            rangeEnd={weekKeys[6]}
            pendingCount={draftCount}
            variant="wide"
          />
        </div>
      </div>

      {feedback ? (
        <p className={`wbp-feedback wbp-feedback--${feedback.tone}`} role="status">
          {feedback.text}
          <button type="button" aria-label="Chiudi" onClick={() => setFeedback(null)}>
            ×
          </button>
        </p>
      ) : null}

      <div className="wbp-layout">
        <div className={`wbp-grid${isPending ? " wbp-grid--busy" : ""}`} role="grid" aria-label="Turni della settimana">
          <div className="wbp-h wbp-h--team">Team</div>
          {weekKeys.map((key, index) => {
            const day = weekDays[index];
            const closed = (day?.closures.length ?? 0) > 0;
            return (
              <div
                key={key}
                className={`wbp-h${key === todayKey ? " wbp-h--today" : ""}${closed ? " wbp-h--closed" : ""}`}
              >
                <span>{weekdayFormat.format(new Date(`${key}T12:00:00Z`))}</span>
                <b>{Number(key.slice(8, 10))}</b>
                {closed ? <small>{day?.closures[0]?.title || "Chiuso"}</small> : null}
              </div>
            );
          })}

          {rows.map((member) => {
            const hours = weekShifts
              .filter((shift) => !shift.isOnCall && shift.assignments.some((a) => a.id === member.id))
              .reduce((sum, shift) => sum + hoursOf(shift), 0);

            return [
              <div key={`${member.id}-name`} className="wbp-person">
                <span className="wbp-avatar" aria-hidden="true">
                  {`${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase()}
                </span>
                <span className="wbp-person-text">
                  <b>
                    {member.firstName} {member.lastName[0] ? `${member.lastName[0]}.` : ""}
                  </b>
                  <small>{hours ? formatHours(hours) : "nessun turno"}</small>
                </span>
              </div>,
              ...weekKeys.map((key, index) => {
                const day = weekDays[index];
                const closed = (day?.closures.length ?? 0) > 0;
                const past = key < todayKey;
                const cellId = `${member.id}|${key}`;
                // A shift belongs to the day it starts on. The day lists also
                // carry last night's dinner that ends after midnight, which
                // would draw it twice.
                const shifts = (day?.shifts ?? []).filter(
                  (shift) =>
                    toDateInputValueInTimeZone(shift.startTime) === key &&
                    shift.assignments.some((a) => a.id === member.id)
                );
                const absences = (day?.requests ?? []).filter(
                  (request) =>
                    request.userId === member.id &&
                    ABSENCE_LABEL[request.type] &&
                    overlapsDay(request.startsAt, request.endsAt, key)
                );
                const unavailable = (day?.availabilities ?? []).some((item) => item.userId === member.id);

                return (
                  <div
                    key={cellId}
                    role="gridcell"
                    className={`wbp-cell${closed ? " wbp-cell--closed" : ""}${past ? " wbp-cell--past" : ""}${
                      dropTarget === cellId ? " wbp-cell--drop" : ""
                    }${key === todayKey ? " wbp-cell--today" : ""}`}
                    onDragOver={(event) => {
                      if (dragging && !past) {
                        event.preventDefault();
                        setDropTarget(cellId);
                      }
                    }}
                    onDragLeave={() => setDropTarget((current) => (current === cellId ? null : current))}
                    onDrop={(event) => handleDrop(event, key, member)}
                  >
                    {absences.map((absence) => (
                      <span key={absence.id} className="wbp-absence">
                        {ABSENCE_LABEL[absence.type]}
                      </span>
                    ))}
                    {unavailable ? <span className="wbp-unavailable">Non disponibile</span> : null}
                    {shifts.map((shift) => {
                      const movable = !past;
                      const draft = !shift.confirmedAt && !shift.isOnCall;
                      return (
                        <button
                          key={shift.id}
                          type="button"
                          draggable={movable}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            setDragging({ shiftId: shift.id, memberId: member.id });
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropTarget(null);
                          }}
                          onClick={() => setEditing(shift)}
                          className={`wbp-shift${shift.isOnCall ? " wbp-shift--call" : ""}${
                            draft ? " wbp-shift--draft" : ""
                          }${Number(hm(shift.startTime).slice(0, 2)) < 16 ? " wbp-shift--day" : " wbp-shift--evening"}`}
                          title={draft ? "Bozza: non ancora pubblicato" : undefined}
                        >
                          <b>
                            {shift.isOnCall ? (
                              "Reperibile"
                            ) : (
                              <>
                                {hm(shift.startTime)}
                                <span className="wbp-end">–{hm(shift.endTime)}</span>
                              </>
                            )}
                          </b>
                          <small>
                            {shift.isOnCall
                              ? `${hm(shift.startTime)}–${hm(shift.endTime)}`
                              : shift.title || (draft ? "bozza" : "")}
                            {draft && shift.title ? " · bozza" : ""}
                          </small>
                        </button>
                      );
                    })}
                    {!past && !closed && member.role !== "OWNER" ? (
                      <button
                        type="button"
                        className="wbp-add"
                        aria-label={`Nuovo turno per ${member.firstName}`}
                        onClick={() => setCreating({ dayKey: key, member })}
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                );
              }),
            ];
          })}

          <div className="wbp-cover-label">Copertura</div>
          {weekKeys.map((key, index) => {
            const day = weekDays[index];
            const working = (day?.shifts ?? []).filter(
              (shift) => !shift.isOnCall && toDateInputValueInTimeZone(shift.startTime) === key
            );
            const lunch = new Set(
              working.filter((s) => Number(hm(s.startTime).slice(0, 2)) < 16).flatMap((s) => s.assignments.map((a) => a.id))
            ).size;
            const evening = new Set(
              working.filter((s) => Number(hm(s.startTime).slice(0, 2)) >= 16).flatMap((s) => s.assignments.map((a) => a.id))
            ).size;
            return (
              <div key={`cover-${key}`} className="wbp-cover">
                {(day?.closures.length ?? 0) > 0 ? (
                  "chiuso"
                ) : (
                  <>
                    <span>{lunch} giorno</span>
                    <span>{evening} sera</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <aside className="wbp-side">
          <section className="wbp-card">
            <h3>
              Da decidere <span>{pending.length}</span>
            </h3>
            {pending.length === 0 ? <p className="wbp-empty">Nessuna richiesta in attesa.</p> : null}
            {pending.slice(0, 8).map((request) => {
              const from = new Date(request.startsAt);
              const to = new Date(request.endsAt);
              const dates = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
              const when =
                toDateInputValueInTimeZone(from) === toDateInputValueInTimeZone(to)
                  ? dates.format(from)
                  : `${dates.format(from)} – ${dates.format(to)}`;
              return (
                <div key={request.id} className="wbp-request">
                  <b>
                    {request.firstName} {request.lastName[0] ? `${request.lastName[0]}.` : ""} ·{" "}
                    {REQUEST_LABEL[request.type] ?? "Richiesta"}
                  </b>
                  <small>
                    {when}
                    {request.reason ? ` · ${request.reason}` : ""}
                  </small>
                  {request.type === "SHIFT_CHANGE" ? (
                    <Link href="/dashboard/requests" className="wbp-link">
                      Apri nelle richieste →
                    </Link>
                  ) : (
                    <span className="wbp-decide">
                      <form action={reviewRequestAction}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="decision" value="APPROVED" />
                        <button type="submit" className="wbp-yes">
                          Approva
                        </button>
                      </form>
                      <form action={reviewRequestAction}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="decision" value="REJECTED" />
                        <button type="submit" className="wbp-no">
                          Rifiuta
                        </button>
                      </form>
                    </span>
                  )}
                </div>
              );
            })}
            {pending.length > 8 ? (
              <Link href="/dashboard/requests" className="wbp-link">
                Tutte le richieste →
              </Link>
            ) : null}
          </section>

          <section className="wbp-card wbp-legend">
            <h3>Come si legge</h3>
            <span><i className="wbp-dot wbp-dot--day" />Turno di giorno</span>
            <span><i className="wbp-dot wbp-dot--evening" />Turno di sera</span>
            <span><i className="wbp-dot wbp-dot--call" />Reperibilità</span>
            <span><i className="wbp-dot wbp-dot--draft" />Bozza da pubblicare</span>
            <span><i className="wbp-dot wbp-dot--absence" />Ferie, permessi, malattia</span>
            <p>Trascina un turno su un altro giorno o su un&apos;altra persona per spostarlo. Clic per modificarlo.</p>
          </section>
        </aside>
      </div>

      <ShiftEditorModal
        open={Boolean(editing)}
        locale={locale}
        canManage
        currentUserId={currentUserId}
        shift={editing}
        members={members}
        presets={presets}
        onClose={() => setEditing(null)}
        onDeleted={() => router.refresh()}
        onUpdated={() => router.refresh()}
      />

      {creating ? (
        <NewShiftDialog
          dayKey={creating.dayKey}
          member={creating.member}
          presets={presets}
          locale={locale}
          onClose={() => setCreating(null)}
          onDone={(text) => {
            setCreating(null);
            setFeedback({ tone: "ok", text });
            router.refresh();
          }}
        />
      ) : null}

      <PlannerStyles />
    </div>
  );
}

function NewShiftDialog({
  dayKey,
  member,
  presets,
  locale,
  onClose,
  onDone,
}: {
  dayKey: string;
  member: Member;
  presets: ShiftPreset[];
  locale: string;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [start, setStart] = useState(presets[0]?.startTime ?? "11:30");
  const [end, setEnd] = useState(presets[0]?.endTime ?? "15:30");
  const [title, setTitle] = useState(presets[0]?.label ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dayKey}T12:00:00Z`));

  function submit() {
    setError(null);
    const endDay = end <= start ? addDays(dayKey, 1) : dayKey;
    const form = new FormData();
    form.set("title", title);
    form.set("startTime", `${dayKey}T${start}`);
    form.set("endTime", `${endDay}T${end}`);
    form.append("employeeIds", member.id);
    startTransition(async () => {
      try {
        const result = await createShiftAction(form);
        if (isActionFailure(result)) {
          setError(describeActionError(result));
          return;
        }
        onDone(`Turno aggiunto a ${member.firstName}. Ricorda di pubblicare la settimana.`);
      } catch (caught) {
        setError(describeActionError(caught));
      }
    });
  }

  return (
    <div className="wbp-overlay" role="dialog" aria-modal="true" aria-label="Nuovo turno" onClick={onClose}>
      <div className="wbp-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="wbp-dialog-head">
          <div>
            <span className="wbp-eyebrow">Nuovo turno</span>
            <h3>
              {member.firstName} {member.lastName}
            </h3>
            <small>{dayLabel}</small>
          </div>
          <button type="button" className="wbp-close" aria-label="Chiudi" onClick={onClose}>
            ×
          </button>
        </div>

        {presets.length ? (
          <div className="wbp-presets">
            {presets.map((preset) => {
              const on = preset.startTime === start && preset.endTime === end;
              return (
                <button
                  key={preset.key}
                  type="button"
                  className={on ? "wbp-preset wbp-preset--on" : "wbp-preset"}
                  onClick={() => {
                    setStart(preset.startTime);
                    setEnd(preset.endTime);
                    setTitle(preset.label);
                  }}
                >
                  <b>{preset.label}</b>
                  <small>
                    {preset.startTime}–{preset.endTime}
                  </small>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="wbp-fields">
          <label>
            <span>Inizio</span>
            <input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            <span>Fine</span>
            <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
          <label className="wbp-field-wide">
            <span>Nome del turno</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Pranzo, Cena…" />
          </label>
        </div>
        {end <= start ? <p className="wbp-hint">Finisce il giorno dopo.</p> : null}
        {error ? <p className="wbp-error">{error}</p> : null}

        <div className="wbp-dialog-actions">
          <button type="button" className="wbp-btn" onClick={onClose}>
            Annulla
          </button>
          <button type="button" className="wbp-btn wbp-btn--primary" disabled={isPending} onClick={submit}>
            {isPending ? "Salvo…" : "Aggiungi turno"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlannerStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
.wbp-desktop-only { display: none; }
@media (min-width: 1100px) {
  .wbp-desktop-only { display: block; }
  .wbp-phone-only { display: none; }
}
.wbp { display: grid; gap: 14px; color: #15132b; }
.wbp-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.wbp-weeknav { display: flex; align-items: center; gap: 8px; }
.wbp-weeknav strong { min-width: 190px; text-align: center; font-size: 17px; font-weight: 850; letter-spacing: -0.02em; }
.wbp-weeknav button { width: 34px; height: 34px; border-radius: 50%; border: 0; background: #ffffff; box-shadow: inset 0 0 0 1px #e0d7f8; color: #4c4670; font-size: 18px; cursor: pointer; }
.wbp-weeknav .wbp-today { width: auto; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 750; color: #6d3df0; }
.wbp-actions { display: flex; align-items: center; gap: 10px; }
.wbp-actions > :last-child button { min-height: 40px !important; height: 40px !important; padding: 0 18px !important; font-size: 14px !important; border-radius: 999px !important; }
.wbp-btn { height: 40px; padding: 0 18px; border-radius: 999px; border: 0; background: #ffffff; box-shadow: inset 0 0 0 1px #e0d7f8; color: #15132b; font: inherit; font-size: 14px; font-weight: 750; cursor: pointer; white-space: nowrap; }
.wbp-btn:disabled { opacity: 0.55; cursor: default; }
.wbp-btn--primary { background: linear-gradient(120deg, #6d3df0, #9b5cff); color: #ffffff; box-shadow: 0 8px 18px rgba(109, 61, 240, 0.28); }
.wbp-feedback { margin: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; border-radius: 14px; font-size: 14px; font-weight: 650; }
.wbp-feedback button { border: 0; background: transparent; font-size: 18px; color: inherit; cursor: pointer; }
.wbp-feedback--ok { background: #e2f6ec; color: #17784b; }
.wbp-feedback--bad { background: #fde8ec; color: #b42a44; }

.wbp-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
@media (min-width: 1680px) { .wbp-layout { grid-template-columns: minmax(0, 1fr) 280px; } }

.wbp-grid { display: grid; grid-template-columns: 150px repeat(7, minmax(0, 1fr)); border: 1px solid #ece6fb; border-radius: 18px; overflow: hidden; background: #ffffff; transition: opacity 0.15s ease; }
.wbp-grid--busy { opacity: 0.6; pointer-events: none; }
.wbp-grid > div { border-left: 1px solid #f0ebfc; border-bottom: 1px solid #f0ebfc; min-width: 0; }
.wbp-h { padding: 9px 6px; background: #faf8ff; text-align: center; display: grid; gap: 1px; }
.wbp-h span { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #8a84a8; }
.wbp-h b { font-size: 17px; font-weight: 850; }
.wbp-h small { font-size: 10.5px; font-weight: 700; color: #8a84a8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbp-h--team { border-left: 0 !important; text-align: left; padding-left: 14px; align-content: center; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #8a84a8; }
.wbp-h--today { background: #f1ebff; }
.wbp-h--today span, .wbp-h--today b { color: #6d3df0; }
.wbp-person { border-left: 0 !important; display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
.wbp-avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto; background: linear-gradient(135deg, #6d3df0, #9b5cff); color: #ffffff; font-size: 12px; font-weight: 800; }
.wbp-person-text { display: grid; gap: 1px; min-width: 0; }
.wbp-person-text b { font-size: 13.5px; font-weight: 750; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wbp-person-text small { font-size: 11.5px; color: #8a84a8; font-weight: 600; }
.wbp-cell { position: relative; padding: 5px; min-height: 72px; display: flex; flex-direction: column; gap: 4px; container-type: inline-size; }
/* In a narrow column the end time goes on its own line instead of being cut. */
@container (max-width: 96px) {
  .wbp-end { display: block; font-weight: 650; color: #6f6890; }
}
.wbp-cell--today { background: #fcfaff; }
.wbp-cell--past { background: #fbfbfd; }
.wbp-cell--past .wbp-shift { opacity: 0.62; }
.wbp-cell--closed { background: repeating-linear-gradient(135deg, #f8f5ff 0 8px, #f1ebff 8px 16px); }
.wbp-cell--drop { box-shadow: inset 0 0 0 2px #8b5cff; background: #f5f0ff; }
.wbp-shift { display: grid; gap: 1px; width: 100%; min-width: 0; padding: 4px 6px; border: 1px solid #e3dbf9; border-left: 4px solid #6d3df0; border-radius: 9px; background: #ffffff; text-align: left; font: inherit; color: #15132b; cursor: grab; }
.wbp-shift:hover { border-color: #c9b8f7; }
.wbp-shift:active { cursor: grabbing; }
.wbp-shift b { font-size: 11.5px; font-weight: 800; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: clip; }
.wbp-shift small { font-size: 11px; font-weight: 600; color: #8a84a8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 13px; }
.wbp-shift--day { border-left-color: #f2a93b; }
.wbp-shift--evening { border-left-color: #6d3df0; }
.wbp-shift--call { border-left-color: #2fb8a6; background: #effaf8; }
.wbp-shift--draft { border-style: dashed; border-left-style: solid; background: #fdfcff; }
.wbp-absence { padding: 5px 7px; border-radius: 9px; background: #fff0f6; color: #b03a6f; font-size: 11.5px; font-weight: 800; }
.wbp-unavailable { padding: 5px 7px; border-radius: 9px; border: 1.5px dashed #e0d7f8; color: #8a84a8; font-size: 11px; font-weight: 700; }
.wbp-add { margin-top: auto; height: 22px; border: 1.5px dashed #e0d7f8; border-radius: 8px; background: transparent; color: #b9aee0; font-size: 15px; font-weight: 800; line-height: 1; cursor: pointer; opacity: 0; transition: opacity 0.12s ease; }
.wbp-cell:hover .wbp-add, .wbp-add:focus-visible { opacity: 1; }
.wbp-add:hover { color: #6d3df0; border-color: #b79cff; }
.wbp-cover-label { border-left: 0 !important; border-bottom: 0 !important; padding: 9px 14px; background: #faf8ff; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #8a84a8; }
.wbp-cover { border-bottom: 0 !important; padding: 8px 6px; background: #faf8ff; display: grid; gap: 1px; text-align: center; font-size: 11.5px; font-weight: 700; color: #4c4670; }

.wbp-side { display: grid; gap: 14px; }
@media (min-width: 1680px) { .wbp-side { position: sticky; top: 0; } }
@media (max-width: 1679px) { .wbp-side { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.wbp-card { display: grid; gap: 10px; align-content: start; padding: 16px; border-radius: 18px; background: #ffffff; border: 1px solid #ece6fb; }
.wbp-card h3 { margin: 0; display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #8a84a8; }
.wbp-card h3 span { min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; background: #6d3df0; color: #ffffff; display: grid; place-items: center; font-size: 11.5px; letter-spacing: 0; }
.wbp-empty { margin: 0; font-size: 13.5px; color: #8a84a8; }
.wbp-request { display: grid; gap: 6px; padding-top: 10px; border-top: 1px solid #f0ebfc; }
.wbp-request b { font-size: 13.5px; }
.wbp-request small { font-size: 12.5px; color: #8a84a8; }
.wbp-decide { display: flex; gap: 6px; }
.wbp-decide form { display: contents; }
.wbp-yes, .wbp-no { height: 30px; padding: 0 13px; border: 0; border-radius: 999px; font: inherit; font-size: 12.5px; font-weight: 750; cursor: pointer; }
.wbp-yes { background: #e2f6ec; color: #17784b; }
.wbp-no { background: #fde8ec; color: #b42a44; }
.wbp-link { font-size: 13px; font-weight: 750; color: #6d3df0; text-decoration: none; }
.wbp-legend span { display: flex; align-items: center; gap: 9px; font-size: 13px; color: #4c4670; }
.wbp-legend p { margin: 4px 0 0; font-size: 12.5px; line-height: 1.5; color: #8a84a8; }
.wbp-dot { width: 12px; height: 12px; border-radius: 4px; flex: 0 0 auto; }
.wbp-dot--day { background: #f2a93b; }
.wbp-dot--evening { background: #6d3df0; }
.wbp-dot--call { background: #2fb8a6; }
.wbp-dot--draft { border: 1.5px dashed #b79cff; }
.wbp-dot--absence { background: #f6c3da; }

.wbp-overlay { position: fixed; inset: 0; z-index: 400; display: grid; place-items: center; padding: 20px; background: rgba(21, 19, 43, 0.38); }
.wbp-dialog { width: min(460px, 100%); display: grid; gap: 16px; padding: 22px; border-radius: 24px; background: #ffffff; box-shadow: 0 30px 70px rgba(40, 20, 90, 0.3); color: #15132b; }
.wbp-dialog-head { display: flex; justify-content: space-between; gap: 12px; }
.wbp-dialog-head h3 { margin: 4px 0 2px; font-size: 21px; font-weight: 850; letter-spacing: -0.02em; }
.wbp-dialog-head small { font-size: 13.5px; color: #8a84a8; }
.wbp-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #6d3df0; }
.wbp-close { width: 34px; height: 34px; border: 0; border-radius: 50%; background: #f1ebff; color: #4c4670; font-size: 18px; cursor: pointer; }
.wbp-presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
.wbp-preset { display: grid; gap: 2px; padding: 10px 12px; border: 1.5px solid #e4e1f0; border-radius: 14px; background: #fbfaff; text-align: left; font: inherit; cursor: pointer; }
.wbp-preset b { font-size: 14px; } .wbp-preset small { font-size: 12px; color: #8a84a8; }
.wbp-preset--on { border-color: #6d3df0; background: #f4efff; }
.wbp-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.wbp-fields label { display: grid; gap: 6px; }
.wbp-fields span { font-size: 12.5px; font-weight: 750; color: #3a3850; }
.wbp-fields input { height: 46px; padding: 0 13px; border: 1.5px solid #e4e1f0; border-radius: 13px; background: #fbfaff; font: inherit; font-size: 15px; color: #15132b; }
.wbp-fields input:focus { outline: none; border-color: #6d3df0; background: #ffffff; box-shadow: 0 0 0 3px #efe8ff; }
.wbp-field-wide { grid-column: 1 / -1; }
.wbp-hint { margin: -6px 0 0; font-size: 12.5px; color: #8a84a8; }
.wbp-error { margin: 0; padding: 10px 12px; border-radius: 12px; background: #fde8ec; color: #b42a44; font-size: 13.5px; }
.wbp-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
        `,
      }}
    />
  );
}
