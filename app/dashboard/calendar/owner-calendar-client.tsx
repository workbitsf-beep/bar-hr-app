"use client";

import { RequestType } from "@prisma/client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  createAvailabilityAction,
  createShiftAction,
  createTimeOffRequestAction,
} from "../actions";
import { ShiftEditorModal } from "../shifts/shift-editor-modal";
import { PrimaryButton, StatusPill } from "../ui";
import { CalendarWeekStrip } from "./calendar-week-strip";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ShiftAssignment = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ShiftItem = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
  confirmedAt: string | null;
  assignments: ShiftAssignment[];
};

type AvailabilityItem = {
  id: string;
  firstName: string;
  lastName: string;
};

type RequestItem = {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
};

type DayItem = {
  date: string;
  isToday: boolean;
  inCurrentMonth: boolean;
  shifts: ShiftItem[];
  availabilities: AvailabilityItem[];
  requests: RequestItem[];
};

type FeedbackState =
  | {
      tone: "success" | "danger";
      message: string;
    }
  | null;

function formatDayTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDayLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function formatRoleLabel(role: string) {
  if (role === "MANAGER") {
    return "Manager";
  }

  if (role === "OWNER") {
    return "Titolare";
  }

  return "Dipendente";
}

function formatRequestTypeLabel(type: string) {
  if (type === RequestType.PERMISSION) {
    return "Permesso";
  }

  if (type === RequestType.SICKNESS) {
    return "Malattia";
  }

  return "Ferie";
}

