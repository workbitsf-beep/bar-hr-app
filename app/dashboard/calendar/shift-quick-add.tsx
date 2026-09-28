"use client";

import { useMemo, useState } from "react";
import type { ShiftPreset } from "@/lib/shift-presets";

export type QuickAddMember = {
  id: string;
  name: string;
  roleLabel: string;
};

export type QuickAddDay = {
  key: string;
  weekday: string;
  number: string;
};

export type QuickAddWeek = {
  label: string;
  days: QuickAddDay[];
};

export type QuickAddDraft = {
  date: string;
  startTime: string;
  endTime: string;
  memberIds: string[];
  isOnCall: boolean;
};

/** Which of the two doors is open. */
type Door = "time" | "person";

/** How many times the same two hours have to appear before the app offers to keep them. */
const OFFER_AFTER = 3;

/**
 * Putting shifts in, by the hours or by the person.
 *
 * Few venues work to fixed hours, so writing the two times is the road and the
 * standard slots are the shortcut: the keypad is always there, and one row of
 * chips above it offers the venue's own slots and the times it has used
 * lately. The row goes as soon as the hours are in.
 *
 * The keypad is the app's own rather than the phone's: the digits are twice
 * the size, nothing slides in and out from the bottom, and the two times stay
 * on screen the whole time.
 *
 * The two doors are the old "per giorno" / "per dipendente" switch, moved out
 * of the form and put first, where the choice actually happens.
 */
