"use client";

import { useMemo, useState } from "react";
import { ShiftEditorModal } from "./shift-editor-modal";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ShiftOption = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
  assignments: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  createdBy?: {
    firstName: string;
    lastName: string;
  } | null;
  highlight?: boolean;
};

function formatDayTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PlannedShiftsList({
  locale,
  canManage,
  shifts,
  members,
}: {
  locale: string;
  canManage: boolean;
  shifts: ShiftOption[];
  members: MemberOption[];
}) {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? null,
    [selectedShiftId, shifts]
  );

  return (
    <>
      <div style={{ display: "grid", gap: 10 }}>
        {shifts.map((shift) => (
          <button
            key={shift.id}
            type="button"
            onClick={() => setSelectedShiftId(shift.id)}
            className="dashboard-list-button"
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 20,
              border: shift.highlight ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
              background: shift.highlight ? "#f1f5f9" : "#f8fafc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#0f172a" }}>{shift.title || "Turno condiviso"}</strong>
              <span style={{ color: "#475569", fontSize: 14 }}>
                {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
              </span>
              <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
                {shift.assignments
                  .map((assignment) => `${assignment.firstName} ${assignment.lastName}`)
                  .join(", ")}
              </span>
            </div>

            <span
              className="dashboard-list-button-arrow"
              style={{
                color: "#64748b",
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              &rsaquo;
            </span>
          </button>
        ))}
      </div>

      <ShiftEditorModal
        open={Boolean(selectedShift)}
        locale={locale}
        canManage={canManage}
        shift={selectedShift}
        members={members}
        onClose={() => setSelectedShiftId(null)}
      />
    </>
  );
}