function toDateTimeLocal(dateIso: string, hour: number, minute: number) {
  const date = new Date(dateIso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function chunkByWeek<T>(items: T[]) {
  return Array.from({ length: Math.ceil(items.length / 7) }, (_, index) =>
    items.slice(index * 7, index * 7 + 7)
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}

export function OwnerCalendarClient({
  locale,
  weekdayLabels,
  days,
  members,
  filteredDay,
  role,
}: {
  locale: string;
  weekdayLabels: string[];
  days: DayItem[];
  members: MemberOption[];
  filteredDay?: string | null;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [requestType, setRequestType] = useState<string>(RequestType.VACATION);
  const [requestStart, setRequestStart] = useState("");
  const [requestEnd, setRequestEnd] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [certificateCode, setCertificateCode] = useState("");
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [availabilityReason, setAvailabilityReason] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedDate]);

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? null,
    [days, selectedDate]
  );
  const editingShift = useMemo(
    () => selectedDay?.shifts.find((shift) => shift.id === editingShiftId) ?? null,
    [editingShiftId, selectedDay]
  );
  const weeks = useMemo(() => chunkByWeek(days), [days]);
  const visibleWeeks = useMemo(
    () =>
      filteredDay
        ? weeks.filter((week) => week.some((day) => day.date.slice(0, 10) === filteredDay))
        : weeks,
    [filteredDay, weeks]
  );
  const canCreatePersonalEntries = role === "MANAGER";

  function openDay(day: DayItem) {
    setSelectedDate(day.date);
    setEditingShiftId(null);
    setFeedback(null);
    setTitle("");
    setStartTime(toDateTimeLocal(day.date, 9, 0));
    setEndTime(toDateTimeLocal(day.date, 17, 0));
    setSelectedMembers(day.shifts[0]?.assignments.map((assignment) => assignment.id) ?? []);
    setRequestType(RequestType.VACATION);
    setRequestStart(toDateTimeLocal(day.date, 9, 0));
    setRequestEnd(toDateTimeLocal(day.date, 18, 0));
    setRequestReason("");
    setCertificateCode("");
    setAvailabilityStart(toDateTimeLocal(day.date, 9, 0));
    setAvailabilityEnd(toDateTimeLocal(day.date, 18, 0));
    setAvailabilityReason("");
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setEditingShiftId(null);
    setSelectedDate(null);
    setFeedback(null);
  }

  function toggleMember(memberId: string) {
    setSelectedMembers((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : current.concat(memberId)
    );
  }

  function runAction(task: () => Promise<void>, successMessage: string, closeOnSuccess = false) {
    startTransition(async () => {
      try {
        await task();
        setFeedback({ tone: "success", message: successMessage });
        if (closeOnSuccess) {
          setEditingShiftId(null);
          setSelectedDate(null);
        }
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "danger", message: getErrorMessage(error) });
      }
    });
  }

  function handleCreateShift() {
    if (!selectedDay || selectedMembers.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.set("title", title);
    formData.set("startTime", startTime);
    formData.set("endTime", endTime);

    for (const memberId of selectedMembers) {
      formData.append("employeeIds", memberId);
    }

    runAction(async () => {
      await createShiftAction(formData);
    }, "Turno aggiunto.", true);
  }

  function handleCreateRequest() {
    if (!selectedDay || !requestStart || !requestEnd) {
      return;
    }

    const formData = new FormData();
    formData.set("type", requestType);
    formData.set("startsAt", requestStart);
    formData.set("endsAt", requestEnd);
    formData.set("reason", requestReason);
    formData.set("certificateCode", certificateCode);

    runAction(async () => {
      await createTimeOffRequestAction(formData);
      setRequestReason("");
      setCertificateCode("");
    }, "Richiesta salvata.");
  }

  function handleCreateAvailability() {
    if (!selectedDay || !availabilityStart || !availabilityEnd) {
      return;
    }

    const formData = new FormData();
    formData.set("startsAt", availabilityStart);
    formData.set("endsAt", availabilityEnd);
    formData.set("reason", availabilityReason);

    runAction(async () => {
      await createAvailabilityAction(formData);
      setAvailabilityReason("");
    }, "Indisponibilita salvata.");
  }

  return (
    <>
      <div className="dashboard-desktop-only">
        <div className="dashboard-calendar-scroll">
          <div
            className="dashboard-calendar-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="dashboard-calendar-weekday"
                style={{
                  padding: "10px 12px",
                  borderRadius: 16,
                  background: "#e2e8f0",
                  color: "#334155",
                  fontWeight: 700,
                  textTransform: "capitalize",
                  textAlign: "center",
                }}
              >
                {label}
              </div>
            ))}

            {days.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => openDay(day)}
                className="dashboard-calendar-day"
                style={{
                  minHeight: 220,
                  padding: 14,
                  borderRadius: 20,
                  background: day.inCurrentMonth ? "#ffffff" : "#f8fafc",
                  border: day.isToday ? "2px solid #0f172a" : "1px solid #e2e8f0",
                  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                  display: "grid",
                  alignContent: "start",
                  gap: 10,
                  opacity: day.inCurrentMonth ? 1 : 0.72,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <strong style={{ color: "#0f172a", fontSize: 16 }}>
                    {new Date(day.date).getDate()}
                  </strong>
                  {day.isToday ? <StatusPill label="Oggi" tone="neutral" /> : null}
                </div>

                {day.shifts.length === 0 &&
                day.availabilities.length === 0 &&
                day.requests.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 14 }}>Nessun evento</div>
                ) : null}

                {day.shifts.map((shift) => (
                  <div
                    key={shift.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 16,
                      background: "#eff6ff",
                      border: "1px solid #dbeafe",
                      color: "#0f172a",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{shift.title || "Turno"}</strong>
                    <span style={{ color: "#475569", fontSize: 13 }}>
                      {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
                    </span>
                    <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
                      {shift.assignments
                        .map((assignment) => `${assignment.firstName} ${assignment.lastName}`)
                        .join(", ")}
                    </span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {shift.confirmedAt ? (
                        <StatusPill label="Confermato" tone="success" />
                      ) : (
                        <StatusPill label="Da confermare" tone="warning" />
                      )}
                    </div>
                  </div>
                ))}

                {day.availabilities.map((availability) => (
                  <div
                    key={availability.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 16,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#991b1b",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    Indisponibilita: {availability.firstName} {availability.lastName}
                  </div>
                ))}

                {day.requests.map((request) => (
                  <div
                    key={request.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 16,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#991b1b",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {formatRequestTypeLabel(request.type)}: {request.firstName} {request.lastName}
                  </div>
                ))}
              </button>
            ))}
          </div>
        </div>
      </div>

      <CalendarWeekStrip
        className="dashboard-mobile-only dashboard-week-strip"
        style={{
          display: "flex",
          gap: 12,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        {visibleWeeks.map((week, weekIndex) => {
          const weekIsCurrent = week.some((day) => day.isToday);

          return (
            <section
              key={`${week[0]?.date ?? `${weekIndex}-${filteredDay ?? "all"}`}`}
              className="dashboard-week-card"
              data-current-week={weekIsCurrent ? "true" : undefined}
              style={{
                display: "grid",
                gap: 12,
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: 14,
                borderRadius: 22,
                background: weekIsCurrent ? "#eef2ff" : "#f8fafc",
                border: weekIsCurrent ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
                boxShadow: weekIsCurrent
                  ? "0 10px 24px rgba(99, 102, 241, 0.08)"
                  : undefined,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                {week[0] && week[week.length - 1] ? (
                  <span style={{ color: "#64748b", lineHeight: 1.6 }}>
                    {new Intl.DateTimeFormat(locale, {
                      day: "numeric",
                      month: "long",
                    }).format(new Date(week[0].date))}
                    {" - "}
                    {new Intl.DateTimeFormat(locale, {
                      day: "numeric",
                      month: "long",
                    }).format(new Date(week[week.length - 1].date))}
                  </span>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {week.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => openDay(day)}
                    style={{
                      display: "grid",
                      gap: 10,
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      padding: 14,
                      borderRadius: 20,
                      background: "#ffffff",
                      border: day.isToday ? "2px solid #0f172a" : "1px solid #e2e8f0",
                      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                      opacity: day.inCurrentMonth ? 1 : 0.7,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ color: "#0f172a", fontSize: 18 }}>
                        {formatDayLabel(day.date, locale)}
                      </strong>
                      {day.isToday ? <StatusPill label="Oggi" tone="neutral" /> : null}
                    </div>

                    {day.shifts.length === 0 &&
                    day.availabilities.length === 0 &&
                    day.requests.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 15 }}>Nessun evento</div>
                    ) : null}

                    {day.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        style={{
                          padding: 14,
                          borderRadius: 18,
                          background: "#eff6ff",
                          border: "1px solid #dbeafe",
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <strong style={{ color: "#0f172a", fontSize: 16 }}>
                          {shift.title || "Turno"}
                        </strong>
                        <div style={{ color: "#334155", fontWeight: 600, fontSize: 15 }}>
                          {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {shift.assignments.map((assignment) => (
                            <div
                              key={`${shift.id}-${assignment.id}`}
                              style={{ color: "#475569", lineHeight: 1.5 }}
                            >
                              {assignment.firstName} {assignment.lastName} -{" "}
                              {formatRoleLabel(assignment.role)}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {shift.confirmedAt ? (
                            <StatusPill label="Confermato" tone="success" />
                          ) : (
                            <StatusPill label="Da confermare" tone="warning" />
                          )}
                        </div>
                      </div>
                    ))}

                    {day.availabilities.map((availability) => (
                      <div
                        key={availability.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 18,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          lineHeight: 1.6,
                        }}
                      >
                        Indisponibilita: {availability.firstName} {availability.lastName}
                      </div>
                    ))}

                    {day.requests.map((request) => (
                      <div
                        key={request.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 18,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          lineHeight: 1.6,
                        }}
                      >
                        {formatRequestTypeLabel(request.type)}: {request.firstName} {request.lastName}
                      </div>
                    ))}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </CalendarWeekStrip>

      {mounted && selectedDay
        ? createPortal(
            <div
              className="dashboard-modal-wrap"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483646,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <button
                type="button"
                aria-label="Chiudi popup"
                onClick={closeModal}
                style={{
                  position: "absolute",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.28)",
                  backdropFilter: "blur(6px)",
                }}
              />

              <section
                className="dashboard-modal-panel"
                style={{
                  position: "relative",
                  width: "min(720px, calc(100vw - 32px))",
                  maxHeight: "calc(100vh - 32px)",
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 28,
                  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  padding: 24,
                  display: "grid",
                  gap: 18,
                  zIndex: 1,
                }}
              >
                <div
                  className="dashboard-modal-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ fontSize: 22, color: "#0f172a" }}>
                      {new Intl.DateTimeFormat(locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(selectedDay.date))}
                    </strong>
                    <span style={{ color: "#64748b" }}>
                      {canCreatePersonalEntries
                        ? "Gestisci turni, richieste e indisponibilita da questa giornata."
                        : "Aggiungi un nuovo turno oppure apri quelli esistenti per modificarli o eliminarli."}
                    </span>
                  </div>

                  <PrimaryButton type="button" tone="sand" onClick={closeModal} disabled={isPending}>
                    Chiudi
                  </PrimaryButton>
                </div>

                {feedback ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border:
                        feedback.tone === "success"
                          ? "1px solid #bbf7d0"
                          : "1px solid #fecaca",
                      background:
                        feedback.tone === "success" ? "#f0fdf4" : "#fef2f2",
                      color: feedback.tone === "success" ? "#166534" : "#b91c1c",
                      lineHeight: 1.5,
                    }}
                  >
                    {feedback.message}
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 12 }}>
                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Titolo turno</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Servizio pranzo"
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                    />
                  </label>

                  <div
                    className="dashboard-modal-body-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Inizio</span>
                      <input
                        type="datetime-local"
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                        style={{
                          borderRadius: 16,
                          border: "1px solid #dbe3ee",
                          padding: "12px 14px",
                          fontSize: 15,
                          background: "#ffffff",
                        }}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Fine</span>
                      <input
                        type="datetime-local"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                        style={{
                          borderRadius: 16,
                          border: "1px solid #dbe3ee",
                          padding: "12px 14px",
                          fontSize: 15,
                          background: "#ffffff",
                        }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Persone nel turno</span>
                    <div
                      className="dashboard-modal-members-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {members.map((member) => (
                        <label
                          key={member.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "12px 14px",
                            borderRadius: 16,
                            border: "1px solid #e2e8f0",
                            background: selectedMembers.includes(member.id) ? "#e2e8f0" : "#f8fafc",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={() => toggleMember(member.id)}
                          />
                          {member.firstName} {member.lastName} - {formatRoleLabel(member.role)}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div
                    className="dashboard-modal-actions"
                    style={{ display: "flex", justifyContent: "flex-end" }}
                  >
                    <PrimaryButton
                      type="button"
                      onClick={handleCreateShift}
                      disabled={isPending || selectedMembers.length === 0 || !startTime || !endTime}
                    >
                      {isPending ? "Salvataggio..." : "Aggiungi turno"}
                    </PrimaryButton>
                  </div>
                </div>

                {canCreatePersonalEntries ? (
                  <>
                    <div style={{ display: "grid", gap: 12 }}>
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>Nuova richiesta</strong>

                      <div
                        className="dashboard-modal-body-grid"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Tipo</span>
                          <select
                            value={requestType}
                            onChange={(event) => setRequestType(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          >
                            <option value={RequestType.VACATION}>Ferie</option>
                            <option value={RequestType.PERMISSION}>Permesso</option>
                            <option value={RequestType.SICKNESS}>Malattia</option>
                          </select>
                        </label>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Da</span>
                          <input
                            type="datetime-local"
                            value={requestStart}
                            onChange={(event) => setRequestStart(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>A</span>
                          <input
                            type="datetime-local"
                            value={requestEnd}
                            onChange={(event) => setRequestEnd(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          />
                        </label>
                      </div>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Motivo</span>
                        <textarea
                          value={requestReason}
                          onChange={(event) => setRequestReason(event.target.value)}
                          placeholder="Aggiungi un dettaglio utile per il titolare"
                          style={{
                            minHeight: 120,
                            resize: "vertical",
                            borderRadius: 16,
                            border: "1px solid #dbe3ee",
                            padding: "12px 14px",
                            fontSize: 15,
                            background: "#ffffff",
                          }}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Codice certificato</span>
                        <input
                          value={certificateCode}
                          onChange={(event) => setCertificateCode(event.target.value)}
                          placeholder="Obbligatorio solo per malattia"
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe3ee",
                            padding: "12px 14px",
                            fontSize: 15,
                            background: "#ffffff",
                          }}
                        />
                      </label>

                      <div
                        className="dashboard-modal-actions"
                        style={{ display: "flex", justifyContent: "flex-end" }}
                      >
                        <PrimaryButton
                          type="button"
                          onClick={handleCreateRequest}
                          disabled={isPending || !requestStart || !requestEnd}
                        >
                          {isPending ? "Invio..." : "Invia richiesta"}
                        </PrimaryButton>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>
                        Nuova indisponibilita
                      </strong>

                      <div
                        className="dashboard-modal-body-grid"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Da</span>
                          <input
                            type="datetime-local"
                            value={availabilityStart}
                            onChange={(event) => setAvailabilityStart(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>A</span>
                          <input
                            type="datetime-local"
                            value={availabilityEnd}
                            onChange={(event) => setAvailabilityEnd(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          />
                        </label>
                      </div>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Motivo</span>
                        <textarea
                          value={availabilityReason}
                          onChange={(event) => setAvailabilityReason(event.target.value)}
                          placeholder="Facoltativo"
                          style={{
                            minHeight: 100,
                            resize: "vertical",
                            borderRadius: 16,
                            border: "1px solid #dbe3ee",
                            padding: "12px 14px",
                            fontSize: 15,
                            background: "#ffffff",
                          }}
                        />
                      </label>

                      <div
                        className="dashboard-modal-actions"
                        style={{ display: "flex", justifyContent: "flex-end" }}
                      >
                        <PrimaryButton
                          type="button"
                          onClick={handleCreateAvailability}
                          disabled={isPending || !availabilityStart || !availabilityEnd}
                        >
                          {isPending ? "Salvataggio..." : "Salva indisponibilita"}
                        </PrimaryButton>
                      </div>
                    </div>
                  </>
                ) : null}

                <div style={{ display: "grid", gap: 10 }}>
                  <strong style={{ fontSize: 18, color: "#0f172a" }}>Turni del giorno</strong>
                  {selectedDay.shifts.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessun turno presente in questa giornata.</div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {selectedDay.shifts.map((shift) => (
                        <div
                          className="dashboard-list-card"
                          key={shift.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            padding: 14,
                            borderRadius: 18,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            <strong style={{ color: "#0f172a" }}>{shift.title || "Turno"}</strong>
                            <span style={{ color: "#475569" }}>
                              {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
                            </span>
                            <span style={{ color: "#64748b", fontSize: 14 }}>
                              {shift.assignments
                                .map((assignment) => `${assignment.firstName} ${assignment.lastName}`)
                                .join(", ")}
                            </span>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {shift.confirmedAt ? (
                                <StatusPill label="Confermato" tone="success" />
                              ) : (
                                <StatusPill label="Da confermare" tone="warning" />
                              )}
                            </div>
                          </div>

                          <PrimaryButton
                            type="button"
                            tone="sand"
                            onClick={() => setEditingShiftId(shift.id)}
                            disabled={isPending}
                          >
                            Modifica
                          </PrimaryButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

      <ShiftEditorModal
        open={Boolean(editingShift)}
        locale={locale}
        canManage
        shift={editingShift}
        members={members}
        onClose={() => setEditingShiftId(null)}
      />
    </>
  );
}