export function ShiftQuickAdd({
  dayKey,
  dayLabel,
  members,
  presets,
  recent,
  weeks,
  busyAt,
  pending = false,
  onCancel,
  onSave,
  onSavePreset,
}: {
  dayKey: string;
  dayLabel: string;
  members: QuickAddMember[];
  presets: ShiftPreset[];
  /** The times this venue has actually used lately, most used first. */
  recent: { startTime: string; endTime: string; count: number }[];
  /** The week holding the chosen day, and the ones after it. */
  weeks: QuickAddWeek[];
  /** Who cannot take a shift on that day between those hours, and why. */
  busyAt: (dayKey: string, startTime: string, endTime: string) => Map<string, string>;
  pending?: boolean;
  onCancel: () => void;
  onSave: (drafts: QuickAddDraft[]) => void;
  /** Absent when the venue's standard slots cannot be edited from here. */
  onSavePreset?: (slot: { startTime: string; endTime: string }) => void;
}) {
  const [door, setDoor] = useState<Door>("time");
  const [screen, setScreen] = useState(0);
  const [startDigits, setStartDigits] = useState("");
  const [endDigits, setEndDigits] = useState("");
  const [field, setField] = useState<"start" | "end">("start");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [isOnCall, setIsOnCall] = useState(false);
  const [personId, setPersonId] = useState<string | null>(null);
  const [dayKeys, setDayKeys] = useState<string[]>([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [presetOffered, setPresetOffered] = useState<string[]>([]);

  const start = resolveTime(startDigits);
  const end = resolveTime(endDigits);
  const span = start && end ? { startTime: start, endTime: end } : null;
  const complete = span !== null;
  const minutes = span ? spanMinutes(span.startTime, span.endTime) : 0;
  const person = members.find((member) => member.id === personId) ?? null;

  function openDoor(next: Door) {
    setDoor(next);
    setScreen(0);
    setStartDigits("");
    setEndDigits("");
    setField("start");
    setMemberIds([]);
    setIsOnCall(false);
    setPersonId(null);
    setDayKeys([]);
    setWeekIndex(0);
  }

  function editField(edit: (current: string) => string) {
    const setter = field === "start" ? setStartDigits : setEndDigits;
    setter(edit);
  }

  function press(value: string) {
    let filled = false;

    editField((current) => {
      if (current.length >= 4) {
        return current;
      }

      // A first digit that cannot begin an hour is the hour: 9 means 09, not
      // the start of 9x:xx.
      const next = current.length === 0 && Number(value) > 2 ? `0${value}` : current + value;

      // Nor can the tens of a minute go past 5.
      if (next.length === 3 && Number(value) > 5) {
        return current;
      }

      filled = next.length === 4;
      return next;
    });

    // Four digits mean the hour is finished; the minutes are already there.
    if (filled && field === "start") {
      setField("end");
    }
  }

  function backspace() {
    if (field === "end" && endDigits.length === 0) {
      setField("start");
      setStartDigits((current) => current.slice(0, -1));
      return;
    }

    editField((current) => current.slice(0, -1));
  }

  function applyRange(startTime: string, endTime: string) {
    setStartDigits(startTime.replace(":", ""));
    setEndDigits(endTime.replace(":", ""));
    setField("end");
  }

  // Only the slots the venue wrote in its settings. Times guessed from past
  // shifts filled the row with things nobody chose - a stray 14:05–14:30 sits
  // there looking exactly like a real slot.
  const shortcuts = useMemo(
    () =>
      presets.map((preset) => ({
        key: `${preset.startTime}-${preset.endTime}`,
        label: preset.label,
        detail: `${preset.startTime.slice(0, 5)}–${preset.endTime.slice(0, 5)}`,
        startTime: preset.startTime,
        endTime: preset.endTime,
      })),
    [presets]
  );

  // Cheap enough to work out on every render, and it reads in one piece.
  const offer =
    span !== null &&
    Boolean(onSavePreset) &&
    !presetOffered.includes(`${span.startTime}-${span.endTime}`) &&
    !presets.some(
      (preset) => preset.startTime === span.startTime && preset.endTime === span.endTime
    ) &&
    (recent.find(
      (entry) => entry.startTime === span.startTime && entry.endTime === span.endTime
    )?.count ?? 0) >= OFFER_AFTER;

  const doorSwitch = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: "#f1effe",
      }}
    >
      {[
        { value: "time" as Door, label: "Per orario" },
        { value: "person" as Door, label: "Per dipendente" },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => openDoor(option.value)}
          style={{
            minHeight: 38,
            borderRadius: 999,
            border: 0,
            background: door === option.value ? "#ffffff" : "transparent",
            color: door === option.value ? "#4c1d95" : "#7a7790",
            fontSize: 13.5,
            fontWeight: door === option.value ? 840 : 760,
            boxShadow: door === option.value ? "0 2px 8px rgba(76, 29, 149, 0.12)" : "none",
            cursor: "pointer",
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const keypad = (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 24px minmax(0,1fr)",
          alignItems: "center",
          gap: 4,
        }}
      >
        <TimeBox
          digits={startDigits}
          caption="inizio"
          active={field === "start"}
          onFocus={() => setField("start")}
        />
        <span style={{ textAlign: "center", color: "#a3a3b5", fontSize: 16, fontWeight: 800 }}>→</span>
        <TimeBox
          digits={endDigits}
          caption="fine"
          active={field === "end"}
          onFocus={() => setField("end")}
        />
      </div>

      {complete ? (
        offer ? (
          // The third time the same two times get typed, the app asks once
          // whether they should become one of the venue's slots.
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 14,
              background: "#efecff",
              border: "1.5px solid #ddd8f8",
            }}
          >
            <span style={{ minWidth: 0, flex: 1, fontSize: 12.5, fontWeight: 760, color: "#4c1d95" }}>
              Usi spesso {span?.startTime}–{span?.endTime}. Vuoi salvarlo fra le fasce?
            </span>
            <button
              type="button"
              onClick={() => {
                if (span) {
                  onSavePreset?.(span);
                  setPresetOffered((current) => current.concat(`${span.startTime}-${span.endTime}`));
                }
              }}
              style={{
                flex: "0 0 auto",
                padding: "7px 13px",
                borderRadius: 999,
                border: 0,
                background: "#4c1d95",
                color: "#ffffff",
                fontSize: 12.5,
                fontWeight: 820,
                cursor: "pointer",
              }}
            >
              Salva
            </button>
            <button
              type="button"
              aria-label="No grazie"
              onClick={() => setPresetOffered((current) => current.concat(`${start}-${end}`))}
              style={{
                flex: "0 0 auto",
                width: 26,
                height: 26,
                borderRadius: 999,
                border: 0,
                background: "transparent",
                color: "#7c6bd6",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span style={{ textAlign: "center", fontSize: 12.5, fontWeight: 750, color: "#a3a3b5" }}>
            {describeSpan(minutes)}
            {door === "person" && dayKeys.length > 1 ? ` · uguale per i ${dayKeys.length} giorni` : ""}
          </span>
        )
      ) : shortcuts.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              onClick={() => applyRange(shortcut.startTime, shortcut.endTime)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1.5px solid #6d5ce7",
                background: "#efecff",
                color: "#4c1d95",
                fontSize: 12.5,
                fontWeight: 830,
                fontVariantNumeric: "tabular-nums",
                cursor: "pointer",
              }}
            >
              {shortcut.label}
              <span style={{ fontWeight: 780, opacity: 0.75, marginLeft: 5 }}>{shortcut.detail}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 7 }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
          <button key={key} type="button" onClick={() => press(key)} style={keyStyle(false)}>
            {key}
          </button>
        ))}
        {/* No ":00" key: an hour with no minutes typed is already on the
            hour, so the key only ever confirmed what the box was showing. */}
        <span aria-hidden="true" />
        <button type="button" onClick={() => press("0")} style={keyStyle(false)}>
          0
        </button>
        <button type="button" onClick={backspace} style={keyStyle(true)}>
          ⌫
        </button>
      </div>
    </div>
  );

  // ——————————————————————————————— per orario ———————————————————————————————

  if (door === "time") {
    if (screen === 1 && span) {
      const busy = busyAt(dayKey, span.startTime, span.endTime);

      return (
        <div style={{ display: "grid", gap: 13 }}>
          <Head
            title="Chi ci lavora"
            detail={`${dayLabel} · ${span.startTime}–${span.endTime}`}
            onBack={() => setScreen(0)}
            backLabel="‹"
          />

          <PeopleChips
            members={members}
            busy={busy}
            chosen={memberIds}
            onToggle={(id) =>
              setMemberIds((current) =>
                current.includes(id) ? current.filter((entry) => entry !== id) : current.concat(id)
              )
            }
          />

          <OnCallToggle value={isOnCall} onToggle={() => setIsOnCall((current) => !current)} />

          <button
            type="button"
            disabled={pending || memberIds.length === 0}
            onClick={() =>
              onSave([{ date: dayKey, ...span, memberIds, isOnCall }])
            }
            style={ctaStyle(memberIds.length > 0 && !pending)}
          >
            {pending ? "Salvo…" : "Salva turno"}
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <Head title="Orario" detail={dayLabel} onBack={onCancel} backLabel="✕" />
        {doorSwitch}
        {keypad}
        <button
          type="button"
          disabled={!complete || minutes <= 0}
          onClick={() => setScreen(1)}
          style={ctaStyle(complete && minutes > 0)}
        >
          Avanti
        </button>
      </div>
    );
  }

  // ————————————————————————————— per dipendente —————————————————————————————

  if (screen === 1 && person) {
    const week = weeks[weekIndex] ?? weeks[0];
    const away = new Map<string, string>();

    for (const day of week?.days ?? []) {
      const reason = busyAt(day.key, "00:00", "23:59").get(person.id);

      if (reason) {
        away.set(day.key, reason);
      }
    }

    const awayDay = (week?.days ?? []).find((day) => away.has(day.key));

    return (
      <div style={{ display: "grid", gap: 13 }}>
        <Head title="Quali giorni" detail={person.name} onBack={() => setScreen(0)} backLabel="‹" />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button
            type="button"
            disabled={weekIndex === 0}
            onClick={() => setWeekIndex((current) => Math.max(0, current - 1))}
            style={weekArrowStyle(weekIndex > 0)}
          >
            ‹
          </button>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#16161d" }}>{week?.label ?? ""}</span>
          <button
            type="button"
            disabled={weekIndex >= weeks.length - 1}
            onClick={() => setWeekIndex((current) => Math.min(weeks.length - 1, current + 1))}
            style={weekArrowStyle(weekIndex < weeks.length - 1)}
          >
            ›
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 5 }}>
          {(week?.days ?? []).map((day) => {
            const blocked = away.has(day.key);
            const chosen = dayKeys.includes(day.key);

            return (
              <button
                key={day.key}
                type="button"
                disabled={blocked}
                onClick={() =>
                  setDayKeys((current) =>
                    current.includes(day.key)
                      ? current.filter((entry) => entry !== day.key)
                      : current.concat(day.key)
                  )
                }
                style={{
                  display: "grid",
                  gap: 1,
                  justifyItems: "center",
                  padding: "9px 2px",
                  borderRadius: 13,
                  border: chosen ? "1.5px solid #6d5ce7" : "1.5px solid #ebedf3",
                  background: chosen ? "#efecff" : "#ffffff",
                  color: chosen ? "#4c1d95" : "#16161d",
                  opacity: blocked ? 0.38 : 1,
                  cursor: blocked ? "default" : "pointer",
                }}
              >
                <strong style={{ fontSize: 15, fontWeight: 840, fontVariantNumeric: "tabular-nums" }}>
                  {day.number}
                </strong>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: chosen ? "#7c6bd6" : "#a3a3b5" }}>
                  {day.weekday}
                </span>
              </button>
            );
          })}
        </div>

        {awayDay ? (
          <span style={{ fontSize: 12, fontWeight: 740, color: "#a3a3b5" }}>
            {awayDay.weekday} {awayDay.number}: {away.get(awayDay.key)}
          </span>
        ) : null}

        <button
          type="button"
          disabled={dayKeys.length === 0}
          onClick={() => setScreen(2)}
          style={ctaStyle(dayKeys.length > 0)}
        >
          Avanti{dayKeys.length > 0 ? ` · ${dayKeys.length} ${dayKeys.length === 1 ? "giorno" : "giorni"}` : ""}
        </button>
      </div>
    );
  }

  if (screen === 2 && person) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <Head
          title="Orario"
          detail={`${person.name.split(" ")[0]} · ${dayKeys.length} ${dayKeys.length === 1 ? "giorno" : "giorni"}`}
          onBack={() => setScreen(1)}
          backLabel="‹"
        />
        {keypad}
        <OnCallToggle value={isOnCall} onToggle={() => setIsOnCall((current) => !current)} />
        <button
          type="button"
          disabled={!complete || minutes <= 0}
          onClick={() => setScreen(3)}
          style={ctaStyle(complete && minutes > 0)}
        >
          Avanti
        </button>
      </div>
    );
  }

  if (screen === 3 && person) {
    const chosenDays = weeks
      .flatMap((week) => week.days)
      .filter((day) => dayKeys.includes(day.key));

    return (
      <div style={{ display: "grid", gap: 13 }}>
        <Head
          title="Confermi?"
          detail={`${chosenDays.length} ${chosenDays.length === 1 ? "turno" : "turni"} per ${person.name.split(" ")[0]}`}
          onBack={() => setScreen(2)}
          backLabel="‹"
        />

        <div style={{ display: "grid", gap: 6 }}>
          {chosenDays.map((day) => (
            <span
              key={day.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 13px",
                borderRadius: 14,
                background: "#ffffff",
                border: "1.5px solid #ebedf3",
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 780, color: "#16161d" }}>
                {day.weekday} {day.number}
                <strong
                  style={{
                    marginLeft: 8,
                    fontWeight: 840,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {start}–{end}
                </strong>
              </span>
              <button
                type="button"
                aria-label={`Togli ${day.weekday} ${day.number}`}
                onClick={() => setDayKeys((current) => current.filter((entry) => entry !== day.key))}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  border: 0,
                  background: "#f4f3fa",
                  color: "#7a7790",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <button
          type="button"
          disabled={pending || chosenDays.length === 0}
          onClick={() =>
            onSave(
              chosenDays.map((day) => ({
                date: day.key,
                startTime: span?.startTime ?? "",
                endTime: span?.endTime ?? "",
                memberIds: [person.id],
                isOnCall,
              }))
            )
          }
          style={ctaStyle(chosenDays.length > 0 && !pending)}
        >
          {pending
            ? "Salvo…"
            : `Salva ${chosenDays.length} ${chosenDays.length === 1 ? "turno" : "turni"}`}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Head title="A chi dai il turno?" detail={dayLabel} onBack={onCancel} backLabel="✕" />
      {doorSwitch}

      <div style={{ display: "grid", gap: 6 }}>
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => {
              setPersonId(member.id);
              setDayKeys([dayKey]);
              setScreen(1);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "10px 12px",
              borderRadius: 15,
              border: "1.5px solid #ebedf3",
              background: "#ffffff",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                flex: "0 0 auto",
                borderRadius: 999,
                display: "inline-grid",
                placeItems: "center",
                background: "#f1effe",
                color: "#4c1d95",
                fontSize: 11,
                fontWeight: 850,
              }}
            >
              {initialsOf(member.name)}
            </span>
            <span style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
              <strong style={{ fontSize: 14, fontWeight: 800, color: "#16161d" }}>{member.name}</strong>
              <span style={{ fontSize: 11.5, fontWeight: 740, color: "#a3a3b5" }}>{member.roleLabel}</span>
            </span>
            <span aria-hidden="true" style={{ color: "#c8c5d8", fontSize: 15 }}>
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PeopleChips({
  members,
  busy,
  chosen,
  onToggle,
}: {
  members: QuickAddMember[];
  busy: Map<string, string>;
  chosen: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {members.map((member) => {
        const picked = chosen.includes(member.id);
        const reason = busy.get(member.id);

        return (
          <button
            key={member.id}
            type="button"
            disabled={Boolean(reason)}
            onClick={() => onToggle(member.id)}
            title={reason ?? undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 13px 6px 6px",
              borderRadius: 999,
              border: picked ? "1.5px solid #6d5ce7" : "1.5px solid #ebedf3",
              background: picked ? "#efecff" : "#ffffff",
              color: picked ? "#4c1d95" : "#16161d",
              fontSize: 13.5,
              fontWeight: picked ? 820 : 720,
              opacity: reason ? 0.42 : 1,
              cursor: reason ? "default" : "pointer",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 27,
                height: 27,
                borderRadius: 999,
                display: "inline-grid",
                placeItems: "center",
                background: picked ? "#ffffff" : "#f1effe",
                color: "#4c1d95",
                fontSize: 10,
                fontWeight: 850,
              }}
            >
              {initialsOf(member.name)}
            </span>
            {member.name.split(" ")[0]}
            {reason ? <span style={{ fontSize: 11, fontWeight: 740 }}>· {reason}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function OnCallToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        justifySelf: "start",
        padding: "9px 14px",
        borderRadius: 999,
        border: value ? "1.5px solid #6d5ce7" : "1.5px dashed #d8d5ee",
        background: value ? "#efecff" : "transparent",
        color: value ? "#4c1d95" : "#6b7280",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {value ? "✓ Reperibilità" : "＋ Reperibilità"}
    </button>
  );
}

function Head({
  title,
  detail,
  onBack,
  backLabel,
}: {
  title: string;
  detail: string;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 18, fontWeight: 820, letterSpacing: "-0.02em", color: "#16161d" }}>
          {title}
        </strong>
        <span style={{ fontSize: 12.5, fontWeight: 750, color: "#a3a3b5" }}>{detail}</span>
      </span>
      <button
        type="button"
        onClick={onBack}
        aria-label="Indietro"
        style={{
          width: 34,
          height: 34,
          flex: "0 0 auto",
          display: "inline-grid",
          placeItems: "center",
          borderRadius: 999,
          border: 0,
          background: "#efecff",
          color: "#4c1d95",
          fontSize: 14,
          fontWeight: 750,
          cursor: "pointer",
        }}
      >
        {backLabel}
      </button>
    </div>
  );
}

/**
 * One of the two times. Tapping it is how you say which one you are writing,
 * so "15", tap fine, "22" is a whole shift.
 *
 * The minutes show as a faded 00 until they are typed: on the hour is what
 * the shift will be saved as, so the box says so rather than hiding it
 * behind two dashes.
 */
function TimeBox({
  digits,
  caption,
  active,
  onFocus,
}: {
  digits: string;
  caption: string;
  active: boolean;
  onFocus: () => void;
}) {
  const hours = digits.slice(0, 2);
  const minutes = digits.slice(2, 4);
  const empty = digits.length === 0;
  const impliedMinutes = minutes.length < 2;

  return (
    <button
      type="button"
      onClick={onFocus}
      aria-label={caption}
      style={{
        display: "grid",
        gap: 2,
        justifyItems: "center",
        width: "100%",
        padding: "12px 6px",
        borderRadius: 16,
        background: active ? "#efecff" : "#ffffff",
        border: `1.5px solid ${active ? "#6d5ce7" : "#ebedf3"}`,
        cursor: "pointer",
        font: "inherit",
      }}
    >
      <span
        style={{
          fontSize: 26,
          fontWeight: 830,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: empty ? "#d4d2e6" : active ? "#4c1d95" : "#16161d",
        }}
      >
        {empty ? "--" : hours.padEnd(2, "-")}
        <span style={{ opacity: empty ? 1 : 0.42 }}>
          :{empty ? "--" : impliedMinutes ? minutes.padEnd(2, "0") : minutes}
        </span>
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 850,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: active ? "#7c6bd6" : "#a3a3b5",
        }}
      >
        {caption}
      </span>
    </button>
  );
}

function weekArrowStyle(enabled: boolean) {
  return {
    width: 32,
    height: 32,
    display: "inline-grid",
    placeItems: "center",
    borderRadius: 999,
    border: 0,
    background: enabled ? "#efecff" : "#f6f5fb",
    color: enabled ? "#4c1d95" : "#c8c5d8",
    fontSize: 14,
    fontWeight: 820,
    cursor: enabled ? "pointer" : "default",
  };
}

function keyStyle(soft: boolean) {
  return {
    minHeight: 46,
    display: "inline-grid",
    placeItems: "center",
    borderRadius: 14,
    background: soft ? "#efecff" : "#ffffff",
    border: soft ? "1px solid transparent" : "1px solid #ebedf3",
    color: soft ? "#4c1d95" : "#16161d",
    fontSize: soft ? 15 : 19,
    fontWeight: soft ? 820 : 750,
    fontVariantNumeric: "tabular-nums" as const,
    cursor: "pointer",
  };
}

function ctaStyle(enabled: boolean) {
  return {
    minHeight: 50,
    display: "inline-grid",
    placeItems: "center",
    borderRadius: 16,
    border: 0,
    background: enabled ? "linear-gradient(135deg, #3b1d8f 0%, #5e4ae3 55%, #8b5cf6 100%)" : "#eef1f6",
    color: enabled ? "#ffffff" : "#b6bfcc",
    fontSize: 15,
    fontWeight: 820,
    boxShadow: enabled ? "0 10px 22px rgba(94, 74, 227, 0.26)" : "none",
    cursor: enabled ? "pointer" : "default",
  };
}

/**
 * What was typed, as a time - or null while the hour is still incomplete.
 * Minutes nobody typed are zero, so "15" is a quarter past three in the
 * afternoon and needs no further keystrokes.
 */
function resolveTime(digits: string) {
  if (digits.length < 2) {
    return null;
  }

  const hours = digits.slice(0, 2);
  const minutes = digits.slice(2, 4).padEnd(2, "0");

  if (Number(hours) > 23 || Number(minutes) > 59) {
    return null;
  }

  return `${hours}:${minutes}`;
}

function spanMinutes(startTime: string, endTime: string) {
  const start = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const end = Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3));

  // A shift that ends before it starts has run past midnight.
  return end > start ? end - start : end + 24 * 60 - start;
}

function describeSpan(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest} minuti`;
  }

  return rest === 0
    ? `${hours} ${hours === 1 ? "ora" : "ore"}`
    : `${hours} ${hours === 1 ? "ora" : "ore"} e ${rest}`;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
