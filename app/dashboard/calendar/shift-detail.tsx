"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { tapOutsideProps } from "../tap-outside";

/**
 * A tap on a shift in the day popup opens its detail: the hours, the
 * department, and everyone on it by full name, one per line. The row itself
 * cuts the names short ("Federico F.", "+2") to fit; here they are all
 * readable. Same for owner and staff; editing and deleting stay on the swipe.
 */

type DetailShift = {
  startTime: string;
  endTime: string;
  title?: string | null;
  isOnCall: boolean;
  confirmedAt: string | null;
  department?: { name: string; ink: string; soft: string } | null;
  assignments: Array<{ id: string; firstName: string; lastName: string; isCurrentUser?: boolean }>;
};

const clock = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Rome" }).format(
    new Date(value)
  );

export function ShiftDetailTap({
  shift,
  locale,
  currentUserId,
  children,
}: {
  shift: DetailShift;
  locale: string;
  currentUserId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(
    new Date(shift.startTime)
  );
  const people = [...shift.assignments].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, locale)
  );

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        data-swipe-surface
        aria-label="Apri il dettaglio del turno"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        style={{ cursor: "pointer" }}
      >
        {children}
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              {...tapOutsideProps(() => setOpen(false))}
              style={{
                position: "fixed",
                inset: 0,
                // Above the day popup it opens from (2147483646/7); last in the body, so on top.
                zIndex: 2147483647,
                background: "rgba(23, 22, 31, 0.42)",
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Dettaglio del turno"
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(100%, 420px)",
                  maxHeight: "calc(var(--workbit-vh, 100dvh) - 48px)",
                  overflowY: "auto",
                  background: "#ffffff",
                  borderRadius: 24,
                  padding: "20px 20px 18px",
                  display: "grid",
                  gap: 14,
                  boxShadow: "0 24px 60px rgba(23, 22, 31, 0.28)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ display: "grid", gap: 3, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#8b88a3", textTransform: "capitalize" }}>{day}</span>
                    <strong style={{ fontSize: 24, fontWeight: 850, color: "#17161f", fontVariantNumeric: "tabular-nums" }}>
                      {clock(shift.startTime, locale)}–{clock(shift.endTime, locale)}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Chiudi"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 999,
                      border: "1px solid #e4e0f2",
                      background: "#f6f4fd",
                      color: "#4c1d95",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {shift.department ? (
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: shift.department.soft, color: shift.department.ink }}>
                      {shift.department.name}
                    </span>
                  ) : null}
                  {shift.isOnCall ? (
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: "#fdf0dc", color: "#a15c07" }}>
                      Reperibilità
                    </span>
                  ) : null}
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12.5,
                      fontWeight: 700,
                      background: shift.confirmedAt ? "#e7f7ec" : "#fdf0dc",
                      color: shift.confirmedAt ? "#15803d" : "#a15c07",
                    }}
                  >
                    {shift.confirmedAt ? "Pubblicato" : "In attesa"}
                  </span>
                </div>

                {shift.title ? <p style={{ margin: 0, fontSize: 14, color: "#3a3850", lineHeight: 1.5 }}>{shift.title}</p> : null}

                <div style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 830, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a3a0b8" }}>
                    {people.length === 1 ? "1 persona" : `${people.length} persone`}
                  </span>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                    {people.map((person) => {
                      const me = person.isCurrentUser || person.id === currentUserId;
                      return (
                        <li
                          key={person.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 13,
                            border: "1px solid #eeebf8",
                            background: me ? "#f4f1ff" : "#ffffff",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 30,
                              height: 30,
                              flex: "0 0 auto",
                              borderRadius: 999,
                              display: "grid",
                              placeItems: "center",
                              background: "#ede9fe",
                              color: "#4c1d95",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {`${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: me ? 800 : 600, color: "#17161f", minWidth: 0, overflowWrap: "anywhere" }}>
                            {person.firstName} {person.lastName}
                            {me ? <span style={{ fontWeight: 600, color: "#5e4ae3" }}> · tu</span> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
